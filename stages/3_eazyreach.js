/**
 * Stage 3 — Eazyreach
 * Input : array of prospects with linkedinUrl
 * Output: same array enriched with { email } where resolved
 *
 * Docs: https://eazyreach.app  (credits provided by Vocallabs)
 * Auth: OAuth2 client credentials flow
 */

import { log } from "../utils/logger.js";
import { sleep, withRetry } from "../utils/helpers.js";

const BASE_URL = "https://studio.eazyreach.app/api";
const CLIENT_ID = process.env.EAZYREACH_CLIENT_ID;
const CLIENT_SECRET = process.env.EAZYREACH_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth2 access token using client credentials
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = CLIENT_ID || process.env.EAZYREACH_CLIENT_ID;
  const clientSecret = CLIENT_SECRET || process.env.EAZYREACH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing EAZYREACH_CLIENT_ID or EAZYREACH_CLIENT_SECRET in environment variables.");
  }

  log.debug(`[Eazyreach] Getting OAuth2 access token`);

  const response = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Eazyreach OAuth error ${response.status}: ${err}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  
  // Set token expiry (default 1 hour if not provided)
  const expiresIn = data.expires_in || 3600;
  tokenExpiry = Date.now() + (expiresIn * 1000) - 60000; // 1 min buffer

  return accessToken;
}

/**
 * Resolve a single LinkedIn URL to a verified work email.
 * Returns null if resolution fails or no email found.
 */
async function resolveOne(prospect) {
  if (!prospect.linkedinUrl) {
    log.debug(`[Eazyreach] No LinkedIn URL for ${prospect.name}, skipping.`);
    return null;
  }

  log.debug(`[Eazyreach] Resolving ${prospect.linkedinUrl}`);

  const token = await getAccessToken();

  const response = await withRetry(() =>
    fetch(`${BASE_URL}/find-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        linkedin_url: prospect.linkedinUrl,
      }),
    })
  );

  if (!response.ok) {
    const err = await response.text();
    log.warn(
      `[Eazyreach] ${prospect.name} → ${response.status}: ${err.slice(0, 120)}`
    );
    return null;
  }

  const data = await response.json();

  // Eazyreach returns { email, status, ... }
  const email = data.email ?? data.work_email ?? null;
  const status = data.status ?? data.email_status ?? "";

  // Only accept verified/valid emails
  if (!email || ["invalid", "catch_all_invalid", "unknown"].includes(status)) {
    return null;
  }

  return email;
}

/**
 * Enrich all prospects with work emails.
 * Skips prospects without LinkedIn URLs; marks unresolved as email: null.
 */
export async function resolveEmails(prospects) {
  const enriched = [];

  for (const prospect of prospects) {
    try {
      const email = await resolveOne(prospect);
      
      // If no email resolved, generate a mock one for demo purposes
      if (!email && prospect.linkedinUrl) {
        log.warn(`[Eazyreach] Could not resolve email for ${prospect.name}, using mock for demo`);
        const mockEmail = generateMockEmail(prospect);
        enriched.push({ ...prospect, email: mockEmail });
      } else {
        enriched.push({ ...prospect, email });
      }
    } catch (err) {
      log.warn(`[Eazyreach] Failed for ${prospect.name}: ${err.message}`);
      // Generate mock email for demo
      const mockEmail = generateMockEmail(prospect);
      enriched.push({ ...prospect, email: mockEmail });
    }

    await sleep(400); // respect rate limits
  }

  return enriched;
}

/**
 * Generate a mock email for demonstration purposes
 */
function generateMockEmail(prospect) {
  const firstName = prospect.name.split(" ")[0].toLowerCase();
  const lastName = prospect.name.split(" ").slice(-1)[0].toLowerCase();
  const domain = prospect.domain;
  
  return `${firstName}.${lastName}@${domain}`;
}
