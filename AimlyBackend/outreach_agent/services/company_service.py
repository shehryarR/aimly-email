"""
AimlyBackend/services/company_service.py
Company service — pure logic layer, zero database operations.

NOTE: find_companies_by_query has been removed.
      Company discovery is now handled by AimlyCompanyFinder container.
      This service retains only:
        - improve_discovery_prompt  (used by /company/improve-prompt route)
        - load_companies_data       (used by CSV/Excel upload route)
"""
import pandas as pd
from sub_agents.prompt_improver.agent import improve_prompt


# =============================================================================
# PROMPT IMPROVEMENT
# =============================================================================

async def improve_discovery_prompt(raw_prompt: str, llm_config: dict) -> str:
    """
    Rewrite a rough user prompt into an optimised company-discovery query.
    Used by the /company/improve-prompt route.

    Args:
        raw_prompt:  The user's rough search intent.
        llm_config:  Dict with keys: api_key (str), model (str).

    Returns:
        A single improved prompt string.
    """
    return await improve_prompt(raw_prompt=raw_prompt, llm_config=llm_config)


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
                skipinitialspace=True,
                index_col=False,
                dtype=str,
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