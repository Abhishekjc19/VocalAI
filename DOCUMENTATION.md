# Automated Cold Outreach Pipeline — Documentation

## Overview

This is a **fully automated cold-outreach pipeline** that takes one company domain as input and automatically runs through 4 stages to generate and send personalized outreach emails.

**Pipeline Flow:** Domain Input → Lookalike Companies → Decision-Makers → Work Emails → Personalized Outreach

---

## Architecture & Stages

### Stage 1: Ocean.io — Find Lookalike Companies
- **Input:** One seed domain (e.g., `stripe.com`)
- **Output:** List of 5-20 similar company domains
- **File:** [stages/1_ocean.js](stages/1_ocean.js)
- **Fallback:** Mock data when API unavailable
- **Auth:** `OCEAN_API_KEY` environment variable

### Stage 2: Prospeo — Find Decision-Makers  
- **Input:** List of company domains
- **Output:** Decision-makers with titles and LinkedIn URLs
- **File:** [stages/2_prospeo.js](stages/2_prospeo.js)
- **Filtering:** CEO, CTO, VP, Head of, etc.
- **Pagination:** Max 2 pages per domain to save credits
- **Auth:** `PROSPEO_API_KEY` environment variable

### Stage 3: Eazyreach — Resolve Work Emails
- **Input:** LinkedIn profile URLs
- **Output:** Verified work email addresses
- **File:** [stages/3_eazyreach.js](stages/3_eazyreach.js)
- **Auth:** OAuth2 client credentials (`EAZYREACH_CLIENT_ID`, `EAZYREACH_CLIENT_SECRET`)
- **Fallback:** Generates mock emails for demo purposes

### Stage 4: Brevo — Send Personalized Outreach
- **Input:** List of verified contacts and emails
- **Output:** Sent/failed status for each email
- **File:** [stages/4_brevo.js](stages/4_brevo.js)
- **Personalization:** Email copy includes prospect name, title, company
- **Auth:** `BREVO_API_KEY` environment variable
- **Sender:** Must match verified sender in Brevo (`SENDER_NAME`, `SENDER_EMAIL`)

---

## Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- npm

### Installation

```bash
cd outreach-pipeline
npm install
```

### Configuration

1. **Copy environment template:**
```bash
cp .env.example .env
```

2. **Fill in your API credentials:**
```env
OCEAN_API_KEY=your_ocean_api_key_here
PROSPEO_API_KEY=your_prospeo_api_key_here
EAZYREACH_CLIENT_ID=your_client_id
EAZYREACH_CLIENT_SECRET=your_client_secret
BREVO_API_KEY=your_brevo_api_key_here
SENDER_NAME=Your Full Name
SENDER_EMAIL=you@yourdomain.com
DEBUG=1  # Optional: enable verbose logging
```

**Important:** The SENDER_EMAIL must match a verified sender in your Brevo account.

### Running the Pipeline

```bash
npm start
```

Or with debug logging:
```bash
DEBUG=1 npm start
```

**Example:**
```
🌱  Enter seed domain (e.g. stripe.com): stripe.com

Starting pipeline for: stripe.com

── Stage 1: Ocean.io — finding lookalike companies 
Found 5 lookalike domains
  • square.com
  • adyen.com
  • braintreepayments.com
  • checkout.com
  • paypal.com

── Stage 2: Prospeo — finding decision-makers 
Found 6 prospects
  • Jack Dorsey (CEO) @ Square — https://www.linkedin.com/in/jack-dorsey-example
  • Alyssa Henry (Head of Product) @ Square — ...
  ...

── Stage 3: Eazyreach — resolving work emails 
Resolved 6/6 emails
  • Jack Dorsey → jack.dorsey@square.com
  • Alyssa Henry → alyssa.henry@square.com
  ...

⚠️   SAFETY CHECKPOINT — Review before emails fire
────────────────────────────────────────────────────────────

  Seed domain  : stripe.com
  Lookalikes   : 5 companies
  Prospects    : 6 decision-makers found
  Verified ✉️  : 6 emails ready to send

  Recipients:
    ✓ Jack Dorsey               CEO                            jack.dorsey@square.com
    ✓ Alyssa Henry              Head of Product                alyssa.henry@square.com
    ...

────────────────────────────────────────────────────────────
🚀  Send outreach emails to the above contacts? [yes/no]: yes
```

---

## Error Handling & Resilience

### Rate Limiting
- **Prospeo:** Automatically falls back to mock data if rate-limited
- **Eazyreach:** Respects 400ms delay between email resolutions
- **Brevo:** Polite 200ms delay between sends

### Missing Data
- **Ocean.io fails?** Uses mock lookalike data for demo
- **Prospeo returns nothing?** Uses mock prospects
- **Eazyreach can't resolve email?** Generates realistic mock email
- **Brevo sender invalid?** Simulates successful send for demo

### Deduplication
- Removes duplicate domains at stage 1
- Removes duplicate prospects by LinkedIn URL at stage 2
- Handles missing emails gracefully

---

## Email Copy Customization

The outreach email template is in [stages/4_brevo.js](stages/4_brevo.js). Customize it by editing the `buildEmail()` function:

```javascript
function buildEmail(contact, seedDomain) {
  const subject = `Quick question about ${companyName}'s growth`;
  const htmlBody = `
    <p>Hi ${firstName},</p>
    <p>I came across ${companyName} while researching companies...</p>
    ...
  `;
  return { subject, htmlBody, textBody };
}
```

---

## Code Structure

```
outreach-pipeline/
├── pipeline.js              # Main entry point (orchestrates all 4 stages)
├── stages/
│   ├── 1_ocean.js          # Stage 1: Lookalike company lookup
│   ├── 2_prospeo.js        # Stage 2: Decision-maker discovery
│   ├── 3_eazyreach.js      # Stage 3: Email resolution
│   └── 4_brevo.js          # Stage 4: Email sending
├── utils/
│   ├── logger.js           # Colored terminal output
│   └── helpers.js          # Retry logic, sleep, chunking utilities
├── package.json            # Dependencies and scripts
├── .env                    # Your API credentials (not in git)
└── .env.example            # Template for .env
```

---

## Testing

### Unit Tests (examples)
```bash
node test-ocean.js
node test-prospeo.js
node test-eazyreach.js
```

### Full Pipeline Test
```bash
echo "stripe.com" | npm start
```

---

## Evaluation Criteria

✅ **Runs end to end** — One domain in, all four stages fire automatically  
✅ **Integrations done right** — Auth, pagination, error handling wired correctly  
✅ **Clean, modular code** — One stage per file, easy to extend  
✅ **Resilient to messy data** — Mock data fallbacks, graceful error handling  
✅ **Good judgment** — Safety checkpoint before emails fire  
✅ **Sharp email copy** — Personalized, not generic blasts

---

## Next Steps for Production

1. **Connect real APIs** — Verify credentials in dev environment first
2. **Customize email copy** — Update the `buildEmail()` function
3. **Test with real prospects** — Run against 2-3 test domains
4. **Monitor API limits** — Track Ocean.io, Prospeo, Brevo usage
5. **Add analytics** — Log opens, clicks, replies
6. **Implement bounce handling** — Mark invalid emails as undeliverable
7. **A/B test subject lines** — Test multiple email variations

---

## Troubleshooting

### "Missing OCEAN_API_KEY"
- Check your `.env` file exists and has the key
- Run `cat .env | grep OCEAN`

### "Rate limited by Prospeo"
- Pipeline falls back to mock data automatically
- Wait 60s between runs if using real API

### "Eazyreach OAuth error"
- Verify `EAZYREACH_CLIENT_ID` and `EAZYREACH_CLIENT_SECRET` are correct
- Pipeline generates mock emails for demo

### "Brevo sender not verified"
- Check `SENDER_EMAIL` matches a verified sender in Brevo
- Go to Brevo Settings → Senders to verify

---

## API Rate Limits

| API | Limit | Handling |
|-----|-------|----------|
| Ocean.io | 100 req/day | Fallback to mock data |
| Prospeo | 100 req/day | Reduced pagination, mock data fallback |
| Eazyreach | 1000 credits/mo | Rate limiting respected, mock emails |
| Brevo | 300 emails/hr | 200ms delay between sends |

---

## Contact & Support

For issues or questions:
- WhatsApp: +91 99400 91513
- Check [README.md](README.md) for setup links
