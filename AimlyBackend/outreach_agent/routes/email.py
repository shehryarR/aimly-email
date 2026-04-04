"""
Email Management Routes — Core CRUD Operations
Handles fetching, updating, and deleting emails.

INHERITANCE RULES:
══════════════════════════════════════════════════════════════════════

READING PRIMARY EMAIL (branding: signature + logo):
  inherit_campaign_branding = 0 → use email's own signature/logo, no fallback
  inherit_campaign_branding = 1:
    inherit_global_settings = 0 → use campaign signature/logo, no fallback
    inherit_global_settings = 1 → use global signature/logo, no fallback

UPDATING PRIMARY EMAIL:
  inherit_campaign_branding = 1 → signature and logo fields cannot be edited.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from core.database.connection import get_connection
from routes.auth import get_current_user
from .utils.email_helpers import (
    MessageResponse,
    BulkUpdateRequest,
    BulkUpdateResponse,
    resolve_branding,
    resolve_attachment_ids_for_primary,
)
from pydantic import BaseModel


class BulkDeleteRequest(BaseModel):
    ids: List[int]

email_router = APIRouter(prefix="/email", tags=["Email Management"])


# ==================================================================================
# GET /email/campaign/{campaign_id} - Get all emails for a campaign
#
# Query params:
#   page          — page number (default 1)
#   size          — page size (default 20, max 500)
#   search        — filter by email_subject OR recipient_email (case-insensitive)
#   status        — filter by status: sent | draft | scheduled | failed
#   sort_by       — sort field: date | subject  (default: created_at DESC)
#   sort_order    — asc | desc  (default: desc)
#   company_ids   — comma-separated company IDs to filter; omit or empty = all companies
#   deletable_only— true = return only draft/scheduled emails (used for bulk-delete)
# ==================================================================================
@email_router.get("/campaign/{campaign_id}/")
def get_campaign_emails(
    campaign_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search by email subject or recipient email"),
    status: Optional[str] = Query(None, description="sent | draft | scheduled | failed"),
    sort_by: Optional[str] = Query(None, description="date | subject"),
    sort_order: Optional[str] = Query("desc", description="asc | desc"),
    company_ids: Optional[str] = Query(None, description="Comma-separated company IDs; empty = all"),
    deletable_only: bool = Query(False, description="Return only draft/scheduled emails"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get emails for a campaign with full server-side filtering, sorting, and pagination.

    - company_ids omitted/empty  → all companies in the campaign (no filter)
    - company_ids=1,2,3          → only emails belonging to those companies
    - deletable_only=true        → ignores status param, returns draft+scheduled only
                                   (for bulk-delete: collect IDs before deleting)
    - Returns company_id and company_name on every email record.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # Verify campaign belongs to user
        cursor.execute(
            "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
            (campaign_id, user_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        # ── Build WHERE conditions ─────────────────────────────────────────────
        conditions = [
            "cc.campaign_id = %s",
            "camp.user_id = %s",
            "e.status != 'primary'",
        ]
        params: list = [campaign_id, user_id]

        # Optional company filter — omit or empty means all companies
        if company_ids and company_ids.strip():
            co_id_list = [
                int(x.strip()) for x in company_ids.split(",") if x.strip().isdigit()
            ]
            if co_id_list:
                placeholders = ",".join(["%s"] * len(co_id_list))
                conditions.append(f"co.id IN ({placeholders})")
                params.extend(co_id_list)

        # Status filter — deletable_only overrides status param
        if deletable_only:
            conditions.append("e.status IN ('draft', 'scheduled')")
        else:
            valid_statuses = {"sent", "draft", "scheduled", "failed"}
            if status and status.strip() in valid_statuses:
                conditions.append("e.status = %s")
                params.append(status.strip())

        # Search filter — subject OR recipient email
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

        # ── ORDER BY ──────────────────────────────────────────────────────────
        sort_dir_sql = "ASC" if sort_order and sort_order.lower() == "asc" else "DESC"
        if sort_by == "subject":
            order_clause = f"ORDER BY LOWER(e.email_subject) {sort_dir_sql}"
        elif sort_by == "date":
            order_clause = f"ORDER BY COALESCE(e.sent_at, e.created_at) {sort_dir_sql}"
        else:
            order_clause = "ORDER BY e.created_at DESC"

        # ── Total count ────────────────────────────────────────────────────────
        cursor.execute(
            f"SELECT COUNT(*) AS total {join_clause} WHERE {where_clause}",
            params
        )
        total = cursor.fetchone()["total"]

        # ── Paginated results ──────────────────────────────────────────────────
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

    email_list = [dict(row) for row in rows]

    return {
        "emails": email_list,
        "total":  total,
        "page":   page,
        "size":   size,
    }


# ==================================================================================
# GET /email/company/{company_id} - Get all emails for a company
#
# Query params:
#   page         — page number (default 1)
#   size         — page size (default 20, max 500)
#   status       — filter by status: sent | draft | scheduled | failed | primary
#   sort_by      — sort field: date | subject  (default: created_at DESC)
#   sort_order   — asc | desc  (default: desc)
#   campaign_ids — comma-separated campaign IDs to filter by (OR logic)
# ==================================================================================
@email_router.get("/company/{company_id}/")
def get_company_emails(
    company_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    status: Optional[str] = Query(None, description="sent | draft | scheduled | failed"),
    sort_by: Optional[str] = Query(None, description="date | subject"),
    sort_order: Optional[str] = Query("desc", description="asc | desc"),
    campaign_ids: Optional[str] = Query(None, description="Comma-separated campaign IDs (OR filter)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all emails belonging to a company across all campaigns.
    Returns campaign_id and campaign_name on every email record.
    Primary emails are always excluded.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # Verify company belongs to user
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

        cursor.execute(
            f"SELECT COUNT(*) AS total {join_clause} WHERE {where_clause}",
            params
        )
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
    """
    Get primary emails for multiple companies in a campaign in one call.
    Returns a list of results keyed by company_id.
    Companies with no primary email are omitted from the response.
    Branding and attachment resolution follows the same rules as the single endpoint.
    """
    import base64 as _b64

    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM campaigns WHERE id = %s AND user_id = %s", (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Load campaign prefs and global prefs once
        cursor.execute("""
            SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
            FROM campaign_preferences WHERE campaign_id = %s
        """, (campaign_id,))
        campaign_prefs = cursor.fetchone()

        cursor.execute("""
            SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = %s
        """, (user_id,))
        global_prefs = cursor.fetchone()

        # Fetch all campaign_company rows for the requested companies in one query
        placeholders = ",".join(["%s"] * len(request.company_ids))
        cursor.execute(f"""
            SELECT cc.id, cc.company_id, cc.inherit_campaign_branding, cc.inherit_campaign_attachments
            FROM campaign_company cc
            WHERE cc.campaign_id = %s AND cc.company_id IN ({placeholders})
        """, [campaign_id] + request.company_ids)
        cc_rows = {row["company_id"]: row for row in cursor.fetchall()}

        # Fetch all primary emails for those campaign_company rows in one query
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

        # Fetch linked attachment IDs for all primary emails in one query
        email_ids = [row["id"] for row in emails_by_cc.values()]
        linked_by_email: dict = {eid: [] for eid in email_ids}
        if email_ids:
            ph3 = ",".join(["%s"] * len(email_ids))
            cursor.execute(f"""
                SELECT email_id, attachment_id FROM email_attachments
                WHERE email_id IN ({ph3})
            """, email_ids)
            for row in cursor.fetchall():
                linked_by_email[row["email_id"]].append(row["attachment_id"])

        # Map company_id -> cc_id for reverse lookup
        cc_id_to_company_id = {row["id"]: cid for cid, row in cc_rows.items()}

        inherit_global_attachments = (
            campaign_prefs["inherit_global_attachments"]
            if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
            else 1
        )

        results = []
        for cc_id, email_row in emails_by_cc.items():
            company_id = cc_id_to_company_id.get(cc_id)
            if not company_id:
                continue
            cc = cc_rows[company_id]

            signature, logo_blob, logo_mime_type = resolve_branding(
                email_row, campaign_prefs, global_prefs, cc["inherit_campaign_branding"]
            )

            logo_data = None
            if logo_blob and logo_mime_type:
                try:
                    logo_data = f"data:{logo_mime_type};base64,{_b64.b64encode(logo_blob).decode()}"
                except Exception:
                    logo_data = None

            attachment_ids = resolve_attachment_ids_for_primary(
                email_row["id"], campaign_id, user_id, cursor,
                cc["inherit_campaign_attachments"], inherit_global_attachments
            )

            r = dict(email_row)
            r["company_id"] = company_id
            r["signature"] = signature
            r["logo_data"] = logo_data
            r["attachment_ids"] = attachment_ids
            r["linked_attachment_ids"] = linked_by_email.get(email_row["id"], [])
            r["inherit_campaign_attachments"] = cc["inherit_campaign_attachments"]
            r["inherit_campaign_branding"] = cc["inherit_campaign_branding"]
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
    """
    Update multiple emails in a single call.
    Each item in updates must include email_id plus any fields to update.
    Skips failures with logged errors and returns a summary.
    Allowed statuses: primary, draft, scheduled.
    When primary and inherit_campaign_branding = 1, signature/logo cannot be edited.
    """
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
                    SELECT e.*, cc.campaign_id, cc.inherit_campaign_branding, c.user_id
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

                if email["status"] == "primary" and email["inherit_campaign_branding"]:
                    if item.signature is not None or item.logo_data is not None or item.logo_clear:
                        errors.append({"email_id": email_id, "reason": "Cannot edit signature or logo while inherit_campaign_branding is enabled"})
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
    """
    Delete emails by ID list. Ownership verified, primary emails skipped.
    """
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
#
# Same filters as GET /email/ but returns only IDs — used for select-all + delete.
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
# Query params:
#   page          — page number (default 1)
#   size          — page size (default 20, max 500)
#   search        — filter by email_subject OR recipient_email (case-insensitive)
#   status        — filter by status: sent | draft | scheduled | failed
#   sort_by       — sort field: date | subject  (default: created_at DESC)
#   sort_order    — asc | desc  (default: desc)
#   company_ids   — comma-separated company IDs to filter by (OR logic); omit = all
#   campaign_ids  — comma-separated campaign IDs to filter by (OR logic); omit = all
#   email_ids     — comma-separated email IDs to fetch specific emails; omit = all
#
# NOTE: This route MUST be defined after all other /email/* routes so that FastAPI's
# router does not match e.g. /email/campaign/1/ against this handler first.
# ==================================================================================
@email_router.get("/")
def get_all_emails(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search by email subject or recipient email"),
    status: Optional[str] = Query(None, description="sent | draft | scheduled | failed"),
    sort_by: Optional[str] = Query(None, description="date | subject"),
    sort_order: Optional[str] = Query("desc", description="asc | desc"),
    company_ids: Optional[str] = Query(None, description="Comma-separated company IDs (OR filter); omit = all"),
    campaign_ids: Optional[str] = Query(None, description="Comma-separated campaign IDs (OR filter); omit = all"),
    email_ids: Optional[str] = Query(None, description="Comma-separated email IDs to fetch specific emails; omit = all"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get ALL emails for the authenticated user across every campaign and company.
    Primary emails are always excluded.

    Returns both company_id / company_name AND campaign_id / campaign_name on every
    email record so the unified history page can display both tags simultaneously.
    Also returns logo_data (base64 data URL) and signature on every record.

    Filter logic:
      - email_ids    provided             → fetch only those specific emails (AND with other filters)
      - company_ids  omitted/empty        → no company restriction (all companies)
      - campaign_ids omitted/empty        → no campaign restriction (all campaigns)
      - Both company_ids & campaign_ids   → AND between the two groups
      - Within each group                 → OR logic (any matching ID qualifies)
    """
    import base64 as _b64

    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Build WHERE conditions ─────────────────────────────────────────────
        conditions = [
            "camp.user_id = %s",
            "e.status != 'primary'",
        ]
        params: list = [user_id]

        # Optional email IDs filter
        if email_ids and email_ids.strip():
            em_id_list = [
                int(x.strip()) for x in email_ids.split(",") if x.strip().isdigit()
            ]
            if em_id_list:
                placeholders = ",".join(["%s"] * len(em_id_list))
                conditions.append(f"e.id IN ({placeholders})")
                params.extend(em_id_list)

        # Optional company filter
        if company_ids and company_ids.strip():
            co_id_list = [
                int(x.strip()) for x in company_ids.split(",") if x.strip().isdigit()
            ]
            if co_id_list:
                placeholders = ",".join(["%s"] * len(co_id_list))
                conditions.append(f"co.id IN ({placeholders})")
                params.extend(co_id_list)

        # Optional campaign filter
        if campaign_ids and campaign_ids.strip():
            ca_id_list = [
                int(x.strip()) for x in campaign_ids.split(",") if x.strip().isdigit()
            ]
            if ca_id_list:
                placeholders = ",".join(["%s"] * len(ca_id_list))
                conditions.append(f"camp.id IN ({placeholders})")
                params.extend(ca_id_list)

        # Status filter
        valid_statuses = {"sent", "draft", "scheduled", "failed"}
        if status and status.strip() in valid_statuses:
            conditions.append("e.status = %s")
            params.append(status.strip())

        # Search filter — subject OR recipient email
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

        # ── ORDER BY ──────────────────────────────────────────────────────────
        sort_dir_sql = "ASC" if sort_order and sort_order.lower() == "asc" else "DESC"
        if sort_by == "subject":
            order_clause = f"ORDER BY LOWER(e.email_subject) {sort_dir_sql}"
        elif sort_by == "date":
            order_clause = f"ORDER BY COALESCE(e.sent_at, e.created_at) {sort_dir_sql}"
        else:
            order_clause = "ORDER BY e.created_at DESC"

        # ── Total count ────────────────────────────────────────────────────────
        cursor.execute(
            f"SELECT COUNT(*) AS total {join_clause} WHERE {where_clause}",
            params
        )
        total = cursor.fetchone()["total"]

        # ── Paginated results ──────────────────────────────────────────────────
        offset = (page - 1) * size
        cursor.execute(f"""
            SELECT
                e.id, e.email_subject, e.email_content, e.recipient_email,
                e.status, e.sent_at, e.created_at, e.html_email,
                e.signature, e.logo, e.logo_mime_type,
                co.id     AS company_id,
                co.name   AS company_name,
                camp.id   AS campaign_id,
                camp.name AS campaign_name,
                fe.reason AS failed_reason
            {join_clause}
            WHERE {where_clause}
            {order_clause}
            LIMIT %s OFFSET %s
        """, params + [size, offset])

        rows = cursor.fetchall()

    # ── Post-process: decode logo blob → base64 data URL ──────────────────────
    email_list = []
    for row in rows:
        r = dict(row)
        logo_blob = r.pop("logo", None)
        logo_mime = r.pop("logo_mime_type", None)
        r["logo_data"] = (
            f"data:{logo_mime};base64,{_b64.b64encode(logo_blob).decode()}"
            if logo_blob and logo_mime else None
        )
        email_list.append(r)

    return {
        "emails": email_list,
        "total":  total,
        "page":   page,
        "size":   size,
    }