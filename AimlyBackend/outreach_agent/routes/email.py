"""
Email Management Routes — Core CRUD Operations
Handles fetching, updating, and deleting emails.

BRANDING:
══════════════════════════════════════════════════════════════════════
Branding (signature + logo) is always sourced from the campaign's linked
brand (or the user's default brand). It is baked into the email row at
send/draft/schedule time. It is not editable per-email or per-company.

GET /email/ ATTACHMENT DATA:
  Each email record includes an `attachments` array with id, filename,
  file_size, and created_at. No separate fetch needed on the frontend.
  To download any attachment use GET /attachments/download/?ids=1,2,3
"""

import os
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from pathlib import Path
from core.database.connection import get_connection
from routes.auth import get_current_user
from .utils.email_helpers import (
    MessageResponse,
    BulkUpdateRequest,
    BulkUpdateResponse,
)
from pydantic import BaseModel

ATTACHMENT_STORAGE_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "./data/uploads/attachments")


class BulkDeleteRequest(BaseModel):
    ids: List[int]

email_router = APIRouter(prefix="/email", tags=["Email Management"])


# ==================================================================================
# GET /email/campaign/{campaign_id} - Get all emails for a campaign
# ==================================================================================
@email_router.get("/campaign/{campaign_id}/")
def get_campaign_emails(
    campaign_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    company_ids: Optional[str] = Query(None),
    deletable_only: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
            (campaign_id, user_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        conditions = [
            "cc.campaign_id = %s",
            "camp.user_id = %s",
            "e.status != 'primary'",
        ]
        params: list = [campaign_id, user_id]

        if company_ids and company_ids.strip():
            co_id_list = [int(x.strip()) for x in company_ids.split(",") if x.strip().isdigit()]
            if co_id_list:
                placeholders = ",".join(["%s"] * len(co_id_list))
                conditions.append(f"co.id IN ({placeholders})")
                params.extend(co_id_list)

        if deletable_only:
            conditions.append("e.status IN ('draft', 'scheduled')")
        else:
            valid_statuses = {"sent", "draft", "scheduled", "failed"}
            if status and status.strip() in valid_statuses:
                conditions.append("e.status = %s")
                params.append(status.strip())

        if search and search.strip():
            pattern = f"%{search.strip()}%"
            conditions.append("(e.email_subject LIKE %s OR e.recipient_email LIKE %s)")
            params.extend([pattern, pattern])

        where_clause = " AND ".join(conditions)

        join_clause = """
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN companies co        ON cc.company_id = co.id
            JOIN campaigns camp      ON cc.campaign_id = camp.id
            LEFT JOIN failed_emails fe ON fe.email_id = e.id
        """

        sort_dir_sql = "ASC" if sort_order and sort_order.lower() == "asc" else "DESC"
        if sort_by == "subject":
            order_clause = f"ORDER BY LOWER(e.email_subject) {sort_dir_sql}"
        elif sort_by == "date":
            order_clause = f"ORDER BY COALESCE(e.sent_at, e.created_at) {sort_dir_sql}"
        else:
            order_clause = "ORDER BY e.created_at DESC"

        cursor.execute(f"SELECT COUNT(*) AS total {join_clause} WHERE {where_clause}", params)
        total = cursor.fetchone()["total"]

        offset = (page - 1) * size
        cursor.execute(f"""
            SELECT
                e.id, e.email_subject, e.email_content, e.recipient_email,
                e.status, e.sent_at, e.created_at, e.html_email,
                co.id   AS company_id,
                co.name AS company_name,
                fe.reason AS failed_reason
            {join_clause}
            WHERE {where_clause}
            {order_clause}
            LIMIT %s OFFSET %s
        """, params + [size, offset])

        rows = cursor.fetchall()

    return {
        "emails": [dict(row) for row in rows],
        "total":  total,
        "page":   page,
        "size":   size,
    }


# ==================================================================================
# GET /email/company/{company_id} - Get all emails for a company
# ==================================================================================
@email_router.get("/company/{company_id}/")
def get_company_emails(
    company_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    campaign_ids: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM companies WHERE id = %s AND user_id = %s",
            (company_id, user_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Company not found")

        conditions = ["cc.company_id = %s", "camp.user_id = %s", "e.status != 'primary'"]
        params: list = [company_id, user_id]

        valid_statuses = {"sent", "draft", "scheduled", "failed"}
        if status and status.strip() in valid_statuses:
            conditions.append("e.status = %s")
            params.append(status.strip())

        if campaign_ids and campaign_ids.strip():
            try:
                cid_list = [int(x.strip()) for x in campaign_ids.split(",") if x.strip()]
                if cid_list:
                    placeholders = ",".join(["%s"] * len(cid_list))
                    conditions.append(f"camp.id IN ({placeholders})")
                    params.extend(cid_list)
            except ValueError:
                raise HTTPException(status_code=400, detail="campaign_ids must be comma-separated integers")

        where_clause = " AND ".join(conditions)

        join_clause = """
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN campaigns camp      ON cc.campaign_id = camp.id
            LEFT JOIN failed_emails fe ON fe.email_id = e.id
        """

        sort_dir_sql = "ASC" if sort_order and sort_order.lower() == "asc" else "DESC"
        if sort_by == "subject":
            order_clause = f"ORDER BY LOWER(e.email_subject) {sort_dir_sql}"
        elif sort_by == "date":
            order_clause = f"ORDER BY COALESCE(e.sent_at, e.created_at) {sort_dir_sql}"
        else:
            order_clause = "ORDER BY e.created_at DESC"

        cursor.execute(f"SELECT COUNT(*) AS total {join_clause} WHERE {where_clause}", params)
        total = cursor.fetchone()["total"]

        offset = (page - 1) * size
        cursor.execute(f"""
            SELECT
                e.id, e.email_subject, e.email_content, e.recipient_email,
                e.status, e.sent_at, e.created_at, e.html_email,
                camp.id   AS campaign_id,
                camp.name AS campaign_name,
                fe.reason AS failed_reason
            {join_clause}
            WHERE {where_clause}
            {order_clause}
            LIMIT %s OFFSET %s
        """, params + [size, offset])

        rows = cursor.fetchall()

    return {
        "emails": [dict(row) for row in rows],
        "total": total,
        "page": page,
        "size": size,
    }


# ==================================================================================
# POST /email/campaign/{campaign_id}/primaries/ - Get primary emails for many companies
# ==================================================================================

class BulkPrimaryRequest(BaseModel):
    company_ids: List[int]

@email_router.post("/campaign/{campaign_id}/primaries/")
def get_primary_emails_bulk(
    campaign_id: int,
    request: BulkPrimaryRequest,
    current_user: dict = Depends(get_current_user)
):
    import base64 as _b64

    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM campaigns WHERE id = %s AND user_id = %s", (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        cursor.execute("""
            SELECT cp.inherit_global_settings, cp.inherit_global_attachments, cp.brand_id
            FROM campaign_preferences cp WHERE cp.campaign_id = %s
        """, (campaign_id,))
        campaign_prefs = cursor.fetchone()

        # Resolve branding from campaign's linked brand (or default brand)
        brand_id = campaign_prefs["brand_id"] if campaign_prefs else None
        if brand_id:
            cursor.execute(
                "SELECT signature, logo, logo_mime_type FROM brands WHERE id = %s",
                (brand_id,)
            )
        else:
            cursor.execute(
                "SELECT signature, logo, logo_mime_type FROM brands WHERE user_id = %s AND is_default = 1 LIMIT 1",
                (user_id,)
            )
        brand_row = cursor.fetchone()
        campaign_signature      = brand_row["signature"]      if brand_row else None
        campaign_logo_blob      = brand_row["logo"]           if brand_row else None
        campaign_logo_mime_type = brand_row["logo_mime_type"] if brand_row else None

        placeholders = ",".join(["%s"] * len(request.company_ids))
        cursor.execute(f"""
            SELECT cc.id, cc.company_id, cc.inherit_campaign_attachments
            FROM campaign_company cc
            WHERE cc.campaign_id = %s AND cc.company_id IN ({placeholders})
        """, [campaign_id] + request.company_ids)
        cc_rows = {row["company_id"]: row for row in cursor.fetchall()}

        cc_ids = [row["id"] for row in cc_rows.values()]
        if not cc_ids:
            return {"primaries": []}

        ph2 = ",".join(["%s"] * len(cc_ids))
        cursor.execute(f"""
            SELECT e.id, e.campaign_company_id, e.email_subject, e.email_content,
                   e.recipient_email, e.status, e.timezone, e.sent_at,
                   e.signature, e.logo, e.logo_mime_type, e.html_email
            FROM emails e
            WHERE e.campaign_company_id IN ({ph2}) AND e.status = 'primary'
        """, cc_ids)
        emails_by_cc = {row["campaign_company_id"]: row for row in cursor.fetchall()}

        email_ids = [row["id"] for row in emails_by_cc.values()]
        linked_by_email: dict = {eid: [] for eid in email_ids}
        if email_ids:
            ph3 = ",".join(["%s"] * len(email_ids))
            cursor.execute(f"""
                SELECT ea.email_id, a.id, a.name
                FROM email_attachments ea
                JOIN attachments a ON ea.attachment_id = a.id
                WHERE ea.email_id IN ({ph3})
            """, email_ids)
            for row in cursor.fetchall():
                linked_by_email[row["email_id"]].append({"id": row["id"], "name": row["name"]})

        # ── Resolve campaign-level attachments ────────────────────────────────
        cursor.execute("""
            SELECT a.id, a.name
            FROM attachments a
            JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
            JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
            WHERE cp.campaign_id = %s
        """, (campaign_id,))
        campaign_attachments = [{"id": r["id"], "name": r["name"]} for r in cursor.fetchall()]

        # ── Resolve global-level attachments ─────────────────────────────────
        inherit_global_flag = (
            campaign_prefs["inherit_global_attachments"]
            if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
            else 1
        )
        global_attachments = []
        if inherit_global_flag:
            cursor.execute("""
                SELECT a.id, a.name
                FROM attachments a
                JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
                JOIN global_settings gs ON gsa.global_settings_id = gs.id
                WHERE gs.user_id = %s
            """, (user_id,))
            global_attachments = [{"id": r["id"], "name": r["name"]} for r in cursor.fetchall()]

        cc_id_to_company_id = {row["id"]: cid for cid, row in cc_rows.items()}

        # Build source sets for badge rendering
        campaign_ids_set = {a["id"] for a in campaign_attachments}
        global_ids_set   = {a["id"] for a in global_attachments}

        # Merge campaign + global into a single deduped list.
        # Each entry gets a `sources` list so the frontend can show both badges
        # when an attachment appears in both campaign and global.
        all_inherited_ids = list(campaign_ids_set | global_ids_set)
        # Preserve order: campaign-first, then global-only
        ordered_ids: list[int] = []
        seen_order: set = set()
        for a in campaign_attachments + global_attachments:
            if a["id"] not in seen_order:
                seen_order.add(a["id"])
                ordered_ids.append(a["id"])

        id_to_name = {a["id"]: a["name"] for a in campaign_attachments + global_attachments}
        inherited_attachments_base = [
            {
                "id":      aid,
                "name":    id_to_name[aid],
                "sources": (
                    ["campaign", "global"] if (aid in campaign_ids_set and aid in global_ids_set)
                    else ["campaign"]      if aid in campaign_ids_set
                    else ["global"]
                ),
            }
            for aid in ordered_ids
        ]

        results = []
        for cc_id, email_row in emails_by_cc.items():
            company_id = cc_id_to_company_id.get(cc_id)
            if not company_id:
                continue
            cc = cc_rows[company_id]

            logo_data = None
            if campaign_logo_blob and campaign_logo_mime_type:
                try:
                    logo_data = f"data:{campaign_logo_mime_type};base64,{_b64.b64encode(campaign_logo_blob).decode()}"
                except Exception:
                    logo_data = None

            # own_attachments: files directly linked to this specific email
            own_attachments = linked_by_email.get(email_row["id"], [])

            # inherited_attachments: always resolved so the frontend can show the list
            # immediately when the user toggles it ON mid-session.
            inherited_attachments = inherited_attachments_base  # [] if nothing, [...] if files exist


            r = dict(email_row)
            r["company_id"]                   = company_id
            r["signature"]                    = campaign_signature
            r["logo_data"]                    = logo_data
            r["own_attachments"]              = own_attachments          # [{id, name}]
            r["inherited_attachments"]        = inherited_attachments     # [{id, name, sources:[...]}]
            r["inherit_campaign_attachments"] = cc["inherit_campaign_attachments"]
            r["inherit_global_attachments"]   = inherit_global_flag
            # Keep legacy field for any other consumers
            r["linked_attachment_ids"]        = [a["id"] for a in own_attachments]
            r.pop("logo", None)
            r.pop("logo_mime_type", None)
            results.append(r)

    return {"primaries": results}


# ==================================================================================
# PUT /email/bulk-update/ - Update multiple emails in one call
# ==================================================================================
@email_router.put("/bulk-update/", response_model=BulkUpdateResponse)
def bulk_update_emails(
    request: BulkUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    import base64 as _b64
    from datetime import datetime

    user_id = current_user["user_id"]

    if not request.updates:
        raise HTTPException(status_code=400, detail="updates must not be empty")

    updated_count = 0
    errors = []

    for item in request.updates:
        email_id = item.email_id
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT e.*, cc.campaign_id, c.user_id
                    FROM emails e
                    JOIN campaign_company cc ON e.campaign_company_id = cc.id
                    JOIN campaigns c ON cc.campaign_id = c.id
                    WHERE e.id = %s AND c.user_id = %s
                """, (email_id, user_id))

                email = cursor.fetchone()
                if not email:
                    errors.append({"email_id": email_id, "reason": "Email not found"})
                    continue

                if email["status"] not in ["primary", "draft", "scheduled"]:
                    errors.append({"email_id": email_id, "reason": f"Cannot update email with status '{email['status']}'"})
                    continue

                # Branding (signature/logo) on primary emails is baked in at send time
                # from the campaign's brand — not editable per-email.
                if email["status"] == "primary":
                    if item.signature is not None or item.logo_data is not None or item.logo_clear:
                        errors.append({"email_id": email_id, "reason": "Signature and logo are managed via the campaign's brand and cannot be edited per email"})
                        continue

                update_fields = []
                update_values = []

                if item.email_subject is not None:
                    update_fields.append("email_subject = %s")
                    update_values.append(item.email_subject)

                if item.email_content is not None:
                    update_fields.append("email_content = %s")
                    update_values.append(item.email_content)

                if item.recipient_email is not None:
                    update_fields.append("recipient_email = %s")
                    update_values.append(item.recipient_email)

                if item.status is not None:
                    if item.status not in ["primary", "draft", "scheduled"]:
                        errors.append({"email_id": email_id, "reason": f"Invalid status: {item.status}"})
                        continue
                    update_fields.append("status = %s")
                    update_values.append(item.status)

                if item.timezone is not None:
                    update_fields.append("timezone = %s")
                    update_values.append(item.timezone)

                if item.time is not None:
                    effective_status = item.status or email["status"]
                    if effective_status != "scheduled":
                        errors.append({"email_id": email_id, "reason": "time can only be set on scheduled emails"})
                        continue
                    dt = datetime.fromisoformat(item.time.replace("Z", "+00:00"))
                    update_fields.append("sent_at = %s")
                    update_values.append(dt.strftime("%Y-%m-%d %H:%M:%S"))

                if item.signature is not None:
                    update_fields.append("signature = %s")
                    update_values.append(item.signature if item.signature != "" else None)

                if item.logo_clear:
                    update_fields.append("logo = %s")
                    update_values.append(None)
                    update_fields.append("logo_mime_type = %s")
                    update_values.append(None)
                elif item.logo_data is not None:
                    try:
                        header, encoded = item.logo_data.split(",", 1)
                        mime_type = header.split(";")[0].replace("data:", "")
                        logo_blob = _b64.b64decode(encoded)
                        update_fields.append("logo = %s")
                        update_values.append(logo_blob)
                        update_fields.append("logo_mime_type = %s")
                        update_values.append(mime_type)
                    except Exception:
                        errors.append({"email_id": email_id, "reason": "Invalid logo_data format. Expected base64 data URL."})
                        continue

                if item.html_email is not None:
                    update_fields.append("html_email = %s")
                    update_values.append(1 if item.html_email else 0)

                if not update_fields:
                    updated_count += 1
                    continue

                update_values.append(email_id)
                cursor.execute(
                    f"UPDATE emails SET {', '.join(update_fields)} WHERE id = %s",
                    update_values
                )
                conn.commit()
                updated_count += 1

        except Exception as e:
            print(f"[BulkUpdate] email_id={email_id} failed: {e}")
            errors.append({"email_id": email_id, "reason": str(e)})
            continue

    return BulkUpdateResponse(
        updated=updated_count,
        failed=len(errors),
        errors=errors,
    )


# ==================================================================================
# DELETE /email/ - Delete emails by explicit ID list
# ==================================================================================
@email_router.delete("/", response_model=MessageResponse)
def delete_emails(
    request: BulkDeleteRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        placeholders = ",".join(["%s"] * len(request.ids))
        cursor.execute(f"""
            SELECT e.id
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN campaigns camp      ON cc.campaign_id = camp.id
            WHERE e.id IN ({placeholders})
              AND camp.user_id = %s
              AND e.status != 'primary'
        """, (*request.ids, user_id))

        ids_to_delete = [row["id"] for row in cursor.fetchall()]

        if not ids_to_delete:
            return MessageResponse(message="0 emails deleted")

        try:
            del_ph = ",".join(["%s"] * len(ids_to_delete))
            cursor.execute(f"DELETE FROM emails WHERE id IN ({del_ph})", ids_to_delete)
            deleted_count = cursor.rowcount
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete emails: {str(e)}")

    return MessageResponse(message=f"{deleted_count} email{'' if deleted_count == 1 else 's'} deleted successfully")


# ==================================================================================
# GET /email/ids/ - Get IDs of all matching emails (no pagination cap)
# ==================================================================================
@email_router.get("/ids/")
def get_email_ids(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    company_ids: Optional[str] = Query(None),
    campaign_ids: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    conditions = ["camp.user_id = %s", "e.status != 'primary'"]
    params: list = [user_id]

    valid_statuses = {"sent", "draft", "scheduled", "failed"}
    if status and status.strip() in valid_statuses:
        conditions.append("e.status = %s")
        params.append(status.strip())

    if company_ids and company_ids.strip():
        co_list = [int(x) for x in company_ids.split(",") if x.strip().isdigit()]
        if co_list:
            conditions.append(f"co.id IN ({','.join(['%s']*len(co_list))})")
            params.extend(co_list)

    if campaign_ids and campaign_ids.strip():
        ca_list = [int(x) for x in campaign_ids.split(",") if x.strip().isdigit()]
        if ca_list:
            conditions.append(f"camp.id IN ({','.join(['%s']*len(ca_list))})")
            params.extend(ca_list)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append("(e.email_subject LIKE %s OR e.recipient_email LIKE %s)")
        params.extend([pattern, pattern])

    where_clause = " AND ".join(conditions)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT e.id
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN companies co        ON cc.company_id = co.id
            JOIN campaigns camp      ON cc.campaign_id = camp.id
            WHERE {where_clause}
        """, params)
        ids = [row["id"] for row in cursor.fetchall()]

    return {"ids": ids}


# ==================================================================================
# GET /email/ - Get ALL emails across every campaign and company (unified history)
#
# NOTE: Must be defined LAST so FastAPI does not match /email/campaign/1/ here.
#
# Each email record now includes:
#   attachments: [{ id, filename, file_size, created_at }]
# No separate attachment fetch needed on the frontend.
# To download, use GET /attachments/download/?ids=1,2,3
# ==================================================================================
@email_router.get("/")
def get_all_emails(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    company_ids: Optional[str] = Query(None),
    campaign_ids: Optional[str] = Query(None),
    email_ids: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    import base64 as _b64

    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        conditions = [
            "camp.user_id = %s",
            "e.status != 'primary'",
        ]
        params: list = [user_id]

        if email_ids and email_ids.strip():
            em_id_list = [int(x.strip()) for x in email_ids.split(",") if x.strip().isdigit()]
            if em_id_list:
                placeholders = ",".join(["%s"] * len(em_id_list))
                conditions.append(f"e.id IN ({placeholders})")
                params.extend(em_id_list)

        if company_ids and company_ids.strip():
            co_id_list = [int(x.strip()) for x in company_ids.split(",") if x.strip().isdigit()]
            if co_id_list:
                placeholders = ",".join(["%s"] * len(co_id_list))
                conditions.append(f"co.id IN ({placeholders})")
                params.extend(co_id_list)

        if campaign_ids and campaign_ids.strip():
            ca_id_list = [int(x.strip()) for x in campaign_ids.split(",") if x.strip().isdigit()]
            if ca_id_list:
                placeholders = ",".join(["%s"] * len(ca_id_list))
                conditions.append(f"camp.id IN ({placeholders})")
                params.extend(ca_id_list)

        valid_statuses = {"sent", "draft", "scheduled", "failed"}
        if status and status.strip() in valid_statuses:
            conditions.append("e.status = %s")
            params.append(status.strip())

        if search and search.strip():
            pattern = f"%{search.strip()}%"
            conditions.append("(e.email_subject LIKE %s OR e.recipient_email LIKE %s)")
            params.extend([pattern, pattern])

        where_clause = " AND ".join(conditions)

        join_clause = """
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN companies co        ON cc.company_id = co.id
            JOIN campaigns camp      ON cc.campaign_id = camp.id
            LEFT JOIN failed_emails fe ON fe.email_id = e.id
        """

        sort_dir_sql = "ASC" if sort_order and sort_order.lower() == "asc" else "DESC"
        if sort_by == "subject":
            order_clause = f"ORDER BY LOWER(e.email_subject) {sort_dir_sql}"
        elif sort_by == "date":
            order_clause = f"ORDER BY COALESCE(e.sent_at, e.created_at) {sort_dir_sql}"
        else:
            order_clause = "ORDER BY e.created_at DESC"

        cursor.execute(
            f"SELECT COUNT(*) AS total {join_clause} WHERE {where_clause}",
            params
        )
        total = cursor.fetchone()["total"]

        # attachment_data uses ASCII unit-separator (\x1f) between fields within
        # one attachment, and ASCII record-separator (\x1e) between attachments.
        # These characters are safe against any real-world filename content.
        offset = (page - 1) * size
        cursor.execute(f"""
            SELECT
                e.id, e.email_subject, e.email_content, e.recipient_email,
                e.status, e.sent_at, e.read_at, e.created_at, e.html_email,
                e.signature, e.logo, e.logo_mime_type,
                co.id     AS company_id,
                co.name   AS company_name,
                camp.id   AS campaign_id,
                camp.name AS campaign_name,
                fe.reason AS failed_reason,
                (
                    SELECT GROUP_CONCAT(
                        CONCAT(a.id, '\x1f', a.name, '\x1f', COALESCE(a.created_at, ''))
                        ORDER BY a.name SEPARATOR '\x1e'
                    )
                    FROM email_attachments ea
                    JOIN attachments a ON ea.attachment_id = a.id
                    WHERE ea.email_id = e.id
                ) AS attachment_data
            {join_clause}
            WHERE {where_clause}
            {order_clause}
            LIMIT %s OFFSET %s
        """, params + [size, offset])

        rows = cursor.fetchall()

    email_list = []
    for row in rows:
        r = dict(row)

        # Decode logo blob → base64 data URL
        logo_blob = r.pop("logo", None)
        logo_mime = r.pop("logo_mime_type", None)
        r["logo_data"] = (
            f"data:{logo_mime};base64,{_b64.b64encode(logo_blob).decode()}"
            if logo_blob and logo_mime else None
        )

        # Parse attachment_data → structured list
        # Format: "id\x1fname\x1fcreated_at\x1eid\x1fname\x1fcreated_at"
        raw_att = r.pop("attachment_data", None)
        attachments_out = []
        if raw_att:
            for entry in raw_att.split("\x1e"):
                parts = entry.split("\x1f", 2)
                if len(parts) == 3:
                    try:
                        att_id      = int(parts[0])
                        att_name    = parts[1]
                        att_created = parts[2] or None
                        att_ext     = Path(att_name).suffix.lower()
                        att_path    = Path(ATTACHMENT_STORAGE_PATH) / f"{att_id}{att_ext}"
                        att_size    = att_path.stat().st_size if att_path.exists() else 0
                        attachments_out.append({
                            "id":         att_id,
                            "filename":   att_name,
                            "created_at": att_created,
                            "file_size":  att_size,
                        })
                    except (ValueError, Exception):
                        pass

        r["attachments"] = attachments_out
        email_list.append(r)

    return {
        "emails": email_list,
        "total":  total,
        "page":   page,
        "size":   size,
    }