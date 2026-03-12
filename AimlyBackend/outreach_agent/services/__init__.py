"""
Services Module for AI Email Outreach Pro
"""
from .email_service import generate_email, send_email
from .company_service import load_companies_data, find_companies_by_query

__all__ = [
    'generate_email',
    'send_email',
    'load_companies_data',
    'find_companies_by_query',
]