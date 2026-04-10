# AimlyCompanyFinder/sub_agents/company_discovery/agent.py

"""
AI-powered company discovery via OpenClaw container.
Pure logic layer — zero database operations.
All LLM and search logic is delegated to the OpenClaw container via HTTP.
"""

import json
import requests
from typing import List, Dict, Callable


# =============================================================================
# OPENCLAW CLIENT
# =============================================================================

class OpenClawClient:
    """Simple HTTP client for the OpenClaw container."""

    def __init__(self, base_url: str, server_api_key: str, gemini_key: str, tavily_key: str):
        self.base_url       = base_url.rstrip("/")
        self.server_api_key = server_api_key
        self.gemini_key     = gemini_key
        self.tavily_key     = tavily_key

    def query(self, message: str, timeout: int = 120) -> str:
        """Send a message to OpenClaw and return the text response."""
        resp = requests.post(
            f"{self.base_url}/query",
            headers={"X-API-Key": self.server_api_key},
            json={
                "message":    message,
                "gemini_key": self.gemini_key,
                "tavily_key": self.tavily_key,
            },
            timeout=timeout,
        )
        if resp.status_code == 401:
            raise ValueError("OpenClaw rejected the request — check server/gemini/tavily keys")
        if resp.status_code != 200:
            raise RuntimeError(f"OpenClaw error {resp.status_code}: {resp.text[:300]}")
        return resp.json()["text"]


# =============================================================================
# PUBLIC ENTRY POINT
# =============================================================================

def find_companies(
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

    if check_company_exists is None:
        check_company_exists = lambda email: False
    if add_company is None:
        add_company = lambda company: None
    if should_stop is None:
        should_stop = lambda: False

    print(f"🚀 Starting discovery: '{query}'  (limit={limit})")

    found_count:       int       = 0
    found_emails:      set       = set()
    used_queries:      List[str] = []
    consecutive_empty            = 0
    max_consecutive_empty        = 3
    iteration                    = 0

    print(f"📊 Target: {limit}")

    while found_count < limit:
        iteration += 1
        print(f"\n🔄 Iteration {iteration} — found so far: {found_count}/{limit}")

        if should_stop():
            print("🛑 Job cancelled — stopping agent")
            break

        # ── Step 1: Generate search queries via OpenClaw (Gemini only, no search) ──
        new_queries = _generate_search_queries(query, used_queries, openclaw_client, count=10)
        if not new_queries:
            print("❌ No queries generated — stopping")
            break
        used_queries.extend(new_queries)

        # ── Step 2: Find companies for each query via OpenClaw (Gemini + Tavily) ──
        added_this_iter = 0

        for search_query in new_queries:
            if should_stop():
                print("🛑 Job cancelled — stopping agent mid-batch")
                return

            if found_count >= limit:
                break

            candidates = _find_companies_for_query(
                search_query, query, openclaw_client, limit,
                include_phone, include_address, include_company_info,
            )

            for company in candidates:
                email = company.get("email", "").lower().strip()
                name  = company.get("name",  "").strip()

                if not email or not name:
                    continue
                if email in found_emails:
                    continue
                if not _is_valid_email(email):
                    print(f"❌ Rejected invalid email: {name} — {email}")
                    continue
                if should_stop():
                    print("🛑 Job cancelled — stopping agent mid-batch")
                    return
                if check_company_exists(email):
                    print(f"⏭️  Skipped (exists in DB): {name} — {email}")
                    continue

                add_company(company)
                found_emails.add(email)
                found_count += 1
                added_this_iter += 1
                print(f"✅ Added: {name} — {email}")

                if found_count >= limit:
                    break

        print(f"   +{added_this_iter} new companies this iteration")

        if added_this_iter == 0:
            consecutive_empty += 1
            print(f"⚠️  Consecutive empty iterations: {consecutive_empty}/{max_consecutive_empty}")
        else:
            consecutive_empty = 0

        if consecutive_empty >= max_consecutive_empty:
            print("🛑 Too many consecutive empty iterations — stopping")
            break

    print(f"\n🎯 Discovery complete: {found_count} companies found")


# =============================================================================
# PRIVATE HELPERS
# =============================================================================

def _generate_search_queries(
    query: str,
    used_queries: List[str],
    client: OpenClawClient,
    count: int = 10,
) -> List[str]:
    """
    Ask OpenClaw (Gemini only, no web search) to generate diverse search queries.
    """
    for attempt in range(3):
        try:
            used_text = "\n".join(f"- {q}" for q in used_queries[-50:])
            intensity = ["MUST", "ABSOLUTELY MUST", "CRITICALLY MUST"][attempt]
            extra     = [
                "",
                "\n\nAttempt 2: Previous attempt failed. Try harder.",
                f"\n\nAttempt 3: FINAL attempt. You CANNOT return empty. Generate {count} creative queries NOW.",
            ][attempt]

            message = f"""You {intensity} generate exactly {count} diverse search queries for finding companies matching: "{query}"

REQUIREMENTS:
1. Return exactly {count} queries as a JSON array of strings
2. Each query targets a different source/angle
3. Vary keywords: companies, businesses, firms, providers, vendors, contractors
4. Target different platforms: LinkedIn, Chamber of Commerce, BBB, industry associations
5. NEVER repeat or closely match previously used queries
6. Do NOT use web search — use your knowledge to generate queries only

PREVIOUSLY USED (DO NOT REPEAT):
{used_text}

OUTPUT: Return ONLY a valid JSON array, no explanation:
["query 1", "query 2", ..., "query {count}"]
{extra}"""

            response = client.query(message)
            queries  = _parse_json_array(response)
            new_qs   = [
                q.strip() for q in queries
                if isinstance(q, str) and len(q.strip()) > 5
                and not any(_queries_similar(q.lower(), u.lower()) for u in used_queries)
            ]
            if len(new_qs) >= 3:
                print(f"✅ Generated {len(new_qs)} queries (attempt {attempt+1})")
                return new_qs[:count]
            print(f"⚠️  Only {len(new_qs)} unique queries on attempt {attempt+1}")
        except Exception as exc:
            print(f"❌ Query generation attempt {attempt+1} failed: {exc}")

    raise Exception("Failed to generate search queries after 3 attempts")


def _build_output_schema(
    include_phone: bool,
    include_address: bool,
    include_company_info: bool,
) -> str:
    """Build the JSON schema string for the expected output based on requested fields."""
    fields = [
        '"name": "Company Name"',
        '"email": "real@company.com"',
    ]
    if include_phone:
        fields.append('"phone": "phone number or empty string"')
    if include_address:
        fields.append('"address": "office address or empty string"')
    if include_company_info:
        fields.append('"company_info": "brief company description or empty string"')

    return "{" + ", ".join(fields) + "}"


def _find_companies_for_query(
    search_query: str,
    original_query: str,
    client: OpenClawClient,
    target_limit: int,
    include_phone: bool = False,
    include_address: bool = False,
    include_company_info: bool = False,
) -> List[Dict]:
    """
    Ask OpenClaw (Gemini + Tavily web search) to find companies for a single
    search query and return all requested fields in one call.
    """
    schema = _build_output_schema(include_phone, include_address, include_company_info)

    extra_field_instructions = ""
    if include_phone or include_address or include_company_info:
        extra_fields = ", ".join(filter(None, [
            "phone number"        if include_phone        else "",
            "office address"      if include_address      else "",
            "brief description"   if include_company_info else "",
        ]))
        extra_field_instructions = f"""
- For each company also find their real: {extra_fields}
- Use empty string "" for any field you cannot find — do NOT fabricate"""

    message = f"""Use web search to find real companies matching this search query: "{search_query}"

Context: We are looking for companies matching: "{original_query}"
Target: up to {target_limit} companies

RULES:
- Use web search to find companies
- Only include companies with complete, real email addresses
- Reject masked emails (asterisks, x's, dashes): m***@co.com is INVALID
- Reject fake domains: example.com, test.com, sample.com are INVALID
- Skip generic directory listings or platforms themselves{extra_field_instructions}

OUTPUT: Return ONLY a valid JSON array, no explanation, no markdown:
[{schema}]

If no valid companies found, return an empty array: []"""

    try:
        response  = client.query(message, timeout=180)
        companies = _parse_json_array(response)
        valid     = []
        for c in companies:
            if not isinstance(c, dict):
                continue
            name  = str(c.get("name",  "")).strip()
            email = str(c.get("email", "")).strip().lower()
            if not name or not _is_valid_email(email):
                print(f"❌ Rejected: {name} — {email}")
                continue

            company = {"name": name, "email": email}
            if include_phone        and c.get("phone"):        company["phone_number"] = c["phone"]
            if include_address      and c.get("address"):      company["address"]      = c["address"]
            if include_company_info and c.get("company_info"): company["company_info"] = c["company_info"]
            valid.append(company)

        print(f"🏢 Found {len(valid)} valid companies for query: '{search_query[:60]}'")
        return valid
    except Exception as exc:
        print(f"❌ Company search failed for '{search_query[:60]}': {exc}")
        return []


def _is_valid_email(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    email = email.strip().lower()
    if "@" not in email or "." not in email or len(email) < 6:
        return False
    for char in ["*", "#"]:
        if char * 2 in email:
            return False
    masked = ["*****", "***@", "@***", "xxx@", "@xxx", "####", "___@", "---@"]
    if any(p in email for p in masked):
        return False
    fake_domains = {"example.com", "test.com", "sample.com", "domain.com",
                    "placeholder.com", "fake.com", "dummy.com", "temp.com"}
    domain = email.split("@")[-1]
    if domain in fake_domains:
        return False
    if "." not in domain or len(domain.split(".")[-1]) < 2:
        return False
    return True


def _queries_similar(q1: str, q2: str) -> bool:
    words1 = {w for w in q1.split() if len(w) > 3}
    words2 = {w for w in q2.split() if len(w) > 3}
    if not words1 or not words2:
        return False
    return len(words1 & words2) / max(len(words1), len(words2)) > 0.7


def _parse_json_array(text: str) -> list:
    cleaned = text.strip()
    for fence in ["```json", "```"]:
        if fence in cleaned:
            cleaned = cleaned.split(fence)[1].split("```")[0].strip()
            break
    start = cleaned.find("[")
    end   = cleaned.rfind("]")
    if start != -1 and end != -1:
        return json.loads(cleaned[start:end+1])
    return json.loads(cleaned)