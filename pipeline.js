#!/usr/bin/env node

/**
 * Automated Cold Outreach Pipeline
 * Input: one seed domain → Output: personalized emails sent
 *
 * Stages:
 *  1. Ocean.io   – find lookalike companies
 *  2. Prospeo    – find decision-makers + LinkedIn URLs
 *  3. Eazyreach  – resolve LinkedIn URLs → verified emails
 *  4. Brevo      – send personalized outreach emails
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { findLookalikeDomains } from "./stages/1_ocean.js";
import { findDecisionMakers } from "./stages/2_prospeo.js";
import { resolveEmails } from "./stages/3_eazyreach.js";
import { sendOutreach } from "./stages/4_brevo.js";
import { log, banner, summary } from "./utils/logger.js";

let rl;

const ask = (q) => {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return new Promise((res) => rl.question(q, res));
};

/**
 * Read seed domain from command-line args, environment, or stdin
 */
async function getSeedDomain() {
  // Check command-line argument first
  if (process.argv[2]) {
    return process.argv[2];
  }

  // Check environment variable  
  if (process.env.SEED_DOMAIN) {
    return process.env.SEED_DOMAIN;
  }

  if (!process.stdin.isTTY) {
    // Piped input — read from stdin directly
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.on("data", (chunk) => {
        data += chunk.toString();
      });
      process.stdin.on("end", () => {
        resolve(data.trim());
      });
      process.stdin.on("error", reject);
      
      // Timeout after 500ms if no data
      setTimeout(() => {
        if (!data) resolve("");
      }, 500);
    });
  } else {
    // Interactive mode — prompt user
    return await ask("\n🌱  Enter seed domain (e.g. stripe.com): ");
  }
}

async function main() {
  banner();

  // ── Human input ──────────────────────────────────────────────
  const seedDomain = (
    await getSeedDomain()
  ).trim();

  if (!seedDomain || !seedDomain.includes(".")) {
    log.error("Invalid domain. Example: stripe.com");
    process.exit(1);
  }

  log.info(`\nStarting pipeline for: ${seedDomain}\n`);

  // ── Stage 1: Ocean.io ─────────────────────────────────────────
  log.stage(1, "Ocean.io — finding lookalike companies");
  const domains = await findLookalikeDomains(seedDomain);
  log.success(`Found ${domains.length} lookalike domains`);
  domains.forEach((d) => log.item(d));

  if (domains.length === 0) {
    log.error("No lookalike domains found. Exiting.");
    process.exit(1);
  }

  // ── Stage 2: Prospeo ──────────────────────────────────────────
  log.stage(2, "Prospeo — finding decision-makers");
  const prospects = await findDecisionMakers(domains);
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
  const contacts = await resolveEmails(prospects);
  const verified = contacts.filter((c) => c.email);
  const realEmails = verified.filter((c) => c.isRealEmail === true);
  const mockEmails = verified.filter((c) => c.isRealEmail === false);
  
  log.success(`Resolved ${verified.length}/${contacts.length} emails`);
  verified.forEach((c) => {
    const badge = c.isRealEmail ? "✓" : "⚠ MOCK";
    log.item(`${c.name} → ${c.email} [${badge}]`);
  });

  if (verified.length === 0) {
    log.error("No emails resolved. Exiting.");
    process.exit(1);
  }

  // ── Safety checkpoint ─────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  log.warn("⚠️   SAFETY CHECKPOINT — Review before emails fire");
  console.log("─".repeat(60));
  summary(seedDomain, domains, prospects, verified);
  
  // Check for mock emails
  if (mockEmails.length > 0) {
    console.log("─".repeat(60));
    log.error(`\n❌  SAFETY BLOCK: ${mockEmails.length}/${verified.length} emails are MOCK DATA`);
    log.error("    Mock emails marked with ⚠ above should NOT be sent real outreach.\n");
    log.error("    To proceed, you must:\n");
    log.error("    1. Verify Eazyreach API credentials in .env");
    log.error("    2. Check that GraphQL endpoint is working");
    log.error("    3. Re-run the pipeline with working API\n");
    log.warn("    For demo purposes only, set: ALLOW_MOCK_SEND=true");
    console.log("─".repeat(60));

    const allowMock = process.env.ALLOW_MOCK_SEND === "true";
    if (!allowMock) {
      log.error("\nAborting. Mock emails cannot be sent without explicit override.");
      if (rl) rl.close();
      process.exit(1);
    }
  }

  console.log("─".repeat(60));

  let confirm = "no";
  if (process.stdin.isTTY) {
    // Interactive mode — ask the user
    confirm = (
      await ask("\n🚀  Send outreach emails to the above contacts? [yes/no]: ")
    )
      .trim()
      .toLowerCase();
  } else {
    // Piped/automated mode — use environment variable
    confirm = process.env.AUTO_CONFIRM === "true" ? "yes" : "no";
    log.info(`\n🚀  Auto-confirm: ${confirm} (set AUTO_CONFIRM=true to send)`);
  }

  if (confirm !== "yes" && confirm !== "y") {
    log.warn("Aborted. No emails were sent.");
    if (rl) rl.close();
    process.exit(0);
  }

  // ── Stage 4: Brevo ────────────────────────────────────────────
  log.stage(4, "Brevo — sending personalized outreach");
  const results = await sendOutreach(verified, seedDomain);
  const sent = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  log.success(`\n✅  Pipeline complete!`);
  log.info(`   Sent:   ${sent.length}`);
  if (failed.length > 0) {
    log.warn(`   Failed: ${failed.length}`);
    failed.forEach((f) => log.error(`     ✗ ${f.email} — ${f.reason}`));
  }

  if (rl) rl.close();
}

main().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
