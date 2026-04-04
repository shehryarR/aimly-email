"""
Category-Company Membership Routes
Handles adding and removing companies from a category.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from core.database.connection import get_connection
from routes.auth import get_current_user

category_company_router = APIRouter(tags=["Category-Company"])


class MessageResponse(BaseModel):
    message: str
    success: bool = True
    added: int = 0
    removed: int = 0


# ==================================================================================
# POST /category/bulk-assign/ - Add companies to multiple categories at once
# ==================================================================================
class BulkCategoryAssignRequest(BaseModel):
    company_ids: List[int]
    category_ids: List[int]

@category_company_router.post("/category/bulk-assign/", response_model=MessageResponse)
def bulk_assign_to_categories(
    request: BulkCategoryAssignRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Add one or more companies to multiple categories in a single call.
    Already-enrolled combinations are silently skipped.
    """
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")
    if not request.category_ids:
        raise HTTPException(status_code=400, detail="category_ids must not be empty")

    total_added = 0
    errors = []

    for category_id in request.category_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT id FROM categories WHERE id = %s AND user_id = %s",
                    (category_id, user_id),
                )
                if not cursor.fetchone():
                    errors.append({"category_id": category_id, "reason": "Category not found"})
                    continue

                for company_id in request.company_ids:
                    cursor.execute(
                        "SELECT id FROM companies WHERE id = %s AND user_id = %s",
                        (company_id, user_id),
                    )
                    if not cursor.fetchone():
                        continue
                    cursor.execute(
                        "INSERT IGNORE INTO category_company (category_id, company_id) VALUES (%s, %s)",
                        (category_id, company_id),
                    )
                    if cursor.rowcount > 0:
                        total_added += 1

                conn.commit()

        except Exception as e:
            errors.append({"category_id": category_id, "reason": str(e)})
            continue

    return MessageResponse(
        message=f"Added {total_added} company-category links" + (f", {len(errors)} categories failed" if errors else ""),
        success=len(errors) == 0,
        added=total_added,
    )


# ==================================================================================
# POST /category/bulk-remove/ - Remove companies from multiple categories at once
# ==================================================================================
class BulkCategoryRemoveRequest(BaseModel):
    company_ids: List[int]
    category_ids: List[int]

@category_company_router.post("/category/bulk-remove/", response_model=MessageResponse)
def bulk_remove_from_categories(
    request: BulkCategoryRemoveRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Remove one or more companies from multiple categories in a single call.
    """
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")
    if not request.category_ids:
        raise HTTPException(status_code=400, detail="category_ids must not be empty")

    total_removed = 0
    errors = []

    for category_id in request.category_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT id FROM categories WHERE id = %s AND user_id = %s",
                    (category_id, user_id),
                )
                if not cursor.fetchone():
                    errors.append({"category_id": category_id, "reason": "Category not found"})
                    continue

                ph = ",".join(["%s"] * len(request.company_ids))
                cursor.execute(
                    f"DELETE FROM category_company WHERE category_id = %s AND company_id IN ({ph})",
                    [category_id] + request.company_ids,
                )
                total_removed += cursor.rowcount
                conn.commit()

        except Exception as e:
            errors.append({"category_id": category_id, "reason": str(e)})
            continue

    return MessageResponse(
        message=f"Removed {total_removed} company-category links" + (f", {len(errors)} categories failed" if errors else ""),
        success=len(errors) == 0,
        removed=total_removed,
    )