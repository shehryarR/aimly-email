"""
email_writer/agent.py — LLM email generation agent.

Pure logic layer — zero database operations.
LLM model and API key are passed in by the caller via llm_config.
"""
import asyncio
from pydantic import BaseModel, Field
from core.llm import LLMFactory
from typing import Dict,Optional


# =============================================================================
# INPUT SCHEMA
# =============================================================================

class EmailWriterInput(BaseModel):
    company_name:      str = Field(description="Name of the recipient company")
    user_instruction:  str = Field(description="Business context and email requirements")
    company_summary:   Optional[str] = Field(default=None, description="Research summary about the company (optional)")
    llm_config:       dict = Field(
        description=(
            "Pre-loaded LLM config from the route layer. "
            "Required keys: api_key (str), model (str)."
        )
    )


# =============================================================================
# PROMPT TEMPLATES
# =============================================================================

# Template for when company research is available
PERSONALIZED_EMAIL_PROMPT = """
Write a personalized outreach email for "{company_name}" based on:
User's Business Context: {user_instruction}
Company Research: {company_summary}

Create an email that:
1. Shows genuine research and understanding of their business
2. References specific details about their company, industry, or recent developments
3. Clearly connects how the user's offering solves their potential needs
4. Uses insights from the research to make the pitch relevant and timely
5. Follows the tone and style specified in the user's business context
"""

# Template for when no company research is available
GENERIC_EMAIL_PROMPT = """
Write a professional outreach email for "{company_name}" based on:
User's Business Context: {user_instruction}

Create an email that:
1. Presents the user's value proposition clearly
2. Explains how their offering could benefit companies like {company_name}
3. Maintains a professional and engaging tone
4. Follows the tone and style specified in the user's business context
5. Does NOT attempt to reference specific details about the company since none are available
"""

# Common instructions for both templates
COMMON_EMAIL_INSTRUCTIONS = """
IMPORTANT EMAIL FORMATTING RULES:
- Do NOT use placeholder fields like [Name], [Company], [Your Name], etc.
- Use actual information provided or write generically without brackets
- If specific information is missing, write naturally without placeholders
- Write a complete, ready-to-send email with no empty fields to fill

GREETING OPTIONS:
- If no specific contact name: "Dear Team," or "Hello," or "Hi there,"
- If company name known: "Dear {company_name} Team,"
- Never use: "Dear [Name]" or "Hi [First Name]"

SIGNATURE:
- Do not provide any signature. The signature will be added separately by the system.

SUBJECT LINE REQUIREMENTS:
- Create a compelling subject line that matches the tone specified in user instructions
- Avoid generic subjects like "Business Opportunity"
- Keep it under 50 characters when possible
- Make it intriguing and align with the user's specified approach

RESPONSE FORMAT:
You MUST respond in exactly this format:

SUBJECT: [Your subject line here]

CONTENT:
[Your complete email content here]

Structure: Appropriate greeting, personalized opening, value proposition,
clear call-to-action, appropriate closing.
The email should be complete and ready to send without any manual editing needed.
After drafting the email, review to ensure no placeholders remain.
"""


# =============================================================================
# RUNNER
# =============================================================================

async def run_email_writer_agent(inputs: EmailWriterInput) -> Dict[str, str]:
    """
    Generate a personalised email with subject line.

    Credentials come from inputs.llm_config — no DB calls are made here.
    
    If company_summary is provided, creates a personalized email using the research.
    If company_summary is None/empty, creates a generic email based only on user_instruction.

    Returns:
        {"subject": str, "content": str}

    Raises:
        ValueError  — missing/invalid config
        Exception   — LLM generation failure
    """
    api_key = (inputs.llm_config.get("api_key") or "").strip()
    model   = (inputs.llm_config.get("model")   or "").strip()

    if not api_key:
        raise ValueError("Missing LLM API key. Please configure it in LLM Settings.")
    if not model:
        raise ValueError("Missing LLM model. Please configure it in LLM Settings.")

    print(f"[EmailWriter] model={model!r}  company={inputs.company_name!r}")
    
    # Determine which prompt template to use based on company_summary availability
    has_research = inputs.company_summary and inputs.company_summary.strip()
    
    if has_research:
        print(f"[EmailWriter] Using personalized template with research")
        main_prompt = PERSONALIZED_EMAIL_PROMPT.format(
            company_name=inputs.company_name,
            user_instruction=inputs.user_instruction,
            company_summary=inputs.company_summary,
        )
    else:
        print(f"[EmailWriter] Using generic template (no research available)")
        main_prompt = GENERIC_EMAIL_PROMPT.format(
            company_name=inputs.company_name,
            user_instruction=inputs.user_instruction,
        )

    # Combine with common instructions
    full_prompt = main_prompt + "\n" + COMMON_EMAIL_INSTRUCTIONS

    try:
        llm = LLMFactory.create_llm(api_key, "gemini")
    except Exception as exc:
        raise ValueError(f"Error initialising LLM: {exc}")

    try:
        response_text = await llm.generate(
            prompt=full_prompt,
            model=model,
            response_format="text",
        )
    except Exception as exc:
        raise Exception(f"Error generating email for '{inputs.company_name}': {exc}")

    print(f"[EmailWriter] Response received for {inputs.company_name!r}")

    # ── Parse SUBJECT / CONTENT markers ──────────────────────────────────────
    if "SUBJECT:" in response_text and "CONTENT:" in response_text:
        parts   = response_text.split("CONTENT:")
        subject = parts[0].replace("SUBJECT:", "").strip()
        content = parts[1].strip()
        return {"subject": subject, "content": content}

    # ── Fallback parsing ──────────────────────────────────────────────────────
    print(f"[EmailWriter] Warning: response not in expected format for {inputs.company_name!r}")
    lines = response_text.strip().split("\n")
    if len(lines) > 1 and len(lines[0]) < 100 and ":" not in lines[0]:
        subject = lines[0].strip()
        content = "\n".join(lines[1:]).strip()
    else:
        subject = f"Opportunity with {inputs.company_name}"
        content = response_text

    return {"subject": subject, "content": content}