# AimlyCompanyFinder/services/company_service.py

"""
Company discovery service — pure logic, zero DB operations.
Delegates all AI work to the OpenClaw container via OpenClawClient.
"""

from typing import Callable, Dict
from sub_agents.company_discovery.agent import find_companies, OpenClawClient


def find_companies_by_query(
    query: str,
    openclaw_client: OpenClawClient,
    limit: int = 50,
    check_company_exists: Callable[[str], bool] = None,
    add_company: Callable[[Dict], None] = None,
    should_stop: Callable[[], bool] = None,
    include_phone: bool = False,
    include_address: bool = False,
    include_company_info: bool = False,
) -> None:
    """
    Discover companies via OpenClaw container.
    All DB callbacks are provided by the caller (main.py worker).
    """
    find_companies(
        query=query,
        openclaw_client=openclaw_client,
        limit=limit,
        check_company_exists=check_company_exists,
        add_company=add_company,
        should_stop=should_stop,
        include_phone=include_phone,
        include_address=include_address,
        include_company_info=include_company_info,
    )