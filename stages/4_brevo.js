/**
 * Stage 4 — Brevo (formerly Sendinblue)
 * Input : verified contacts [ { name, title, company, email } ]
 * Output: results [ { email, success, messageId?, reason? } ]
 *
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 * Auth: api-key header via BREVO_API_KEY env var
 *
 * SENDER_NAME and SENDER_EMAIL must match your verified Brevo sender.
 */

import { log } from "../utils/logger.js";
import { sleep, withRetry } from "../utils/helpers.js";

const BASE_URL = "https://api.brevo.com/v3";
const API_KEY = process.env.BREVO_API_KEY;
// Note: SENDER_NAME and SENDER_EMAIL are read from process.env in functions
// to ensure they're loaded after dotenv runs

/**
 * Build a personalized email for one contact.
 * Customize this copy — it's what they'll actually read.
 */
function buildEmail(contact, seedDomain) {
  const senderName = process.env.SENDER_NAME || "Your Name";
  const senderEmail = process.env.SENDER_EMAIL || "you@yourdomain.com";
  
  const firstName = contact.name.split(" ")[0];
  const companyName = contact.company ?? contact.domain;

  const subject = `Quick question about ${companyName}'s growth`;

  const htmlBody = `
<p>Hi ${firstName},</p>

<p>I came across ${companyName} while researching companies in a similar space 
to ${seedDomain} — the work you're doing stood out immediately.</p>

<p>I'm reaching out because we help businesses like yours automate their 
sales outreach — identifying the right contacts, verifying their details, 
and engaging them at scale — all without the manual grunt work.</p>

<p>Given your role as ${contact.title}, I suspect pipeline efficiency 
is something you care about. Happy to show you a 10-minute demo of what 
we've built — would that be worth your time this week?</p>

<p>Either way, keep up the great work at ${companyName}.</p>

<p>Best,<br/>
${senderName}<br/>
${senderEmail}</p>
  `.trim();

  const textBody = `
Hi ${firstName},

I came across ${companyName} while researching companies similar to ${seedDomain} — the work you're doing stood out.

I'm reaching out because we help businesses automate their sales outreach — identifying the right contacts, verifying their details, and engaging them at scale.

Given your role as ${contact.title}, I suspect pipeline efficiency matters to you. Happy to show you a quick 10-minute demo — would that be worth your time this week?

Best,
${senderName}
  `.trim();

  return { subject, htmlBody, textBody };
}

/**
 * Send a single transactional email via Brevo.
 */
async function sendOne(contact, seedDomain) {
  const apiKey = API_KEY || process.env.BREVO_API_KEY;
  const senderName = process.env.SENDER_NAME || "Your Name";
  const senderEmail = process.env.SENDER_EMAIL || "you@yourdomain.com";
  
  const { subject, htmlBody, textBody } = buildEmail(contact, seedDomain);

  const response = await withRetry(() =>
    fetch(`${BASE_URL}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: contact.email, name: contact.name }],
        subject,
        htmlContent: htmlBody,
        textContent: textBody,
        tags: ["outreach-pipeline"],
      }),
    })
  );

  if (!response.ok) {
    const err = await response.text();
    return { email: contact.email, success: false, reason: err.slice(0, 200) };
  }

  const data = await response.json();
  return { email: contact.email, success: true, messageId: data.messageId };
}

/**
 * Send personalized outreach to all verified contacts.
 */
export async function sendOutreach(contacts, seedDomain) {
  const apiKey = API_KEY || process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || "you@yourdomain.com";
  const senderName = process.env.SENDER_NAME || "Your Name";
  
  if (!apiKey) {
    throw new Error("Missing BREVO_API_KEY in environment variables.");
  }
  if (!senderEmail || senderEmail === "you@yourdomain.com" || !senderEmail.includes("@")) {
    throw new Error(
      "Set SENDER_EMAIL and SENDER_NAME env vars to your verified Brevo sender."
    );
  }

  const results = [];

  for (const contact of contacts) {
    if (!contact.email) continue;

    try {
      const result = await sendOne(contact, seedDomain);
      results.push(result);

      if (result.success) {
        log.success(`  ✓ Sent → ${contact.name} <${contact.email}>`);
      } else {
        log.warn(`  ✗ Failed → ${contact.email}: ${result.reason}`);
      }
    } catch (err) {
      log.warn(`  ✗ Error → ${contact.email}: ${err.message}`);
      results.push({ email: contact.email, success: false, reason: err.message });
    }

    await sleep(200); // Brevo rate limit: generous, but be polite
  }

  return results;
}
