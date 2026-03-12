"""
company_research/agent.py — Per-company research sub-agent.

Pure logic layer — zero database operations.
LLM config is passed in by the caller.
"""
from pydantic import BaseModel, Field
from core.llm import LLMFactory


# =============================================================================
# INPUT SCHEMA
# =============================================================================

class CompanyResearchInput(BaseModel):
    company_name:    str  = Field(description="Name of the company to research")
    user_intention:  str  = Field(description="User's business offering and outreach goal")
    llm_config:      dict = Field(
        description="Pre-loaded LLM config. Required keys: api_key (str), model (str)."
    )
    # user_id kept for call-site compatibility — no longer used for DB
    user_id: int = Field(default=0, description="Kept for compatibility — not used for DB")


# =============================================================================
# PROMPT
# =============================================================================

RESEARCH_PROMPT = """
Use Google Search to find information about the company: "{company_name}"
Based on the user's intention: "{user_intention}"

Research and gather specific details relevant for this outreach:
- Industry and business model
- Recent news, achievements, or challenges
- Key services/products that align with the user's offering
- Company size, growth stage, or expansion plans
- Leadership team or decision makers
- Pain points or opportunities that match the user's value proposition
- Recent press releases, funding, or strategic initiatives

Focus on information that would help craft a highly personalised email showing
genuine research and understanding of their business.

Summarise your findings in a detailed paragraph highlighting the most relevant
points for the intended outreach. If you couldn't find specific information,
mention what generic approach might work for this company type.

Output ONLY the final research summary — no search results, no links.
Aim for 90–120 words.
"""


# =============================================================================
# RUNNER
# =============================================================================

async def run_company_research_agent(inputs: CompanyResearchInput) -> str:
    """
    Research a company using LLM + web search.

    Credentials come from inputs.llm_config — no DB calls are made here.

    Returns:
        str — research summary paragraph

    Raises:
        ValueError  — missing/invalid config
        Exception   — LLM generation failure
    """
    api_key = (inputs.llm_config.get("api_key") or "").strip()
    model   = (inputs.llm_config.get("model")   or "").strip()

    if not api_key:
        raise ValueError("Missing LLM API key. Configure it in LLM Settings.")
    if not model:
        raise ValueError("Missing LLM model. Configure it in LLM Settings.")

    print(f"[CompanyResearch] model={model!r}  company={inputs.company_name!r}")

    try:
        llm = LLMFactory.create_llm(api_key, "gemini")
    except Exception as exc:
        raise ValueError(f"Error initialising LLM: {exc}")

    prompt = RESEARCH_PROMPT.format(
        company_name=inputs.company_name,
        user_intention=inputs.user_intention,
    )

    try:
        result = await llm.generate(
            prompt=prompt,
            model=model,
            response_format="text",
            web_search=True,
        )
    except Exception as exc:
        raise Exception(f"Error researching '{inputs.company_name}': {exc}")

    if not result:
        raise ValueError(f"No research information found for '{inputs.company_name}'.")

    print(f"[CompanyResearch] Done for {inputs.company_name!r}")
    return result