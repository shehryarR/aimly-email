"""
Attachment Route
Handles upload, download, delete, and paginated listing of campaign attachments.

UPDATE BEHAVIOR WITH NULL:
════════════════════════════════════════════════════════════

For optional fields (where applicable):
- Field NOT SENT → Ignored (unchanged)
- Field SENT EMPTY → Set to NULL in database
- Field SENT WITH VALUE → Set to value in database
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Optional
import os
import shutil
from core.database.connection import get_connection
from routes.auth import get_current_user

attachment_router = APIRouter(tags=["Attachment"])

ATTACHMENT_STORAGE_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "./data/uploads/attachments")
ATTACHMENT_UPLOAD_DIR = Path(ATTACHMENT_STORAGE_PATH)
os.makedirs(ATTACHMENT_UPLOAD_DIR, exist_ok=True)

ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".csv", ".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def normalize_text_field(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


# ==================================================================================
# POST /attachment - Upload a new attachment
# ==================================================================================
@attachment_router.post("/attachment/")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size too large (max 5MB)")

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_ATTACHMENT_EXTENSIONS)}"
        )

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO attachments (name, user_id) VALUES (?, ?)",
                (file.filename, user_id)
            )
            attachment_id = cursor.lastrowid

            saved_filename = f"{attachment_id}{file_extension}"
            file_path = ATTACHMENT_UPLOAD_DIR / saved_filename

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            conn.commit()

        return {
            "id": attachment_id,
            "filename": file.filename,
            "saved_as": saved_filename,
            "message": "File uploaded successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(
                status_code=409,
                detail=f"You already have an attachment named '{file.filename}'. Delete it first or rename the file."
            )
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
    finally:
        file.file.close()


# ==================================================================================
# DELETE /attachment/{attachment_id} - Delete an attachment
# ==================================================================================
@attachment_router.delete("/attachment/{attachment_id}/")
async def delete_attachment(
    attachment_id: int,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, user_id FROM attachments WHERE id = ?",
                (attachment_id,)
            )
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Attachment not found")
            if result["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Not authorised to delete this attachment")

            original_filename = result["name"]
            file_extension = Path(original_filename).suffix.lower()
            saved_filename = f"{attachment_id}{file_extension}"
            file_path = ATTACHMENT_UPLOAD_DIR / saved_filename

            if file_path.exists():
                os.remove(file_path)

            cursor.execute("DELETE FROM attachments WHERE id = ?", (attachment_id,))
            conn.commit()

        return {
            "message": f"Attachment '{original_filename}' deleted successfully",
            "id": attachment_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting attachment: {str(e)}")


# ==================================================================================
# GET /attachment/{attachment_id} - Download attachment file
# ==================================================================================
@attachment_router.get("/attachment/{attachment_id}/")
async def download_attachment(
    attachment_id: int,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, user_id FROM attachments WHERE id = ?",
                (attachment_id,)
            )
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Attachment not found")
            if result["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Not authorised to access this attachment")

            original_filename = result["name"]
            file_extension = Path(original_filename).suffix.lower()
            saved_filename = f"{attachment_id}{file_extension}"
            file_path = ATTACHMENT_UPLOAD_DIR / saved_filename

            if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found on disk")

        return FileResponse(
            path=file_path,
            filename=original_filename,
            media_type="application/octet-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")


# ==================================================================================
# GET /attachments - List attachments for current user (paginated + search + sort + filter)
# ==================================================================================
@attachment_router.get("/attachments/")
async def list_attachments(
    current_user: dict = Depends(get_current_user),
    page:       int           = Query(1,   ge=1,        description="Page number (1-based)"),
    page_size:  int           = Query(20,  ge=1, description="Items per page"),
    search:     Optional[str] = Query(None,              description="Search by filename (case-insensitive)"),
    sort_by:    Optional[str] = Query(None,              description="Sort field: name | size | campaigns"),
    sort_order: Optional[str] = Query("asc",             description="Sort direction: asc | desc"),
    filter_global: Optional[bool] = Query(None,          description="Filter to only globally-linked attachments"),
    filter_campaigns: Optional[str] = Query(None,        description="Comma-separated campaign IDs to filter by"),
    filter_mode:      Optional[str] = Query("any",           description="Campaign filter mode: any (OR) | all (AND)"),
):
    """
    List attachments with pagination, search, server-side sorting, and server-side filtering.

    Sorting:
    - sort_by=name      → alphabetical by filename
    - sort_by=size      → by file size (computed from disk)
    - sort_by=campaigns → by number of linked campaigns

    Filtering:
    - filter_global=true              → only attachments linked to global settings
    - filter_campaigns=1,2,3          → attachments linked to ANY or ALL specified campaigns
    - filter_mode=any                  → OR logic (default): linked to at least one campaign
    - filter_mode=all                  → AND logic: linked to every specified campaign

    Both filters can be combined (AND logic with global).
    """
    user_id = current_user["user_id"]
    offset  = (page - 1) * page_size

    # Parse campaign filter IDs
    campaign_filter_ids: list[int] = []
    if filter_campaigns and filter_campaigns.strip():
        try:
            campaign_filter_ids = [int(x.strip()) for x in filter_campaigns.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="filter_campaigns must be comma-separated integers")

    # Validate sort params
    valid_sort_fields = {"name", "size", "campaigns"}
    if sort_by and sort_by not in valid_sort_fields:
        sort_by = None
    sort_dir = "DESC" if sort_order and sort_order.lower() == "desc" else "ASC"

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            # ── Step 1: fetch ALL matching attachment IDs (for filter + search) ──
            # We need to pull all IDs first so we can compute file sizes and
            # campaign counts for sorting, then paginate.

            base_where = "a.user_id = ?"
            base_params: list = [user_id]

            if search and search.strip():
                base_where += " AND a.name LIKE ?"
                base_params.append(f"%{search.strip()}%")

            # ── Step 2: fetch full dataset with campaign link counts ────────────
            # We LEFT JOIN to global_settings_attachments and
            # campaign_preference_attachments to compute link counts for sorting.

            full_query = f"""
                SELECT
                    a.id,
                    a.name,
                    a.created_at,
                    (
                        SELECT COUNT(*) 
                        FROM global_settings_attachments gsa
                        JOIN global_settings gs ON gsa.global_settings_id = gs.id
                        WHERE gsa.attachment_id = a.id AND gs.user_id = a.user_id
                    ) AS global_count,
                    (
                        SELECT COUNT(DISTINCT cp.campaign_id)
                        FROM campaign_preference_attachments cpa
                        JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
                        JOIN campaigns c ON cp.campaign_id = c.id
                        WHERE cpa.attachment_id = a.id AND c.user_id = a.user_id
                    ) AS campaign_count
                FROM attachments a
                WHERE {base_where}
            """
            cursor.execute(full_query, base_params)
            all_rows = cursor.fetchall()

            # ── Step 3: apply filter_global and filter_campaigns in Python ───────
            # (These require checking junction tables; doing it here avoids
            #  extremely complex SQL with variable-length IN clauses.)

            # Fetch global-linked IDs for this user
            if filter_global is True or filter_global is False:
                cursor.execute("""
                    SELECT DISTINCT gsa.attachment_id
                    FROM global_settings_attachments gsa
                    JOIN global_settings gs ON gsa.global_settings_id = gs.id
                    WHERE gs.user_id = ?
                """, (user_id,))
                globally_linked_ids = {row["attachment_id"] for row in cursor.fetchall()}
            else:
                globally_linked_ids = None

            # Fetch campaign-linked IDs per requested campaign
            campaign_linked_sets: list[set[int]] = []
            if campaign_filter_ids:
                for camp_id in campaign_filter_ids:
                    cursor.execute("""
                        SELECT DISTINCT cpa.attachment_id
                        FROM campaign_preference_attachments cpa
                        JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
                        WHERE cp.campaign_id = ?
                    """, (camp_id,))
                    campaign_linked_sets.append({row["attachment_id"] for row in cursor.fetchall()})

            # Apply filters
            filtered_rows = []
            for row in all_rows:
                att_id = row["id"]

                # global filter
                if filter_global is True and globally_linked_ids is not None:
                    if att_id not in globally_linked_ids:
                        continue
                elif filter_global is False and globally_linked_ids is not None:
                    if att_id in globally_linked_ids:
                        continue

                # campaign filter (any=OR, all=AND)
                if campaign_linked_sets:
                    if filter_mode == "all":
                        if not all(att_id in cs for cs in campaign_linked_sets):
                            continue
                    else:  # any (OR)
                        if not any(att_id in cs for cs in campaign_linked_sets):
                            continue

                filtered_rows.append(row)

            total = len(filtered_rows)

            # ── Step 4: sort ─────────────────────────────────────────────────────
            reverse = sort_dir == "DESC"

            if sort_by == "name":
                filtered_rows.sort(key=lambda r: r["name"].lower(), reverse=reverse)
            elif sort_by == "campaigns":
                filtered_rows.sort(key=lambda r: r["campaign_count"], reverse=reverse)
            elif sort_by == "size":
                # Compute file size on the fly for sorting
                def _size(row):
                    ext = Path(row["name"]).suffix.lower()
                    fp  = ATTACHMENT_UPLOAD_DIR / f"{row['id']}{ext}"
                    return fp.stat().st_size if fp.exists() else 0
                filtered_rows.sort(key=_size, reverse=reverse)
            else:
                # Default: newest first (created_at DESC)
                filtered_rows.sort(key=lambda r: r["created_at"] or "", reverse=True)

            # ── Step 5: paginate ─────────────────────────────────────────────────
            page_rows = filtered_rows[offset: offset + page_size]

            # ── Step 6: build response ───────────────────────────────────────────
            attachments = []
            for row in page_rows:
                attachments.append({
                    "id":         row["id"],
                    "filename":   row["name"],
                    "created_at": row["created_at"],
                    "file_size":  get_file_size(row["id"], row["name"]),
                })

        return {
            "attachments":  attachments,
            "total":        total,
            "page":         page,
            "page_size":    page_size,
            "total_pages":  max(1, -(-total // page_size)),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing attachments: {str(e)}")


# ==================================================================================
# GET /attachment/{attachment_id}/info - Get attachment metadata
# ==================================================================================
@attachment_router.get("/attachment/{attachment_id}/info/")
async def get_attachment_info(
    attachment_id: int,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, user_id, created_at FROM attachments WHERE id = ?",
                (attachment_id,)
            )
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Attachment not found")
            if result["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Not authorised to access this attachment")

            file_extension = Path(result["name"]).suffix.lower()
            saved_filename = f"{attachment_id}{file_extension}"
            file_path = ATTACHMENT_UPLOAD_DIR / saved_filename

            file_info = {
                "id": result["id"],
                "filename": result["name"],
                "created_at": result["created_at"],
                "exists_on_disk": file_path.exists()
            }
            if file_info["exists_on_disk"]:
                file_info["file_size"] = file_path.stat().st_size
                file_info["file_extension"] = file_extension[1:] if file_extension else ""

        return file_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting attachment info: {str(e)}")


# ==================================================================================
# PUT /attachment/{attachment_id} - Update attachment metadata (rename)
# ==================================================================================
@attachment_router.put("/attachment/{attachment_id}/")
async def update_attachment(
    attachment_id: int,
    new_name: str | None = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT name, user_id FROM attachments WHERE id = ?",
                (attachment_id,)
            )
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Attachment not found")
            if result["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Not authorised to update this attachment")

            original_filename = result["name"]
            original_extension = Path(original_filename).suffix.lower()

            if new_name is None:
                raise HTTPException(status_code=400, detail="new_name is required")

            new_name = normalize_text_field(new_name)

            if new_name is None:
                raise HTTPException(status_code=400, detail="Filename cannot be empty")

            if '.' in new_name:
                raise HTTPException(
                    status_code=400,
                    detail="New name should not include file extension."
                )

            full_new_name = f"{new_name}{original_extension}"

            cursor.execute(
                "SELECT id FROM attachments WHERE user_id = ? AND name = ? AND id != ?",
                (user_id, full_new_name, attachment_id)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"You already have an attachment named '{full_new_name}'"
                )

            cursor.execute(
                "UPDATE attachments SET name = ? WHERE id = ?",
                (full_new_name, attachment_id)
            )
            conn.commit()

        return {
            "id": attachment_id,
            "filename": full_new_name,
            "old_filename": original_filename,
            "message": "Attachment renamed successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating attachment: {str(e)}")


# ==================================================================================
# Helper
# ==================================================================================
def get_file_size(attachment_id: int, original_filename: str) -> int:
    file_extension = Path(original_filename).suffix.lower()
    saved_filename = f"{attachment_id}{file_extension}"
    file_path = ATTACHMENT_UPLOAD_DIR / saved_filename
    return file_path.stat().st_size if file_path.exists() else 0