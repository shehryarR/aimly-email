from datetime import datetime
"""
Category Management Routes
Simple CRUD for categories (groups of companies).
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, validator
from typing import List, Optional
from core.database.connection import get_connection
from routes.auth import get_current_user

category_router = APIRouter(prefix="/category", tags=["Category Management"])


def normalize_text_field(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


# ── Pydantic Models ────────────────────────────────────────────────────────────

class CategoryCreateRequest(BaseModel):
    name: str
    detail: Optional[str] = None

    @validator("name")
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Category name is required")
        return v


class CategoryResponse(BaseModel):
    id: int
    user_id: int
    name: str
    detail: Optional[str] = None
    company_count: int = 0
    created_at: datetime
    updated_at: datetime


class CategoriesListResponse(BaseModel):
    categories: List[CategoryResponse]
    total: int
    page: int
    size: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True
    created: int = 0


# ==================================================================================
# POST /category/ — Create one or more categories
# ==================================================================================
@category_router.post("/", response_model=MessageResponse)
def create_categories(
    categories: List[CategoryCreateRequest],
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    created_count = 0

    if not categories:
        raise HTTPException(status_code=400, detail="No categories provided")

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            for cat in categories:
                detail = normalize_text_field(cat.detail)

                cursor.execute(
                    "SELECT id FROM categories WHERE user_id = %s AND name = %s",
                    (user_id, cat.name),
                )
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail=f"Category '{cat.name}' already exists",
                    )

                cursor.execute(
                    "INSERT INTO categories (user_id, name, detail) VALUES (%s, %s, %s)",
                    (user_id, cat.name, detail),
                )
                created_count += 1

            conn.commit()

        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create categories: {str(e)}")

    return MessageResponse(
        message=f"Successfully created {created_count} categories",
        success=True,
        created=created_count,
    )


# ==================================================================================
# PUT /category/ — Partial-update categories by ID
# ==================================================================================
@category_router.put("/", response_model=MessageResponse)
def update_categories(
    updates: List[dict],
    current_user: dict = Depends(get_current_user),
):
    """
    Each item must include 'id'. Updatable fields: name, detail.

    - name not sent           -> unchanged
    - name sent with value    -> updated
    - detail not sent         -> unchanged
    - detail sent empty ("")  -> set to NULL
    - detail sent with value  -> updated
    """
    user_id = current_user["user_id"]
    updated_count = 0

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            for item in updates:
                category_id = item.get("id")
                if category_id is None:
                    raise HTTPException(status_code=400, detail="Each item must include 'id'")

                cursor.execute(
                    "SELECT id FROM categories WHERE id = %s AND user_id = %s",
                    (category_id, user_id),
                )
                if not cursor.fetchone():
                    continue

                update_fields = []
                update_values = []

                if "name" in item and item["name"] is not None:
                    name = item["name"].strip()
                    if not name:
                        raise HTTPException(status_code=400, detail="Category name cannot be empty")
                    cursor.execute(
                        "SELECT id FROM categories WHERE user_id = %s AND name = %s AND id != %s",
                        (user_id, name, category_id),
                    )
                    if cursor.fetchone():
                        raise HTTPException(status_code=409, detail=f"Category '{name}' already exists")
                    update_fields.append("name = %s")
                    update_values.append(name)

                if "detail" in item:
                    update_fields.append("detail = %s")
                    update_values.append(normalize_text_field(item["detail"]))

                if update_fields:
                    update_fields.append("updated_at = CURRENT_TIMESTAMP")
                    update_values.extend([category_id, user_id])
                    cursor.execute(
                        f"UPDATE categories SET {', '.join(update_fields)} WHERE id = %s AND user_id = %s",
                        update_values,
                    )
                    if cursor.rowcount > 0:
                        updated_count += 1

            conn.commit()

        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to update categories: {str(e)}")

    return MessageResponse(
        message=f"Successfully updated {updated_count} categories",
        success=True,
    )


# ==================================================================================
# GET /category/ — Paginated list with search, sort, and company_count
# ==================================================================================
@category_router.get("/", response_model=CategoriesListResponse)
def get_categories(
    ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1),
    search: Optional[str] = Query(None, description="Search by name"),
    sort_by: Optional[str] = Query(None, description="name | companies | created_at"),
    sort_order: str = Query("asc", description="asc | desc"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    sort_dir = "DESC" if sort_order.lower() == "desc" else "ASC"

    with get_connection() as conn:
        cursor = conn.cursor()

        # Fetch by specific IDs
        if ids:
            id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
            if not id_list:
                return CategoriesListResponse(categories=[], total=0, page=page, size=size)
            placeholders = ",".join(["%s"] * len(id_list))
            cursor.execute(
                f"""
                SELECT c.id, c.user_id, c.name, c.detail, c.created_at, c.updated_at,
                       COUNT(cc.company_id) AS company_count
                FROM categories c
                LEFT JOIN category_company cc ON c.id = cc.category_id
                WHERE c.user_id = %s AND c.id IN ({placeholders})
                GROUP BY c.id
                ORDER BY c.created_at DESC
                """,
                [user_id] + id_list,
            )
            rows = cursor.fetchall()
            return CategoriesListResponse(
                categories=[CategoryResponse(**dict(r)) for r in rows],
                total=len(rows),
                page=page,
                size=size,
            )

        # Build WHERE
        where_parts = ["c.user_id = %s"]
        where_params: list = [user_id]
        if search and search.strip():
            where_parts.append("c.name LIKE %s")
            where_params.append(f"%{search.strip()}%")
        where_str = "WHERE " + " AND ".join(where_parts)

        # ORDER BY
        if sort_by == "name":
            order_clause = f"ORDER BY LOWER(c.name) {sort_dir}"
        elif sort_by == "companies":
            order_clause = f"ORDER BY company_count {sort_dir}, LOWER(c.name) ASC"
        else:
            order_clause = f"ORDER BY c.created_at {sort_dir}"

        # Count
        cursor.execute(
            f"SELECT COUNT(*) AS total FROM categories c {where_str}",
            where_params,
        )
        total = cursor.fetchone()["total"]

        # Paginated data
        offset = (page - 1) * size
        cursor.execute(
            f"""
            SELECT c.id, c.user_id, c.name, c.detail, c.created_at, c.updated_at,
                   COUNT(cc.company_id) AS company_count
            FROM categories c
            LEFT JOIN category_company cc ON c.id = cc.category_id
            {where_str}
            GROUP BY c.id
            {order_clause}
            LIMIT %s OFFSET %s
            """,
            where_params + [size, offset],
        )
        rows = cursor.fetchall()

    return CategoriesListResponse(
        categories=[CategoryResponse(**dict(r)) for r in rows],
        total=total,
        page=page,
        size=size,
    )


# ==================================================================================
# DELETE /category/ — Delete categories by IDs
# ==================================================================================
@category_router.delete("/", response_model=MessageResponse)
def delete_categories(
    ids: str = Query(..., description="Comma-separated category IDs"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]

    if not id_list:
        raise HTTPException(status_code=400, detail="No valid category IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            placeholders = ",".join(["%s"] * len(id_list))
            cursor.execute(
                f"DELETE FROM categories WHERE user_id = %s AND id IN ({placeholders})",
                [user_id] + id_list,
            )
            deleted_count = cursor.rowcount
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete categories: {str(e)}")

    return MessageResponse(
        message=f"Successfully deleted {deleted_count} categories",
        success=True,
    )