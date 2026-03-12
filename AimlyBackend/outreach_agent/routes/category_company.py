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
# POST /category/{category_id}/company/
# Add companies to a category
# ==================================================================================
@category_company_router.post("/category/{category_id}/company/", response_model=MessageResponse)
def add_companies_to_category(
    category_id: int,
    company_ids: List[int],
    current_user: dict = Depends(get_current_user),
):
    """
    Add companies to a category.

    - Companies already in the category are silently skipped.
    - Company IDs not owned by the current user are silently skipped.
    """
    user_id = current_user["user_id"]

    if not company_ids:
        raise HTTPException(status_code=400, detail="No company IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?",
            (category_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Category not found")

        try:
            added = 0
            for company_id in company_ids:
                cursor.execute(
                    "SELECT id FROM companies WHERE id = ? AND user_id = ?",
                    (company_id, user_id),
                )
                if not cursor.fetchone():
                    continue

                cursor.execute(
                    "INSERT OR IGNORE INTO category_company (category_id, company_id) VALUES (?, ?)",
                    (category_id, company_id),
                )
                if cursor.rowcount > 0:
                    added += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to add companies: {str(e)}")

    return MessageResponse(
        message=f"Successfully added {added} companies to category",
        success=True,
        added=added,
    )


# ==================================================================================
# DELETE /category/{category_id}/company/
# Remove companies from a category
# ==================================================================================
@category_company_router.delete("/category/{category_id}/company/", response_model=MessageResponse)
def remove_companies_from_category(
    category_id: int,
    ids: str = Query(..., description="Comma-separated company IDs to remove"),
    current_user: dict = Depends(get_current_user),
):
    """
    Remove specific companies from a category.
    The companies themselves are NOT deleted — only the membership is removed.
    """
    user_id = current_user["user_id"]
    company_ids = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]

    if not company_ids:
        raise HTTPException(status_code=400, detail="No valid company IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?",
            (category_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Category not found")

        try:
            placeholders = ",".join(["?"] * len(company_ids))
            cursor.execute(
                f"""
                DELETE FROM category_company
                WHERE category_id = ? AND company_id IN ({placeholders})
                """,
                [category_id] + company_ids,
            )
            removed = cursor.rowcount
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to remove companies: {str(e)}")

    return MessageResponse(
        message=f"Successfully removed {removed} companies from category",
        success=True,
        removed=removed,
    )


# ==================================================================================
# GET /category/{category_id}/company/
# Get all companies belonging to a category
# ==================================================================================
@category_company_router.get("/category/{category_id}/company/")
def get_category_companies(
    category_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search by company name or email"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?",
            (category_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Category not found")

        conditions = ["cc.category_id = ?", "co.user_id = ?"]
        params: list = [category_id, user_id]

        if search and search.strip():
            conditions.append("(co.name LIKE ? OR co.email LIKE ?)")
            params.extend([f"%{search.strip()}%", f"%{search.strip()}%"])

        where_str = " AND ".join(conditions)

        cursor.execute(
            f"SELECT COUNT(*) AS total FROM category_company cc JOIN companies co ON cc.company_id = co.id WHERE {where_str}",
            params,
        )
        total = cursor.fetchone()["total"]

        offset = (page - 1) * size
        cursor.execute(
            f"""
            SELECT co.id, co.user_id, co.name, co.email, co.phone_number,
                   co.address, co.company_info, co.created_at
            FROM category_company cc
            JOIN companies co ON cc.company_id = co.id
            WHERE {where_str}
            ORDER BY cc.created_at DESC
            LIMIT ? OFFSET ?
            """,
            params + [size, offset],
        )
        rows = cursor.fetchall()

    return {
        "category_id": category_id,
        "companies": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
    }