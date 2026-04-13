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

BULK DOWNLOAD:
- GET /attachments/download/?ids=1,2,3 replaces the old single GET /attachment/{id}/
- Single file  → returns the file directly with its original filename
- Multiple files → returns a zip archive named "attachments.zip"
- Use for both single (ids=x) and multi-file downloads

LIST RESPONSE:
- GET /attachments/ returns linked_global and linked_campaigns per attachment
- No separate per-attachment link-resolution calls needed on the frontend
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import FileResponse, StreamingResponse
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
import os
import io
import shutil
import zipfile
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
# POST /attachment/ - Upload a new attachment
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
# DELETE /attachments/bulk/ - Bulk delete attachments
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

            for att_id in ids_to_delete:
                original_filename = rows[att_id]["name"]
                file_extension = Path(original_filename).suffix.lower()
                saved_filename = f"{att_id}{file_extension}"
                file_path = ATTACHMENT_UPLOAD_DIR / saved_filename
                if file_path.exists():
                    os.remove(file_path)
                deleted.append(att_id)

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
# GET /attachments/download/?ids=1,2,3 - Bulk download attachments
#
# Replaces the old single GET /attachment/{id}/ endpoint.
# Single file  → streams the file directly with its original filename.
# Multiple files → streams a zip archive named "attachments.zip".
# Use for both single (ids=x) and multi-file downloads.
# ==================================================================================
@attachment_router.get("/attachments/download/")
async def bulk_download_attachments(
    ids: str = Query(..., description="Comma-separated attachment IDs to download"),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated integers")

    if not id_list:
        raise HTTPException(status_code=400, detail="ids must not be empty")

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            placeholders = ','.join(['%s'] * len(id_list))
            cursor.execute(
                f"SELECT id, name, user_id FROM attachments WHERE id IN ({placeholders})",
                id_list
            )
            rows = {row["id"]: row for row in cursor.fetchall()}

        # Ownership + existence checks
        for att_id in id_list:
            if att_id not in rows:
                raise HTTPException(status_code=404, detail=f"Attachment {att_id} not found")
            if rows[att_id]["user_id"] != user_id:
                raise HTTPException(status_code=403, detail=f"Not authorised to download attachment {att_id}")

        # Resolve file paths
        files: list[tuple[str, Path]] = []
        for att_id in id_list:
            original_filename = rows[att_id]["name"]
            file_extension = Path(original_filename).suffix.lower()
            file_path = ATTACHMENT_UPLOAD_DIR / f"{att_id}{file_extension}"
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"File '{original_filename}' not found on disk")
            files.append((original_filename, file_path))

        # ── Single file → return directly ────────────────────────────────────
        if len(files) == 1:
            display_name, file_path = files[0]
            return FileResponse(
                path=file_path,
                filename=display_name,
                media_type="application/octet-stream"
            )

        # ── Multiple files → zip in memory and stream ─────────────────────────
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            seen_names: dict[str, int] = {}
            for display_name, file_path in files:
                # Deduplicate filenames inside the zip
                if display_name in seen_names:
                    seen_names[display_name] += 1
                    stem = Path(display_name).stem
                    ext  = Path(display_name).suffix
                    arc_name = f"{stem} ({seen_names[display_name]}){ext}"
                else:
                    seen_names[display_name] = 0
                    arc_name = display_name
                zf.write(file_path, arcname=arc_name)

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=attachments.zip"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading attachments: {str(e)}")


# ==================================================================================
# GET /attachments/ - List attachments (paginated + search + sort + filter)
# ==================================================================================
@attachment_router.get("/attachments/")
async def list_attachments(
    current_user: dict = Depends(get_current_user),
    page:       int           = Query(1,   ge=1),
    page_size:  int           = Query(20,  ge=1),
    search:     Optional[str] = Query(None),
    sort_by:    Optional[str] = Query(None),
    sort_order: Optional[str] = Query("asc"),
    filter_global:    Optional[bool] = Query(None),
    filter_campaigns: Optional[str]  = Query(None),
    filter_mode:      Optional[str]  = Query("any"),
):
    user_id = current_user["user_id"]
    offset  = (page - 1) * page_size

    campaign_filter_ids: list[int] = []
    if filter_campaigns and filter_campaigns.strip():
        try:
            campaign_filter_ids = [int(x.strip()) for x in filter_campaigns.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="filter_campaigns must be comma-separated integers")

    valid_sort_fields = {"name", "size", "campaigns"}
    if sort_by and sort_by not in valid_sort_fields:
        sort_by = None
    sort_dir = "DESC" if sort_order and sort_order.lower() == "desc" else "ASC"

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            search_condition = ""
            search_params: list = [user_id]
            if search and search.strip():
                search_condition = "AND a.name LIKE %s"
                search_params.append(f"%{search.strip()}%")

            cursor.execute(f"""
                SELECT
                    a.id,
                    a.name,
                    a.created_at,
                    COUNT(DISTINCT cpa.campaign_preference_id) AS campaign_count,
                    COUNT(DISTINCT gsa.global_settings_id)     AS global_count,
                    GROUP_CONCAT(
                        DISTINCT CONCAT(cp.campaign_id, ':', c.name)
                        ORDER BY c.name SEPARATOR '||'
                    ) AS linked_campaign_pairs
                FROM attachments a
                LEFT JOIN campaign_preference_attachments cpa ON cpa.attachment_id = a.id
                LEFT JOIN campaign_preferences cp             ON cp.id = cpa.campaign_preference_id
                LEFT JOIN campaigns c                         ON c.id  = cp.campaign_id
                LEFT JOIN global_settings_attachments gsa     ON gsa.attachment_id = a.id
                WHERE a.user_id = %s {search_condition}
                GROUP BY a.id, a.name, a.created_at
            """, search_params)

            all_rows = cursor.fetchall()

            # ── Resolve filter sets ───────────────────────────────────────────
            globally_linked_ids = None
            if filter_global is not None:
                cursor.execute("SELECT id FROM global_settings WHERE user_id = %s", (user_id,))
                gs_row = cursor.fetchone()
                if gs_row:
                    cursor.execute(
                        "SELECT attachment_id FROM global_settings_attachments WHERE global_settings_id = %s",
                        (gs_row["id"],)
                    )
                    globally_linked_ids = {row["attachment_id"] for row in cursor.fetchall()}
                else:
                    globally_linked_ids = set()

            campaign_linked_sets: list[set] = []
            for cid in campaign_filter_ids:
                cursor.execute("SELECT id FROM campaign_preferences WHERE campaign_id = %s", (cid,))
                pref_row = cursor.fetchone()
                if pref_row:
                    cursor.execute(
                        "SELECT attachment_id FROM campaign_preference_attachments WHERE campaign_preference_id = %s",
                        (pref_row["id"],)
                    )
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
                    else:
                        if not any(att_id in cs for cs in campaign_linked_sets):
                            continue

                filtered_rows.append(row)

            total = len(filtered_rows)

            # Sort
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

            page_rows = filtered_rows[offset: offset + page_size]

            attachments = []
            for row in page_rows:
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
# GET /attachment/{attachment_id}/info/ - Get attachment metadata (no file data)
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
# PUT /attachment/{attachment_id}/ - Rename attachment
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