"""
Attachment Management Routes
Handles attaching/detaching files to emails, campaign preferences, and global settings

NOTE: This router handles MANY-TO-MANY relationships via junction tables.
No optional fields that need NULL handling in this router - it manages:
- email_attachments (email_id, attachment_id)
- campaign_preference_attachments (campaign_preference_id, attachment_id)
- global_settings_attachments (global_settings_id, attachment_id)

All fields in these junction tables are required foreign keys.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
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
# PUT /email/bulk-attachments/ - Update attachments for multiple emails in one call
# ==================================================================================
from pydantic import BaseModel

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
    
    Behavior:
    - Flushes all existing attachments
    - Adds the new ones in the list
    - Only attachments owned by the current user can be attached
    
    attachment_ids: List of attachment IDs to attach to this campaign preference
    - Empty list [] → Removes all attachments
    - Non-empty list [1, 2, 3] → Replaces all attachments with these IDs
    """
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            # Verify the campaign preference exists and belongs to the current user
            cursor.execute("""
                SELECT cp.id FROM campaign_preferences cp
                JOIN campaigns c ON cp.campaign_id = c.id
                WHERE cp.id = %s AND c.user_id = %s
            """, (preference_id, user_id))

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Campaign preference not found or access denied")

            # Verify all attachments exist and are owned by this user
            verify_attachments_owned_by_user(cursor, attachment_ids, user_id)

            # Flush and replace
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
    
    Behavior:
    - Flushes all existing attachments
    - Adds the new ones in the list
    - Only attachments owned by the current user can be attached
    
    attachment_ids: List of attachment IDs to attach to global settings
    - Empty list [] → Removes all attachments
    - Non-empty list [1, 2, 3] → Replaces all attachments with these IDs
    """
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            # Verify the global settings exist and belong to the current user
            cursor.execute("""
                SELECT id FROM global_settings
                WHERE id = %s AND user_id = %s
            """, (settings_id, user_id))

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Global settings not found or access denied")

            # Verify all attachments exist and are owned by this user
            verify_attachments_owned_by_user(cursor, attachment_ids, user_id)

            # Flush and replace
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


# ==================================================================================
# GET /email/{email_id}/attachments
# ==================================================================================
@attachment_manager_router.get("/email/{email_id}/attachments/")
async def get_email_attachments(
    email_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all attachments for a specific email"""
    user_id = current_user["user_id"]

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT e.id FROM emails e
                JOIN campaign_company cc ON e.campaign_company_id = cc.id
                JOIN campaigns c ON cc.campaign_id = c.id
                WHERE e.id = %s AND c.user_id = %s
            """, (email_id, user_id))

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Email not found or access denied")

            cursor.execute("""
                SELECT a.id, a.name, a.created_at
                FROM attachments a
                JOIN email_attachments ea ON a.id = ea.attachment_id
                WHERE ea.email_id = %s
                ORDER BY ea.created_at DESC
            """, (email_id,))

            return {
                "email_id": email_id,
                "attachments": [dict(row) for row in cursor.fetchall()]
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attachments: {str(e)}")


# ==================================================================================
# GET /campaign-preference/{preference_id}/attachments
# ==================================================================================
@attachment_manager_router.get("/campaign-preference/{preference_id}/attachments/")
async def get_campaign_preference_attachments(
    preference_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all attachments for a specific campaign preference"""
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

            cursor.execute("""
                SELECT a.id, a.name, a.created_at
                FROM attachments a
                JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
                WHERE cpa.campaign_preference_id = %s
                ORDER BY cpa.created_at DESC
            """, (preference_id,))

            return {
                "campaign_preference_id": preference_id,
                "attachments": [dict(row) for row in cursor.fetchall()]
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attachments: {str(e)}")


# ==================================================================================
# GET /global-settings/{settings_id}/attachments
# ==================================================================================
@attachment_manager_router.get("/global-settings/{settings_id}/attachments/")
async def get_global_settings_attachments(
    settings_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all attachments for global settings"""
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

            cursor.execute("""
                SELECT a.id, a.name, a.created_at
                FROM attachments a
                JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
                WHERE gsa.global_settings_id = %s
                ORDER BY gsa.created_at DESC
            """, (settings_id,))

            return {
                "global_settings_id": settings_id,
                "attachments": [dict(row) for row in cursor.fetchall()]
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attachments: {str(e)}")