"""
AimlyCompanyFinder/sub_agents/company_discovery/agent.py
AI-powered company discovery via Tavily + LLM.
Pure logic layer — zero database operations.
"""
import asyncio
import json
from typing import List, Dict, Callable
from tavily import TavilyClient
from core.llm import LLMFactory


# =============================================================================
# PUBLIC ENTRY POINT
# =============================================================================

async def find_companies(
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
    if not tavily_api_key:
        raise ValueError("Tavily API key is required for company discovery.")
    api_key = (llm_config.get("api_key") or "").strip()
    model   = (llm_config.get("model")   or "").strip()
    if not api_key:
        raise ValueError("Missing LLM API key. Configure it in LLM Settings.")
    if not model:
        raise ValueError("Missing LLM model. Configure it in LLM Settings.")

    if check_company_exists is None:
        check_company_exists = lambda email: False
    if add_company is None:
        add_company = lambda company: None
    if should_stop is None:
        should_stop = lambda: False

    llm = LLMFactory.create_llm(api_key, "gemini")

    print(f"🚀 Starting discovery: '{query}'  (limit={limit})")

    found_count:          int       = 0
    found_emails:         set       = set()
    used_queries:         List[str] = []
    consecutive_empty                = 0
    max_consecutive_empty            = 3
    iteration                        = 0

    print(f"📊 Target: {limit}")

    while found_count < limit:
        iteration += 1
        print(f"\n🔄 Iteration {iteration} — found so far: {found_count}/{limit}")

        if should_stop():
            print("🛑 Job cancelled — stopping agent")
            break

        new_queries = await _generate_search_queries(query, used_queries, llm, model, count=10)
        if not new_queries:
            print("❌ No queries generated — stopping")
            break
        used_queries.extend(new_queries)

        search_results = await _execute_tavily_searches(new_queries, tavily_api_key)
        if not search_results:
            print("❌ No search results — stopping")
            break

        candidates = await _extract_companies_with_emails(search_results, query, llm, model, limit)

        added_this_iter = 0
        for company in candidates:
            email = company.get("email", "").lower().strip()
            name  = company.get("name",  "").strip()

            if not email or not name:
                continue

            if email in found_emails:
                continue

            if should_stop():
                print("🛑 Job cancelled — stopping agent mid-batch")
                return

            if check_company_exists(email):
                print(f"⏭️  Skipped (exists in DB): {name} — {email}")
                continue

            if include_phone or include_address or include_company_info:
                company = await _enrich_single_company(
                    company, llm, model, include_phone, include_address, include_company_info
                )

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

async def _generate_search_queries(
    query: str, used_queries: List[str], llm, model: str, count: int = 10
) -> List[str]:
    for attempt in range(3):
        try:
            used_text = "\n".join(f"- {q}" for q in used_queries[-50:])
            intensity = ["MUST", "ABSOLUTELY MUST", "CRITICALLY MUST"][attempt]
            extra     = [
                "",
                "\n\nAttempt 2: Previous attempt failed. Try harder.",
                f"\n\nAttempt 3: FINAL attempt. You CANNOT return empty. Generate {count} creative queries NOW.",
            ][attempt]

            prompt = f"""You {intensity} generate exactly {count} diverse search queries for: "{query}"

REQUIREMENTS:
1. Return exactly {count} queries as a JSON array of strings
2. Each query targets a different source/angle
3. Vary keywords: companies, businesses, firms, providers, vendors, contractors
4. Target different platforms: LinkedIn, Chamber of Commerce, BBB, industry associations
5. NEVER repeat or closely match previously used queries

PREVIOUSLY USED (DO NOT REPEAT):
{used_text}

OUTPUT: Return ONLY a valid JSON array, no explanation:
["query 1", "query 2", ..., "query {count}"]
{extra}"""

            response = await llm.generate(prompt=prompt, model=model, response_format="text", web_search=False)
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


def _queries_similar(q1: str, q2: str) -> bool:
    words1 = {w for w in q1.split() if len(w) > 3}
    words2 = {w for w in q2.split() if len(w) > 3}
    if not words1 or not words2:
        return False
    return len(words1 & words2) / max(len(words1), len(words2)) > 0.7


async def _execute_tavily_searches(queries: List[str], tavily_api_key: str) -> str:
    tavily    = TavilyClient(api_key=tavily_api_key)
    semaphore = asyncio.Semaphore(5)

    async def _search(q: str):
        async with semaphore:
            try:
                result = await asyncio.to_thread(
                    tavily.search, q,
                    search_depth="advanced", include_raw_content=True, max_results=10,
                )
                return result.get("results", [])
            except Exception as exc:
                print(f"  Search failed for '{q}': {exc}")
                return []

    all_results = await asyncio.gather(*[_search(q) for q in queries])
    combined    = ""
    total       = 0
    for batch in all_results:
        for r in batch:
            combined += f"Source: {r.get('url', '')}\nContent: {r.get('content', '')}\n\n"
            total    += 1
    print(f"📄 {total} sources from {len(queries)} queries")
    return combined


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


async def _extract_companies_with_emails(
    search_results: str, original_query: str, llm, model: str, target_limit: int
) -> List[Dict]:
    if not search_results.strip():
        return []

    prompt = f"""Extract companies with REAL, unmasked email addresses from this content.
Query context: "{original_query}"  |  Target: {target_limit} companies

RULES:
- Only include companies with complete, real email addresses
- Reject masked emails (asterisks, x's, dashes): m***@co.com ❌
- Reject fake domains: example.com, test.com ❌
- Skip generic entries (directories, platforms)

OUTPUT: Return ONLY a valid JSON array:
[{{"name": "Company", "email": "real@company.com"}}]

CONTENT:
{search_results[:50000]}"""

    try:
        response   = await llm.generate(prompt=prompt, model=model, response_format="text", web_search=True)
        companies  = _parse_json_array(response)
        valid      = []
        for c in companies:
            if not isinstance(c, dict):
                continue
            name  = str(c.get("name",  "")).strip()
            email = str(c.get("email", "")).strip().lower()
            if name and _is_valid_email(email):
                valid.append({"name": name, "email": email})
            else:
                print(f"❌ Rejected: {name} — {email}")
        print(f"🏢 Extracted {len(valid)} valid companies")
        return valid
    except Exception as exc:
        print(f"Error extracting companies: {exc}")
        return []


async def _enrich_single_company(
    company: Dict, llm, model: str,
    include_phone: bool, include_address: bool, include_company_info: bool,
) -> Dict:
    fields = ", ".join(filter(None, [
        "phone number"        if include_phone        else "",
        "office address"      if include_address      else "",
        "company description" if include_company_info else "",
    ]))
    prompt = f"""Find REAL information for this company: {fields}

- {company['name']} ({company['email']})

Rules:
- Only provide real, verified data
- Use empty string "" if not found — do NOT fabricate

OUTPUT: Return ONLY a valid JSON object:
{{"phone": "...", "address": "...", "company_info": "..."}}"""

    try:
        response = await llm.generate(prompt=prompt, model=model, response_format="text", web_search=True)
        cleaned  = response.strip()
        start    = cleaned.find("{")
        end      = cleaned.rfind("}")
        info     = json.loads(cleaned[start:end+1]) if start != -1 else {}

        ec = company.copy()
        if include_phone        and info.get("phone"):        ec["phone_number"]  = info["phone"]
        if include_address      and info.get("address"):      ec["address"]       = info["address"]
        if include_company_info and info.get("company_info"): ec["company_info"]  = info["company_info"]
        return ec
    except Exception as exc:
        print(f"Error enriching {company['name']}: {exc}")
        return company


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