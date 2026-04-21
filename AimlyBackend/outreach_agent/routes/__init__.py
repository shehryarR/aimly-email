"""
Routes Package
Contains all FastAPI route modules for the outreach agent application.
"""
from .server import server_router
from .auth import auth_router, get_current_user
from .user import user_router
from .brands import brands_router
from .global_settings import global_settings_router
from .company import company_router
from .campaign import campaign_router
from .campaign_company import campaign_company_router
from .campaign_preferences import campaign_preferences_router
from .email import email_router
from .email_actions import email_actions_router
from .stats import stats_router
from .category import category_router
from .category_company import category_company_router
from .user_keys import user_keys_router

__all__ = [
    "server_router",
    "auth_router",
    "user_router",
    "brands_router",
    "global_settings_router",
    "company_router",
    "campaign_router",
    "campaign_company_router",
    "campaign_preferences_router",
    "email_router",
    "email_actions_router",
    "stats_router",
    "category_router",
    "category_company_router",
    "subscription_router",
    "user_keys_router",
    "get_current_user",
]