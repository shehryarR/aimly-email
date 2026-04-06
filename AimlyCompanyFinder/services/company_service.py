"""
AimlyCompanyFinder/services/company_service.py
Company discovery service — pure logic, zero DB operations.
"""
from typing import Callable, Dict
from sub_agents.company_discovery.agent import find_companies


async def find_companies_by_query(
    query: str,
    tavily_api_key: str,
    llm_config: dict,
    limit: int = 50,
    check_company_exists: Callable[[str], bool] = None,
    add_company: Callable[[Dict], None] = None,
    should_stop: Callable[[], bool] = None,
    include_phone: bool = False,
    include_address: bool = False,
    include_company_info: bool = False,
) -> None:
    """
    Discover companies via AI search.
    All DB callbacks are provided by the caller (main.py worker).
    """
    await find_companies(
        query=query,
        tavily_api_key=tavily_api_key,
        llm_config=llm_config,
        limit=limit,
        check_company_exists=check_company_exists,
        add_company=add_company,
        should_stop=should_stop,
        include_phone=include_phone,
        include_address=include_address,
        include_company_info=include_company_info,
    )