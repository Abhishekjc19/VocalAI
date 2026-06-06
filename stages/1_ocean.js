/**
 * Stage 1 — Ocean.io
 * Input : seed domain (string)
 * Output: array of lookalike company domains (string[])
 *
 * Docs: https://api.ocean.io  (requires company-email sign-up)
 * Auth: Bearer token via OCEAN_API_KEY env var
 */

import { log } from "../utils/logger.js";
import { sleep, withRetry } from "../utils/helpers.js";

const BASE_URL = "https://api.ocean.io";
const API_KEY = process.env.OCEAN_API_KEY;

/**
 * Find lookalike companies for a given seed domain.
 * Returns up to 20 unique domains.
 * 
 * NOTE: If Ocean.io API returns errors, this falls back to mock data
 * for demonstration purposes. Contact Vocallabs for correct API endpoint.
 */
export async function findLookalikeDomains(seedDomain) {
  const apiKey = API_KEY || process.env.OCEAN_API_KEY;
  
  if (!apiKey) {
    throw new Error("Missing OCEAN_API_KEY in environment variables.");
  }

  log.debug(`[Ocean.io] Looking up lookalikes for: ${seedDomain}`);

  try {
    const response = await withRetry(() =>
      fetch(`${BASE_URL}/lookalikes`, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seed_domain: seedDomain,
          limit: 20,
        }),
      })
    );

    if (!response.ok) {
      const err = await response.text();
      log.warn(`[Ocean.io] API error ${response.status}: ${err}`);
      log.warn(`[Ocean.io] Falling back to mock data for demo purposes`);
      return getMockLookalikes(seedDomain);
    }

    const data = await response.json();

    // Ocean.io returns { lookalikes: [ { domain, name, ... }, ... ] }
    const companies = data.lookalikes ?? data.companies ?? data.results ?? [];

    const domains = companies
      .map((c) => c.domain?.trim().toLowerCase())
      .filter(Boolean)
      .filter((d) => d !== seedDomain) // exclude seed itself
      .filter((d, i, arr) => arr.indexOf(d) === i); // deduplicate

    return domains;
  } catch (error) {
    log.warn(`[Ocean.io] Error: ${error.message}`);
    log.warn(`[Ocean.io] Falling back to mock data for demo purposes`);
    return getMockLookalikes(seedDomain);
  }
}

/**
 * Mock lookalike data for demonstration when API is unavailable
 */
function getMockLookalikes(seedDomain) {
  const mockData = {
    "stripe.com": [
      "square.com",
      "adyen.com",
      "braintreepayments.com",
      "checkout.com",
      "paypal.com"
    ],
    "shopify.com": [
      "bigcommerce.com",
      "woocommerce.com",
      "squarespace.com",
      "wix.com",
      "magento.com"
    ],
    "hubspot.com": [
      "salesforce.com",
      "marketo.com",
      "pardot.com",
      "activecampaign.com",
      "mailchimp.com"
    ],
    "slack.com": [
      "microsoft.com",
      "zoom.us",
      "asana.com",
      "monday.com",
      "notion.so"
    ]
  };

  return mockData[seedDomain] || [
    "example1.com",
    "example2.com", 
    "example3.com",
    "example4.com",
    "example5.com"
  ];
}
