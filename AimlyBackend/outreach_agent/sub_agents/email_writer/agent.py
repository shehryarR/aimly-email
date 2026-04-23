"""
email_writer/agent.py — LLM email generation agent.

Pure logic layer — zero database operations.
LLM model and API key are passed in by the caller via llm_config.
"""
import asyncio
from pydantic import BaseModel, Field
from core.llm import LLMFactory
from typing import Dict, Optional


# =============================================================================
# INPUT SCHEMA
# =============================================================================

class EmailWriterInput(BaseModel):
    company_name:      str = Field(description="Name of the recipient company")
    user_instruction:  str = Field(description="Business context and email requirements")
    company_summary:   Optional[str] = Field(default=None, description="Research summary about the company (optional)")
    html_email:        bool = Field(default=False, description="Whether to generate a styled HTML email instead of plain text")
    raw_prompt:        bool = Field(default=False, description="If True, user_instruction is used as the complete LLM prompt verbatim — no wrapping or extra instructions added")
    llm_config:       dict = Field(
        description=(
            "Pre-loaded LLM config from the route layer. "
            "Required keys: api_key (str), model (str)."
        )
    )


# =============================================================================
# INSTRUCTION PARSER
# =============================================================================

def _parse_instruction_fields(user_instruction: str) -> dict:
    """
    Parse the flat user_instruction string back into individual fields.

    email_actions.py builds user_instruction as:
        Goal: ...
        Value Proposition: ...
        Call to Action: ...
        Tone: ...
        Writing Guidelines: ...
        Additional Context: ...

    Returns a dict with keys: goal, value_prop, cta, tone,
    writing_guidelines, additional_notes. Missing fields are empty strings.
    """
    field_map = {
        "Goal":               "goal",
        "Value Proposition":  "value_prop",
        "Call to Action":     "cta",
        "Tone":               "tone",
        "Writing Guidelines": "writing_guidelines",
        "Additional Context": "additional_notes",
    }

    result = {v: "" for v in field_map.values()}
    lines = user_instruction.strip().splitlines()

    current_key = None
    for line in lines:
        matched = False
        for label, key in field_map.items():
            if line.startswith(f"{label}:"):
                result[key] = line[len(label) + 1:].strip()
                current_key = key
                matched = True
                break
        if not matched and current_key:
            # Multi-line value — append to current field
            result[current_key] += " " + line.strip()

    return result


# =============================================================================
# PROMPT BUILDER
# =============================================================================

def _build_business_context_block(fields: dict) -> str:
    """
    Build the explicit business context block that goes into every prompt.
    Each field gets its own instruction so the LLM knows exactly what to do with it.
    """
    lines = []

    if fields["goal"]:
        lines.append(f"GOAL — The purpose of this email is: {fields['goal']}")

    if fields["value_prop"]:
        lines.append(f"VALUE PROPOSITION — Clearly communicate this offering: {fields['value_prop']}")

    if fields["tone"]:
        lines.append(f"TONE — Every sentence must match this tone exactly: {fields['tone']}")

    if fields["cta"]:
        lines.append(
            f"CALL TO ACTION — End the email with this specific CTA (use the exact intent, "
            f"you may rephrase naturally): {fields['cta']}"
        )

    if fields["writing_guidelines"]:
        lines.append(
            f"WRITING GUIDELINES — These are strict rules you must follow when writing the email:\n"
            f"{fields['writing_guidelines']}"
        )

    if fields["additional_notes"]:
        lines.append(
            f"ADDITIONAL CONTEXT — Use this information to add relevance and specificity to the email:\n"
            f"{fields['additional_notes']}"
        )

    return "\n\n".join(lines)


def _build_prompt(
    company_name: str,
    fields: dict,
    company_summary: Optional[str],
    html_email: bool,
) -> str:
    """
    Assemble the full prompt from parts. Same structure for plain and HTML —
    HTML gets extra formatting rules appended.
    """
    context_block = _build_business_context_block(fields)
    has_research  = bool(company_summary and company_summary.strip())

    # Opening instruction
    if html_email:
        opening = f'Write a visually appealing HTML outreach email to "{company_name}".'
    else:
        opening = f'Write a professional outreach email to "{company_name}".'

    # Research section
    if has_research:
        research_section = (
            f"COMPANY RESEARCH — Use these insights to personalise the email. Reference "
            f"specific details about their business, industry, or situation where relevant:\n"
            f"{company_summary}"
        )
        research_instruction = (
            "- Personalise the opening by referencing something specific from the company research\n"
            "- Connect the value proposition directly to the company's known situation or needs\n"
            "- Make it clear this email was written for them specifically, not a mass blast"
        )
    else:
        research_section = (
            "No company research is available. Write a strong generic email — "
            "do NOT invent specific details about the company."
        )
        research_instruction = (
            "- Write a compelling generic opening that could apply to any similar company\n"
            "- Do NOT reference specific details about the company that you do not know\n"
            "- Focus on making the value proposition as clear and relevant as possible"
        )

    prompt = f"""{opening}

BUSINESS CONTEXT (follow every instruction below strictly)
{context_block}

COMPANY INFORMATION
{research_section}

EMAIL WRITING RULES
{research_instruction}
- Match the TONE field exactly in every sentence — this is non-negotiable
- Strictly follow every rule in WRITING GUIDELINES if provided
- Incorporate ADDITIONAL CONTEXT naturally into the email if provided
- End with the CALL TO ACTION specified — do not substitute a different CTA
- Do NOT use placeholder fields like [Name], [Company], [Your Name], etc.
- If no contact name is known, use: "Dear {company_name} Team," or "Hello,"
- Do NOT include a signature — it will be added by the system
- Write a complete, ready-to-send email. No empty fields, no manual editing needed.
- After writing, review: does every sentence reflect the correct tone? Is the CTA present?

SUBJECT LINE RULES
- Create a subject line that matches the specified TONE exactly
- Keep it under 50 characters where possible
- Make it specific and intriguing — avoid generic subjects like "Business Opportunity"
- The subject line must align with the email's opening line

RESPONSE FORMAT (follow exactly)
SUBJECT: [subject line here]

CONTENT:
[complete email content here]
"""

    if html_email:
        prompt += """
HTML FORMATTING RULES
- The CONTENT must be a complete, self-contained HTML snippet (NOT a full <!DOCTYPE> page)
- Use only inline CSS styles — no <style> blocks, no external stylesheets
- Font: Arial or sans-serif, 15px, line-height 1.6, color #333333
- Use <div> or <p> tags with margin-bottom: 16px to separate sections
- The CTA must be a styled <a> button:
  <a href="#" style="display:inline-block;padding:10px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Your CTA text</a>
- Do NOT include <html>, <head>, <body>, or <style> tags
- Do NOT include a signature block
- Do NOT use placeholder fields like [Name] or [Company]
"""

    return prompt.strip()


# =============================================================================
# RUNNER
# =============================================================================

async def run_email_writer_agent(inputs: EmailWriterInput) -> Dict[str, str]:
    """
    Generate a personalised email with subject line.

    Credentials come from inputs.llm_config — no DB calls are made here.

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

    print(f"[EmailWriter] model={model!r}  company={inputs.company_name!r}  html_email={inputs.html_email}  raw_prompt={inputs.raw_prompt}")

    # Raw prompt: use user_instruction verbatim, skip all wrapping
    if inputs.raw_prompt:
        full_prompt = inputs.user_instruction
    else:
        fields = _parse_instruction_fields(inputs.user_instruction)
        has_research = bool(inputs.company_summary and inputs.company_summary.strip())
        print(
            f"[EmailWriter] html={inputs.html_email}  research={'yes' if has_research else 'no'}  "
            f"tone={fields['tone']!r}  guidelines={'yes' if fields['writing_guidelines'] else 'no'}"
        )
        full_prompt = _build_prompt(
            company_name=inputs.company_name,
            fields=fields,
            company_summary=inputs.company_summary,
            html_email=inputs.html_email,
        )

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

    # Parse SUBJECT / CONTENT markers
    if "SUBJECT:" in response_text and "CONTENT:" in response_text:
        parts   = response_text.split("CONTENT:")
        subject = parts[0].replace("SUBJECT:", "").strip()
        content = parts[1].strip()
        return {"subject": subject, "content": content}

    # Fallback parsing
    print(f"[EmailWriter] Warning: response not in expected format for {inputs.company_name!r}")
    lines = response_text.strip().split("\n")
    if len(lines) > 1 and len(lines[0]) < 100 and ":" not in lines[0]:
        subject = lines[0].strip()
        content = "\n".join(lines[1:]).strip()
    else:
        subject = f"Opportunity with {inputs.company_name}"
        content = response_text

    return {"subject": subject, "content": content}