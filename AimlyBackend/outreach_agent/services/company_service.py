"""
company_service.py — Company discovery and file-loading service.

Pure logic layer — zero database operations.
All config loading and DB reads/writes are the caller's (route layer's) responsibility.

UPDATED: find_companies_by_query now accepts check_company_exists and add_company
         callbacks instead of pre-loaded existing email/name sets. This allows
         immediate per-company DB persistence for crash recovery.
"""
import pandas as pd
from typing import Callable, Dict, Optional
from sub_agents.company_discovery.agent import find_companies
from sub_agents.prompt_improver.agent import improve_prompt


# =============================================================================
# DISCOVERY
# =============================================================================

async def improve_discovery_prompt(raw_prompt: str, llm_config: dict) -> str:
    """
    Rewrite a rough user prompt into an optimised company-discovery query.

    Delegates all LLM logic to sub_agents.prompt_improver.agent.

    No database calls are made here. The caller is responsible for:
      • Loading llm_config (api_key / model)  →  get from user_keys

    Args:
        raw_prompt:  The user's rough search intent.
        llm_config:  Dict with keys: api_key (str), model (str).

    Returns:
        A single improved prompt string.
    """
    return await improve_prompt(raw_prompt=raw_prompt, llm_config=llm_config)


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

    No database calls are made here. The caller is responsible for:
      • Loading tavily_api_key
      • Loading llm_config
      • Providing check_company_exists callback for deduplication
      • Providing add_company callback for immediate persistence
      • Providing should_stop callback for cancellation

    Args:
        query:                  Natural-language search goal.
        tavily_api_key:         Pre-loaded Tavily API key.
        llm_config:             Pre-loaded dict: {api_key, model}.
        limit:                  Max new companies to find.
        check_company_exists:   Callback(email: str) -> bool.
                                Return True if company already exists in DB.
        add_company:            Callback(company: dict) -> None.
                                Called immediately when a valid company is found.
                                Responsible for DB insert and decrementing counter.
        should_stop:            Callback() -> bool.
                                Return True to stop the agent immediately.
        include_phone:          Whether to include phone numbers in results.
        include_address:        Whether to include addresses in results.
        include_company_info:   Whether to include company descriptions.
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


# =============================================================================
# FILE LOADING  (pure — no DB)
# =============================================================================

def load_companies_data(uploaded_file, filename: str = None) -> tuple:
    if uploaded_file is None:
        return None, None

    try:
        if not filename:
            filename = getattr(uploaded_file, "name", None) or str(uploaded_file)

        if filename.lower().endswith(".csv"):
            df = pd.read_csv(
                uploaded_file,
                skipinitialspace=True,  # handles "header, with, spaces"
                index_col=False,        # never treat any column as index
                dtype=str,              # read all as string, no NaN/float inference
            )
        elif filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(uploaded_file, dtype=str)
        else:
            return None, "Unsupported file format. Please upload a CSV or Excel file."

        # Normalise column names
        df.columns = [str(c).lower().strip().replace(" ", "_") for c in df.columns]

        if "company_name" not in df.columns:
            return None, "Missing required column: 'company_name'"

        # Clean required fields
        df["company_name"] = df["company_name"].str.strip()
        df.loc[df["company_name"].str.lower() == "nan", "company_name"] = None

        if "email" in df.columns:
            df["email"] = df["email"].str.strip()
            df.loc[df["email"].str.lower() == "nan", "email"] = None
            df.loc[df["email"] == "", "email"] = None
        else:
            df["email"] = None

        # Clean optional fields
        for col in ("phone_number", "address", "company_info"):
            if col not in df.columns:
                df[col] = None
            else:
                df[col] = df[col].str.strip()
                df.loc[df[col].str.lower() == "nan", col] = None
                df.loc[df[col] == "", col] = None

        return df, None

    except Exception as exc:
        return None, f"Error loading file: {exc}"