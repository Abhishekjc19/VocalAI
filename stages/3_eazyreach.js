/**
 * Stage 3 — Eazyreach
 * Input : array of prospects with linkedinUrl
 * Output: same array enriched with { email, isRealEmail } where resolved
 *
 * Docs: https://eazyreach.app  (credits provided by Vocallabs)
 * Auth: OAuth2 credentials flow → GraphQL API
 * 
 * ⚠️  CRITICAL: isRealEmail flag tracks whether email came from API (true) 
 *     or was generated as mock (false). Never send emails with isRealEmail=false.
 */

import { log } from "../utils/logger.js";
import { sleep, withRetry } from "../utils/helpers.js";

const GRAPHQL_ENDPOINT = "https://db.vocallabs.ai/v1/graphql";
const CLIENT_SECRET = process.env.EAZYREACH_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth2 access token using client credentials
 * 
 * ⚠️  NOTE: The GraphQL endpoint requires authentication but the exact auth flow
 * is unclear from Eazyreach/Vocallabs API. The CLIENT_SECRET works as a Bearer token,
 * but the GraphQL schema is not introspectable (introspection disabled).
 * 
 * Currently trying: CLIENT_SECRET as direct Bearer token for GraphQL queries
 * This works for endpoint authentication but query fields still need to be discovered.
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientSecret = CLIENT_SECRET || process.env.EAZYREACH_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("Missing EAZYREACH_CLIENT_SECRET in environment variables.");
  }

  log.debug(`[Eazyreach] Using CLIENT_SECRET as GraphQL Bearer token`);

  // For now, use the CLIENT_SECRET directly as bearer token
  // The GraphQL endpoint accepts this for authentication
  accessToken = clientSecret;
  
  // Assume token is valid for 1 hour
  tokenExpiry = Date.now() + (3600 * 1000) - 60000;

  return accessToken;
}

/**
 * Resolve a single LinkedIn URL to a verified work email using GraphQL.
 * Returns { email: string, isRealEmail: boolean } where:
 *   - isRealEmail=true: email came from Eazyreach API
 *   - isRealEmail=false: email was generated as fallback mock
 * Returns { email: null, isRealEmail: false } if resolution completely fails.
 * 
 * ⚠️  NOTE: The exact GraphQL query structure needs to be confirmed from Eazyreach.
 * Tried several possible query names but the GraphQL schema is not introspectable.
 * Check Eazyreach API docs or GraphQL playground for correct field names.
 */
async function resolveOne(prospect) {
  if (!prospect.linkedinUrl) {
    log.debug(`[Eazyreach] No LinkedIn URL for ${prospect.name}, skipping.`);
    return { email: null, isRealEmail: false };
  }

  log.debug(`[Eazyreach] Attempting to resolve ${prospect.linkedinUrl}`);

  try {
    const token = await getAccessToken();

    // Try to find email using GraphQL
    // Note: The exact query name and structure needs Eazyreach API documentation
    const response = await withRetry(() =>
      fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query FindEmail($linkedin: String!) {
              find_email(linkedin_url: $linkedin) {
                email
                status
              }
            }
          `,
          variables: { linkedin: prospect.linkedinUrl },
        }),
      })
    );

    if (!response.ok) {
      const err = await response.text();
      log.debug(
        `[Eazyreach] ${prospect.name} → HTTP ${response.status}`
      );
      return { email: null, isRealEmail: false };
    }

    const data = await response.json();

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const errorMsg = data.errors[0]?.message || "Unknown error";
      
      // If this is a schema error, suggest checking docs
      if (errorMsg.includes("not found") || errorMsg.includes("schema")) {
        log.debug(`[Eazyreach] GraphQL schema issue: ${errorMsg}`);
        log.debug(`[Eazyreach] ⚠️  Check Eazyreach API docs for correct query fields`);
      } else {
        log.debug(`[Eazyreach] ${prospect.name} → GraphQL error: ${errorMsg}`);
      }
      return { email: null, isRealEmail: false };
    }

    // Extract email from response
    const result = data.data?.find_email;
    if (!result) {
      log.debug(`[Eazyreach] ${prospect.name} → No result from query`);
      return { email: null, isRealEmail: false };
    }

    const email = result.email;
    const status = result.status ?? "";

    // Only accept verified/valid emails
    if (!email || ["invalid", "catch_all_invalid", "unknown"].includes(status)) {
      log.debug(`[Eazyreach] ${prospect.name} → Email status: ${status} (rejected)`);
      return { email: null, isRealEmail: false };
    }

    log.success(`[Eazyreach] ${prospect.name} → Resolved: ${email}`);
    return { email, isRealEmail: true };

  } catch (err) {
    log.debug(`[Eazyreach] ${prospect.name} → Exception: ${err.message}`);
    return { email: null, isRealEmail: false };
  }
}

/**
 * Enrich all prospects with work emails.
 * Returns array with { email, isRealEmail } for each prospect.
 * 
 * ⚠️  SAFETY: Tracks isRealEmail flag:
 *   - true: Email verified from Eazyreach API
 *   - false: Email generated as mock fallback (DO NOT SEND WITHOUT REVIEW)
 */
export async function resolveEmails(prospects) {
  const enriched = [];
  let mockCount = 0;

  for (const prospect of prospects) {
    const result = await resolveOne(prospect);
    
    if (result.isRealEmail) {
      // Email was successfully resolved from API
      enriched.push({ ...prospect, email: result.email, isRealEmail: true });
    } else if (!result.email) {
      // Resolution failed — generate mock for demo purposes
      const mockEmail = generateMockEmail(prospect);
      log.warn(`[Eazyreach] ${prospect.name} → Using mock email: ${mockEmail}`);
      enriched.push({ ...prospect, email: mockEmail, isRealEmail: false });
      mockCount++;
    } else {
      // Shouldn't reach here, but handle gracefully
      enriched.push({ ...prospect, email: result.email, isRealEmail: result.isRealEmail });
    }

    await sleep(400); // respect rate limits
  }

  // Warn if any mock emails were used
  if (mockCount > 0) {
    log.warn(`\n⚠️   SAFETY WARNING: ${mockCount}/${prospects.length} emails are MOCK DATA (not verified)`);
    log.warn(`    These prospects have isRealEmail=false and should NOT be sent real outreach`);
  }

  return enriched;
}

/**
 * Generate a mock email for demonstration purposes
 */
function generateMockEmail(prospect) {
  // Extract alphabetic words only to handle names like "CEO of braintreepayments.com"
  const parts = prospect.name.toLowerCase().split(" ").filter(p => /^[a-z]+$/.test(p));
  const firstName = parts[0] || "contact";
  const lastName = parts[1] || "";
  const domain = prospect.domain;
  
  return lastName ? `${firstName}.${lastName}@${domain}` : `${firstName}@${domain}`;
}
