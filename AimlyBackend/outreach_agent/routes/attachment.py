"""
Attachment Route
Handles upload, download, bulk-delete, and paginated listing of campaign attachments.

UPDATE BEHAVIOR WITH NULL:
════════════════════════════════════════════════════════════

For optional fields (where applicable):
- Field NOT SENT → Ignored (unchanged)
- Field SENT EMPTY → Set to NULL in database
- Field SENT WITH VALUE → Set to value in database

BULK DELETE:
- DELETE /attachments/bulk/ replaces the old single DELETE /attachment/{id}/
- Accepts a JSON body: { "ids": [1, 2, 3] }
- Handles file removal + DB deletion for all IDs in one transaction
- Use this for both single and multi-attachment deletion

LIST RESPONSE:
- GET /attachments/ now returns linked_global and linked_campaigns per attachment
- No separate per-attachment link-resolution calls needed on the frontend
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
import os
import shutil
from core.database.connection import get_connection
from routes.auth import get_current_user

attachment_router = APIRouter(tags=["Attachment"])

ATTACHMENT_STORAGE_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "./data/uploads/attachments")
ATTACHMENT_UPLOAD_DIR = Path(ATTACHMENT_STORAGE_PATH)
os.makedirs(ATTACHMENT_UPLOAD_DIR, exist_ok=True)

ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".csv", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
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
            detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}"
        )

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO attachments (name, user_id) VALUES (%s, %s)",
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
# DELETE /attachments/bulk - Bulk delete attachments (replaces single DELETE)
# Body: { "ids": [1, 2, 3] }
# Use for both single (ids=[x]) and multi deletion.
# ==================================================================================
class BulkDeleteRequest(BaseModel):
    ids: List[int]

@attachment_router.delete("/attachments/bulk/")
async def bulk_delete_attachments(
    request: BulkDeleteRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    if not request.ids:
        raise HTTPException(status_code=400, detail="ids must not be empty")

    deleted = []
    not_found = []
    forbidden = []

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            placeholders = ','.join(['%s'] * len(request.ids))
            cursor.execute(
                f"SELECT id, name, user_id FROM attachments WHERE id IN ({placeholders})",
                request.ids
            )
            rows = {row["id"]: row for row in cursor.fetchall()}

            ids_to_delete = []
            for att_id in request.ids:
                if att_id not in rows:
                    not_found.append(att_id)
                    continue
                if rows[att_id]["user_id"] != user_id:
                    forbidden.append(att_id)
                    continue
                ids_to_delete.append(att_id)

            if forbidden:
                raise HTTPException(
                    status_code=403,
                    detail=f"Not authorised to delete attachment IDs: {forbidden}"
                )

            # Delete files from disk
            for att_id in ids_to_delete:
                original_filename = rows[att_id]["name"]
                file_extension = Path(original_filename).suffix.lower()
                saved_filename = f"{att_id}{file_extension}"
                file_path = ATTACHMENT_UPLOAD_DIR / saved_filename
                if file_path.exists():
                    os.remove(file_path)
                deleted.append(att_id)

            # Delete DB rows in one statement
            if ids_to_delete:
                del_placeholders = ','.join(['%s'] * len(ids_to_delete))
                cursor.execute(
                    f"DELETE FROM attachments WHERE id IN ({del_placeholders})",
                    ids_to_delete
                )
                conn.commit()

        return {
            "deleted": deleted,
            "deleted_count": len(deleted),
            "not_found": not_found,
            "message": f"{len(deleted)} attachment(s) deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting attachments: {str(e)}")


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
                "SELECT name, user_id FROM attachments WHERE id = %s",
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
# GET /attachments - List attachments (paginated + search + sort + filter)
#
# Now returns linked_global and linked_campaigns per attachment directly.
# The frontend no longer needs to make per-attachment link resolution calls.
# ==================================================================================
@attachment_router.get("/attachments/")
async def list_attachments(
    current_user: dict = Depends(get_current_user),
    page:       int           = Query(1,   ge=1,        description="Page number (1-based)"),
    page_size:  int           = Query(20,  ge=1,        description="Items per page"),
    search:     Optional[str] = Query(None,             description="Search by filename (case-insensitive)"),
    sort_by:    Optional[str] = Query(None,             description="Sort field: name | size | campaigns"),
    sort_order: Optional[str] = Query("asc",            description="Sort direction: asc | desc"),
    filter_global:    Optional[bool] = Query(None,      description="Filter to only globally-linked attachments"),
    filter_campaigns: Optional[str]  = Query(None,      description="Comma-separated campaign IDs to filter by"),
    filter_mode:      Optional[str]  = Query("any",     description="Campaign filter mode: any (OR) | all (AND)"),
):
    """
    List attachments with pagination, search, server-side sorting, and server-side filtering.

    Each attachment in the response includes:
    - linked_global: bool  — whether it is attached to global settings
    - linked_campaigns: [{ id, name }]  — campaigns it is attached to (via campaign_preferences)

    Sorting:
    - sort_by=name      → alphabetical by filename
    - sort_by=size      → by file size (computed from disk)
    - sort_by=campaigns → by number of linked campaigns

    Filtering:
    - filter_global=true              → only attachments linked to global settings
    - filter_campaigns=1,2,3          → attachments linked to ANY or ALL specified campaigns
    - filter_mode=any                 → OR logic (default)
    - filter_mode=all                 → AND logic

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

            # ── Build base WHERE ──────────────────────────────────────────────────
            base_where = "a.user_id = %s"
            base_params: list = [user_id]

            if search and search.strip():
                base_where += " AND a.name LIKE %s"
                base_params.append(f"%{search.strip()}%")

            # ── Step 1: Fetch all matching rows with link counts + link details ──
            # linked_global:    1 if this attachment is in global_settings_attachments
            # linked_campaigns: comma-separated "campaign_id:campaign_name" pairs
            # campaign_count:   used for sort_by=campaigns
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
                    ) AS campaign_count,
                    (
                        SELECT GROUP_CONCAT(DISTINCT CONCAT(c.id, ':', c.name) SEPARATOR '||')
                        FROM campaign_preference_attachments cpa
                        JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
                        JOIN campaigns c ON cp.campaign_id = c.id
                        WHERE cpa.attachment_id = a.id AND c.user_id = a.user_id
                    ) AS linked_campaign_pairs
                FROM attachments a
                WHERE {base_where}
            """
            cursor.execute(full_query, base_params)
            all_rows = cursor.fetchall()

            # ── Step 2: Apply filter_global and filter_campaigns in Python ────────

            # Fetch globally-linked attachment IDs once (only when filter needed)
            if filter_global is True or filter_global is False:
                cursor.execute("""
                    SELECT DISTINCT gsa.attachment_id
                    FROM global_settings_attachments gsa
                    JOIN global_settings gs ON gsa.global_settings_id = gs.id
                    WHERE gs.user_id = %s
                """, (user_id,))
                globally_linked_ids = {row["attachment_id"] for row in cursor.fetchall()}
            else:
                globally_linked_ids = None

            # Fetch per-campaign linked attachment ID sets once (only when filter needed)
            campaign_linked_sets: list[set[int]] = []
            if campaign_filter_ids:
                for camp_id in campaign_filter_ids:
                    cursor.execute("""
                        SELECT DISTINCT cpa.attachment_id
                        FROM campaign_preference_attachments cpa
                        JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
                        WHERE cp.campaign_id = %s
                    """, (camp_id,))
                    campaign_linked_sets.append({row["attachment_id"] for row in cursor.fetchall()})

            # Apply filters
            filtered_rows = []
            for row in all_rows:
                att_id = row["id"]

                if filter_global is True and globally_linked_ids is not None:
                    if att_id not in globally_linked_ids:
                        continue
                elif filter_global is False and globally_linked_ids is not None:
                    if att_id in globally_linked_ids:
                        continue

                if campaign_linked_sets:
                    if filter_mode == "all":
                        if not all(att_id in cs for cs in campaign_linked_sets):
                            continue
                    else:  # any (OR)
                        if not any(att_id in cs for cs in campaign_linked_sets):
                            continue

                filtered_rows.append(row)

            total = len(filtered_rows)

            # ── Step 3: Sort ──────────────────────────────────────────────────────
            reverse = sort_dir == "DESC"

            if sort_by == "name":
                filtered_rows.sort(key=lambda r: r["name"].lower(), reverse=reverse)
            elif sort_by == "campaigns":
                filtered_rows.sort(key=lambda r: r["campaign_count"], reverse=reverse)
            elif sort_by == "size":
                def _size(row):
                    ext = Path(row["name"]).suffix.lower()
                    fp  = ATTACHMENT_UPLOAD_DIR / f"{row['id']}{ext}"
                    return fp.stat().st_size if fp.exists() else 0
                filtered_rows.sort(key=_size, reverse=reverse)
            else:
                filtered_rows.sort(key=lambda r: r["created_at"] or "", reverse=True)

            # ── Step 4: Paginate ──────────────────────────────────────────────────
            page_rows = filtered_rows[offset: offset + page_size]

            # ── Step 5: Build response with link data ─────────────────────────────
            attachments = []
            for row in page_rows:
                # Parse linked_campaign_pairs: "id:name||id:name" → [{id, name}]
                linked_campaigns = []
                if row["linked_campaign_pairs"]:
                    for pair in row["linked_campaign_pairs"].split("||"):
                        parts = pair.split(":", 1)
                        if len(parts) == 2:
                            try:
                                linked_campaigns.append({
                                    "id":   int(parts[0]),
                                    "name": parts[1],
                                })
                            except ValueError:
                                pass

                attachments.append({
                    "id":               row["id"],
                    "filename":         row["name"],
                    "created_at":       row["created_at"],
                    "file_size":        get_file_size(row["id"], row["name"]),
                    "linked_global":    row["global_count"] > 0,
                    "linked_campaigns": linked_campaigns,
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
                "SELECT id, name, user_id, created_at FROM attachments WHERE id = %s",
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
                "SELECT name, user_id FROM attachments WHERE id = %s",
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
                "SELECT id FROM attachments WHERE user_id = %s AND name = %s AND id != %s",
                (user_id, full_new_name, attachment_id)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"You already have an attachment named '{full_new_name}'"
                )

            cursor.execute(
                "UPDATE attachments SET name = %s WHERE id = %s",
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