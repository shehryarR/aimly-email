"""
prompt_improver/agent.py — AI-powered discovery prompt optimiser.

Pure logic layer — zero database operations.
The LLM config is passed in by the caller (service layer).
"""
from core.llm import LLMFactory


# =============================================================================
# PUBLIC ENTRY POINT
# =============================================================================

async def improve_prompt(raw_prompt: str, llm_config: dict) -> str:
    """
    Rewrite a rough user prompt into an optimised company-discovery query.

    The improved prompt is tuned for the find_companies pipeline:
      • Richer industry/niche terminology
      • Clearer geographic or demographic scope
      • Business-type variety (companies, firms, vendors, contractors, providers…)
      • Contact-discoverability signals (email, directory, association)

    No database calls are made here. The caller is responsible for:
      • Loading llm_config (api_key / model)  →  get from user_keys

    Args:
        raw_prompt:  The user's rough search intent.
        llm_config:  Dict with keys: api_key (str), model (str).

    Returns:
        A single improved prompt string.

    Raises:
        ValueError:   If api_key or model is missing.
        Exception:    If the LLM fails after all retry attempts.
    """
    api_key = (llm_config.get("api_key") or "").strip()
    model   = (llm_config.get("model")   or "").strip()

    if not api_key:
        raise ValueError("Missing LLM API key. Configure it in LLM Settings.")
    if not model:
        raise ValueError("Missing LLM model. Configure it in LLM Settings.")

    llm = LLMFactory.create_llm(api_key, "gemini")

    for attempt in range(3):
        try:
            result = await _run_improve(raw_prompt, llm, model, attempt)
            if result:
                return result
            print(f"⚠️  Empty result on attempt {attempt + 1}, retrying...")
        except Exception as exc:
            print(f"❌ Prompt improvement attempt {attempt + 1} failed: {exc}")
            if attempt == 2:
                raise

    raise Exception("Failed to improve prompt after 3 attempts.")


# =============================================================================
# PRIVATE HELPERS
# =============================================================================

async def _run_improve(raw_prompt: str, llm, model: str, attempt: int) -> str:
    """Single LLM call — intensity escalates with each retry attempt."""
    intensity = ["MUST", "ABSOLUTELY MUST", "CRITICALLY MUST"][attempt]
    extra = [
        "",
        "\n\nAttempt 2: Previous attempt returned empty. You MUST return an improved prompt.",
        "\n\nAttempt 3: FINAL attempt. Return a single improved prompt string NOW. No explanations.",
    ][attempt]

    prompt = f"""You {intensity} rewrite the user's rough search intent into a single, optimised B2B company-discovery prompt.

The improved prompt feeds into a pipeline that:
1. Generates 10 diverse Tavily web-search queries
2. Scrapes company directories, LinkedIn, Chamber of Commerce, BBB, industry associations
3. Extracts company names + real email addresses from the results

RULES:
- Preserve the user's core intent exactly — do NOT change the industry, location, or target audience
- Add specific industry terminology and synonyms (e.g. "contractors", "vendors", "service providers", "firms", "agencies")
- Clarify or infer geographic scope if mentioned (city / state / country / region)
- Include email discoverability context: "with contact emails", "publicly listed", "directory listings"
- Keep it to 1–3 sentences max — concise but information-dense
- Do NOT add fictional details the user did not imply
- Return a SINGLE improved prompt string — no lists, no explanation, no preamble, no quotes
{extra}

USER'S ROUGH PROMPT:
{raw_prompt}

IMPROVED PROMPT:"""

    response = await llm.generate(prompt=prompt, model=model, response_format="text", web_search=False)
    return response.strip()