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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  banner();

  // ── Human input ──────────────────────────────────────────────
  const seedDomain = (
    await ask("\n🌱  Enter seed domain (e.g. stripe.com): ")
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
  log.success(`Resolved ${verified.length}/${contacts.length} emails`);
  verified.forEach((c) => log.item(`${c.name} → ${c.email}`));

  if (verified.length === 0) {
    log.error("No emails resolved. Exiting.");
    process.exit(1);
  }

  // ── Safety checkpoint ─────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  log.warn("⚠️   SAFETY CHECKPOINT — Review before emails fire");
  console.log("─".repeat(60));
  summary(seedDomain, domains, prospects, verified);
  console.log("─".repeat(60));

  const confirm = (
    await ask("\n🚀  Send outreach emails to the above contacts? [yes/no]: ")
  )
    .trim()
    .toLowerCase();

  if (confirm !== "yes" && confirm !== "y") {
    log.warn("Aborted. No emails were sent.");
    rl.close();
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

  rl.close();
}

main().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
