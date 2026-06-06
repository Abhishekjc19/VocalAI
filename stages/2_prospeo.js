/**
 * Stage 2 — Prospeo
 * Input : array of company domains (string[])
 * Output: array of prospects { name, title, company, domain, linkedinUrl }
 *
 * Docs: https://app.prospeo.io/api  (free plan, API key in header)
 * Auth: X-KEY header via PROSPEO_API_KEY env var
 */

import { log } from "../utils/logger.js";
import { sleep, withRetry } from "../utils/helpers.js";

const BASE_URL = "https://api.prospeo.io";
const API_KEY = process.env.PROSPEO_API_KEY;

// Titles we treat as decision-makers
const DECISION_MAKER_KEYWORDS = [
  "ceo",
  "cto",
  "coo",
  "cmo",
  "cfo",
  "chief",
  "founder",
  "co-founder",
  "president",
  "vp",
  "vice president",
  "head of",
  "director",
  "managing director",
  "general manager",
  "partner",
];

function isDecisionMaker(title = "") {
  const lower = title.toLowerCase();
  return DECISION_MAKER_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Fetch employees for one domain from Prospeo using new Search Person API.
 * Note: New API requires searching with company website filter.
 */
async function fetchEmployeesForDomain(domain) {
  const apiKey = API_KEY || process.env.PROSPEO_API_KEY;
  
  if (!apiKey) {
    throw new Error("Missing PROSPEO_API_KEY in environment variables.");
  }

  const results = [];
  let page = 1;
  const maxPages = 2; // Limit to 2 pages (50 results) per domain to save credits

  while (page <= maxPages) {
    log.debug(`[Prospeo] Fetching ${domain} page ${page}`);

    const response = await withRetry(() =>
      fetch(`${BASE_URL}/search-person`, {
        method: "POST",
        headers: {
          "X-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page,
          filters: {
            company: {
              websites: {
                include: [domain]
              }
            }
            // Note: Seniority filter removed - we'll filter decision-makers in code
          }
        }),
      })
    );

    if (!response.ok) {
      const err = await response.text();
      log.warn(`[Prospeo] ${domain} → ${response.status}: ${err.slice(0, 200)}`);
      break;
    }

    const data = await response.json();
    
    if (data.error) {
      log.warn(`[Prospeo] ${domain} → Error: ${data.error_code}`);
      break;
    }

    const persons = data.results || [];

    if (persons.length === 0) break;

    results.push(...persons);

    // Check pagination
    const pagination = data.pagination || {};
    if (page >= pagination.total_page || persons.length < 25) break;

    page++;
    await sleep(500); // be polite between pages
  }

  return results;
}

/**
 * For all domains, find decision-makers and their LinkedIn URLs.
 */
export async function findDecisionMakers(domains) {
  const allProspects = [];

  for (const domain of domains) {
    try {
      const persons = await fetchEmployeesForDomain(domain);

      for (const result of persons) {
        const person = result.person || result;
        const company = result.company || {};
        
        // Extract data from new API format
        const jobTitle = person.title || person.job_title || "";
        
        // Filter for decision makers (API should already filter by seniority, but double-check)
        if (!isDecisionMaker(jobTitle)) continue;

        allProspects.push({
          name: person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
          title: jobTitle,
          company: company.name || person.company || domain,
          domain,
          linkedinUrl: person.linkedin_url || person.linkedin || null,
        });
      }

      log.debug(
        `[Prospeo] ${domain} → ${allProspects.filter(p => p.domain === domain).length} decision-makers`
      );
    } catch (err) {
      log.warn(`[Prospeo] Skipping ${domain}: ${err.message}`);
    }

    await sleep(300); // rate-limit buffer between domains
  }

  // Deduplicate by LinkedIn URL
  const seen = new Set();
  return allProspects.filter((p) => {
    const key = p.linkedinUrl ?? `${p.name}:${p.domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
