#!/usr/bin/env node

/**
 * Quick test script - runs pipeline with a predefined seed domain
 * Usage: node test.js
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import { findLookalikeDomains } from "./stages/1_ocean.js";
import { findDecisionMakers } from "./stages/2_prospeo.js";
import { resolveEmails } from "./stages/3_eazyreach.js";
import { sendOutreach } from "./stages/4_brevo.js";
import { log, banner, summary } from "./utils/logger.js";

async function test() {
  banner();

  // Debug: Check if env vars are loaded
  console.log("DEBUG - OCEAN_API_KEY loaded:", process.env.OCEAN_API_KEY ? "YES" : "NO");
  console.log("DEBUG - PROSPEO_API_KEY loaded:", process.env.PROSPEO_API_KEY ? "YES" : "NO");
  console.log("DEBUG - EAZYREACH_API_KEY loaded:", process.env.EAZYREACH_API_KEY ? "YES" : "NO");
  console.log("DEBUG - BREVO_API_KEY loaded:", process.env.BREVO_API_KEY ? "YES" : "NO");

  const seedDomain = "stripe.com"; // Test with Stripe
  log.info(`\nTesting pipeline with: ${seedDomain}\n`);

  // ── Stage 1: Ocean.io ─────────────────────────────────────────
  log.stage(1, "Ocean.io — finding lookalike companies");
  try {
    const domains = await findLookalikeDomains(seedDomain);
    log.success(`Found ${domains.length} lookalike domains`);
    domains.slice(0, 5).forEach((d) => log.item(d)); // Show first 5

    if (domains.length === 0) {
      log.error("No lookalike domains found. Exiting.");
      process.exit(1);
    }

    // Limit to 2 domains for quick testing
    const testDomains = domains.slice(0, 2);
    log.info(`\nTesting with first ${testDomains.length} domains only...\n`);

    // ── Stage 2: Prospeo ──────────────────────────────────────────
    log.stage(2, "Prospeo — finding decision-makers");
    const prospects = await findDecisionMakers(testDomains);
    log.success(`Found ${prospects.length} prospects`);
    prospects.forEach((p) =>
      log.item(`${p.name} (${p.title}) @ ${p.company} — ${p.linkedinUrl}`)
    );

    if (prospects.length === 0) {
      log.error("No prospects found. Exiting.");
      process.exit(1);
    }

    // ── Stage 3: Eazyreach ────────────────────────────────────────
    log.stage(3, "Eazyreach — resolving work emails");
    const contacts = await resolveEmails(prospects.slice(0, 3)); // Test with first 3
    const verified = contacts.filter((c) => c.email);
    log.success(`Resolved ${verified.length}/${contacts.length} emails`);
    verified.forEach((c) => log.item(`${c.name} → ${c.email}`));

    if (verified.length === 0) {
      log.error("No emails resolved. Exiting.");
      process.exit(1);
    }

    // ── Show summary (no sending in test) ─────────────────────────
    console.log("\n" + "─".repeat(60));
    log.success("✅  TEST COMPLETE - All stages working!");
    console.log("─".repeat(60));
    summary(seedDomain, testDomains, prospects, verified);
    console.log("─".repeat(60));
    
    log.info("\n💡 Test successful! To send actual emails, run: node pipeline.js\n");

  } catch (err) {
    log.error(`Test failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

test();
