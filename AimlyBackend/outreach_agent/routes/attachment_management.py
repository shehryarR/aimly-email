"""
Attachment Management Routes
Handles attaching/detaching files to emails, campaign preferences, and global settings

NOTE: This router handles MANY-TO-MANY relationships via junction tables.
No optional fields that need NULL handling in this router - it manages:
- email_attachments (email_id, attachment_id)
- campaign_preference_attachments (campaign_preference_id, attachment_id)
- global_settings_attachments (global_settings_id, attachment_id)

All fields in these junction tables are required foreign keys.

BULK LINKS ENDPOINT:
- PUT /attachments/bulk-links/ replaces per-attachment per-campaign GET+PUT loops
- Accepts { attachment_ids, link_global, campaign_ids }
- Resolves all junction table updates in one transaction
- Use for both single and multi-attachment link management
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from pydantic import BaseModel
from core.database.connection import get_connection
from routes.auth import get_current_user

attachment_manager_router = APIRouter(tags=["Attachment Management"])


def verify_attachments_owned_by_user(cursor, attachment_ids: List[int], user_id: int):
    """
    Verify all attachment IDs exist AND belong to the current user.
    Raises HTTPException if any are missing or owned by another user.
    """
    if not attachment_ids:
        return
    placeholders = ','.join(['%s'] * len(attachment_ids))
    cursor.execute(f"""
        SELECT id FROM attachments
        WHERE id IN ({placeholders}) AND user_id = %s
    """, (*attachment_ids, user_id))
    found = {row['id'] for row in cursor.fetchall()}
    missing = set(attachment_ids) - found
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Attachment IDs not found or not owned by you: {missing}"
        )


# ==================================================================================
# PUT /attachments/bulk-links/ - Set link state for multiple attachments at once
#
# Replaces the frontend loop of:
#   for each attachment:
#     GET /global-settings/{gsId}/attachments/ + PUT
#     for each campaign: GET /campaign-preference/{prefId}/attachments/ + PUT
#
# Now: one call handles everything in one transaction.
#
# Body:
#   attachment_ids: list of attachment IDs to update links for
#   link_global:    true = attach all to global settings, false = detach all from global
#   campaign_ids:   list of campaign IDs to LINK to (all others will be UNLINKED)
#                   Pass [] to unlink from all campaigns.
# ==================================================================================
class BulkLinksRequest(BaseModel):
    attachment_ids: List[int]
    link_global: bool
    campaign_ids: List[int]

@attachment_manager_router.put("/attachments/bulk-links/")
async def bulk_update_attachment_links(
    request: BulkLinksRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update global and campaign links for multiple attachments in one transaction.

    For each attachment_id:
    - If link_global=true: ensures it is in global_settings_attachments
    - If link_global=false: ensures it is removed from global_settings_attachments
    - Sets campaign_preference_attachments so the attachment is linked to exactly
      the campaigns in campaign_ids and unlinked from all others the user owns.

    This is an absolute replacement (not additive):
    campaign_ids=[1,2] means "linked to campaigns 1 and 2 only".
    campaign_ids=[]    means "linked to no campaigns".
    """
    user_id = current_user["user_id"]

    if not request.attachment_ids:
        raise HTTPException(status_code=400, detail="attachment_ids must not be empty")

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            # ── Verify all attachments belong to this user ────────────────────────
            verify_attachments_owned_by_user(cursor, request.attachment_ids, user_id)

            # ── Resolve global_settings_id for this user ──────────────────────────
            global_settings_id: int | None = None
            cursor.execute(
                "SELECT id FROM global_settings WHERE user_id = %s",
                (user_id,)
            )
            gs_row = cursor.fetchone()
            if gs_row:
                global_settings_id = gs_row["id"]

            # ── Resolve preference_id for each requested campaign ─────────────────
            # Only include campaigns that belong to this user
            preference_map: dict[int, int] = {}  # campaign_id → preference_id
            if request.campaign_ids:
                camp_placeholders = ','.join(['%s'] * len(request.campaign_ids))
                cursor.execute(f"""
                    SELECT cp.id AS preference_id, cp.campaign_id
                    FROM campaign_preferences cp
                    JOIN campaigns c ON cp.campaign_id = c.id
                    WHERE cp.campaign_id IN ({camp_placeholders}) AND c.user_id = %s
                """, (*request.campaign_ids, user_id))
                for row in cursor.fetchall():
                    preference_map[row["campaign_id"]] = row["preference_id"]

            # ── Fetch ALL preference_ids this user owns (for full unlink sweep) ───
            cursor.execute("""
                SELECT cp.id AS preference_id
                FROM campaign_preferences cp
                JOIN campaigns c ON cp.campaign_id = c.id
                WHERE c.user_id = %s
            """, (user_id,))
            all_user_preference_ids = [row["preference_id"] for row in cursor.fetchall()]

            # ── Apply changes for each attachment ─────────────────────────────────
            att_placeholders = ','.join(['%s'] * len(request.attachment_ids))

            # Global settings links
            if global_settings_id is not None:
                if request.link_global:
                    # Insert for all attachment_ids (ignore if already exists)
                    for att_id in request.attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO global_settings_attachments
                                (global_settings_id, attachment_id)
                            VALUES (%s, %s)
                        """, (global_settings_id, att_id))
                else:
                    # Remove all these attachments from global settings
                    cursor.execute(f"""
                        DELETE FROM global_settings_attachments
                        WHERE global_settings_id = %s
                          AND attachment_id IN ({att_placeholders})
                    """, (global_settings_id, *request.attachment_ids))

            # Campaign preference links
            if all_user_preference_ids:
                pref_placeholders = ','.join(['%s'] * len(all_user_preference_ids))

                # Remove these attachments from ALL of the user's campaign preferences first
                cursor.execute(f"""
                    DELETE FROM campaign_preference_attachments
                    WHERE campaign_preference_id IN ({pref_placeholders})
                      AND attachment_id IN ({att_placeholders})
                """, (*all_user_preference_ids, *request.attachment_ids))

                # Re-insert only the ones that should be linked
                for camp_id in request.campaign_ids:
                    pref_id = preference_map.get(camp_id)
                    if pref_id is None:
                        continue  # campaign not found or not owned by user — skip
                    for att_id in request.attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO campaign_preference_attachments
                                (campaign_preference_id, attachment_id)
                            VALUES (%s, %s)
                        """, (pref_id, att_id))

            conn.commit()

            return {
                "message": "Attachment links updated successfully",
                "attachment_ids": request.attachment_ids,
                "linked_global": request.link_global,
                "linked_campaign_ids": request.campaign_ids,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating attachment links: {str(e)}")


# ==================================================================================
# PUT /email/bulk-attachments/ - Update attachments for multiple emails in one call
# ==================================================================================
class EmailAttachmentUpdate(BaseModel):
    email_id: int
    attachment_ids: List[int]

class BulkEmailAttachmentsRequest(BaseModel):
    updates: List[EmailAttachmentUpdate]

@attachment_manager_router.put("/email/bulk-attachments/")
async def bulk_update_email_attachments(
    request: BulkEmailAttachmentsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update attachments for multiple emails in a single call.
    For each item: flushes existing attachments and replaces with the provided list.
    Skips failures with logged errors and returns a summary.
    """
    user_id = current_user["user_id"]

    if not request.updates:
        raise HTTPException(status_code=400, detail="updates must not be empty")

    updated = 0
    errors = []

    for item in request.updates:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT e.id FROM emails e
                    JOIN campaign_company cc ON e.campaign_company_id = cc.id
                    JOIN campaigns c ON cc.campaign_id = c.id
                    WHERE e.id = %s AND c.user_id = %s
                """, (item.email_id, user_id))

                if not cursor.fetchone():
                    errors.append({"email_id": item.email_id, "reason": "Email not found or access denied"})
                    continue

                verify_attachments_owned_by_user(cursor, item.attachment_ids, user_id)

                cursor.execute("DELETE FROM email_attachments WHERE email_id = %s", (item.email_id,))
                for attachment_id in item.attachment_ids:
                    cursor.execute("""
                        INSERT INTO email_attachments (email_id, attachment_id)
                        VALUES (%s, %s)
                    """, (item.email_id, attachment_id))

                conn.commit()
                updated += 1

        except HTTPException as e:
            errors.append({"email_id": item.email_id, "reason": e.detail})
        except Exception as e:
            errors.append({"email_id": item.email_id, "reason": str(e)})

    return {"updated": updated, "failed": len(errors), "errors": errors}


# ==================================================================================
# PUT /campaign-preference/{preference_id}/attachments
# ==================================================================================
@attachment_manager_router.put("/campaign-preference/{preference_id}/attachments/")
async def update_campaign_preference_attachments(
    preference_id: int,
    attachment_ids: List[int],
    current_user: dict = Depends(get_current_user)
):
    """
    Update attachments for a specific campaign preference.
    Flushes all existing attachments and replaces with the provided list.
    Only attachments owned by the current user can be attached.
    """
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT cp.id FROM campaign_preferences cp
                JOIN campaigns c ON cp.campaign_id = c.id
                WHERE cp.id = %s AND c.user_id = %s
            """, (preference_id, user_id))

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Campaign preference not found or access denied")

            verify_attachments_owned_by_user(cursor, attachment_ids, user_id)

            cursor.execute(
                "DELETE FROM campaign_preference_attachments WHERE campaign_preference_id = %s",
                (preference_id,)
            )

            for attachment_id in attachment_ids:
                cursor.execute("""
                    INSERT INTO campaign_preference_attachments (campaign_preference_id, attachment_id)
                    VALUES (%s, %s)
                """, (preference_id, attachment_id))

            conn.commit()

            return {
                "message": "Campaign preference attachments updated successfully",
                "campaign_preference_id": preference_id,
                "attachments": attachment_ids
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating campaign preference attachments: {str(e)}")


# ==================================================================================
# PUT /global-settings/{settings_id}/attachments
# ==================================================================================
@attachment_manager_router.put("/global-settings/{settings_id}/attachments/")
async def update_global_settings_attachments(
    settings_id: int,
    attachment_ids: List[int],
    current_user: dict = Depends(get_current_user)
):
    """
    Update attachments for global settings.
    Flushes all existing attachments and replaces with the provided list.
    Only attachments owned by the current user can be attached.
    """
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id FROM global_settings
                WHERE id = %s AND user_id = %s
            """, (settings_id, user_id))

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Global settings not found or access denied")

            verify_attachments_owned_by_user(cursor, attachment_ids, user_id)

            cursor.execute(
                "DELETE FROM global_settings_attachments WHERE global_settings_id = %s",
                (settings_id,)
            )

            for attachment_id in attachment_ids:
                cursor.execute("""
                    INSERT INTO global_settings_attachments (global_settings_id, attachment_id)
                    VALUES (%s, %s)
                """, (settings_id, attachment_id))

            conn.commit()

            return {
                "message": "Global settings attachments updated successfully",
                "global_settings_id": settings_id,
                "attachments": attachment_ids
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating global settings attachments: {str(e)}")