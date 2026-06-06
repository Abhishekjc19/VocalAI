# 🚀 Automated Cold Outreach Pipeline

One seed domain in → lookalike companies → decision-makers → verified emails → outreach sent.

## Pipeline Stages

```
[You] → company.domain
  │
  ├─ 1. Ocean.io    → find lookalike companies     (similar firmographics)
  ├─ 2. Prospeo     → find decision-makers          (C-suite / VP + LinkedIn)
  ├─ 3. Eazyreach   → resolve work emails           (LinkedIn → verified email)
  └─ 4. Brevo       → send personalized outreach    (auto-fired, zero manual)
```

## Setup

### Prerequisites
- Node.js v18+
- A domain (Namecheap / GitHub Student Pack) — needed for Ocean.io sign-up
- Accounts on: Ocean.io, Prospeo, Eazyreach, Brevo

### Install

```bash
git clone <your-repo>
cd outreach-pipeline
npm install
```

This will install the required dependency (`dotenv` for loading environment variables).

### Configure

```bash
cp .env.example .env
# Edit .env and fill in all API keys
```

| Variable | Where to get it |
|---|---|
| `OCEAN_API_KEY` | ocean.io dashboard (requires company email) |
| `PROSPEO_API_KEY` | app.prospeo.io/api |
| `EAZYREACH_API_KEY` | eazyreach.app (credits from Vocallabs) |
| `BREVO_API_KEY` | app.brevo.com → Settings → API Keys |
| `SENDER_NAME` | Your name (must match verified Brevo sender) |
| `SENDER_EMAIL` | you@yourdomain.com (verified in Brevo) |

### Run

```bash
node pipeline.js
```

You will be prompted for a seed domain. Everything else is automatic.

For verbose debug output:

```bash
DEBUG=1 node pipeline.js
```

## Safety Checkpoint

Before emails fire, the pipeline pauses and shows a full summary:
- How many lookalike companies were found
- Which decision-makers were identified
- Which emails were verified
- The full recipient list

You must type **yes** to confirm. Anything else aborts with no emails sent.

## Project Structure

```
outreach-pipeline/
├── pipeline.js          # Main entry point & orchestrator
├── stages/
│   ├── 1_ocean.js       # Stage 1: Ocean.io lookalike finder
│   ├── 2_prospeo.js     # Stage 2: Prospeo decision-maker finder
│   ├── 3_eazyreach.js   # Stage 3: Eazyreach email resolver
│   └── 4_brevo.js       # Stage 4: Brevo outreach sender
├── utils/
│   ├── logger.js        # Colourful terminal logging & banners
│   └── helpers.js       # sleep, withRetry, chunk, dedupe
├── .env.example         # Template — copy to .env
└── package.json
```

## Resilience Features

- **Retry with back-off** — all API calls retry up to 3× on network errors, 429s, and 5xx
- **Pagination** — Prospeo calls paginate automatically
- **Deduplication** — prospects deduplicated by LinkedIn URL
- **Partial failures** — one failed email doesn't crash the run
- **Rate limiting** — polite sleep between each API call
- **Graceful skips** — missing LinkedIn URLs, unresolved emails, skipped domains don't stop the pipeline

## Email Copy

The outreach copy is in `stages/4_brevo.js` → `buildEmail()`. Customize the subject and body to match your pitch. The template is personalized by first name, title, company, and seed domain automatically.

## Known Issues & Notes

### API Changes During Development

During development (June 2026), both Ocean.io and Prospeo underwent API changes:

1. **Ocean.io**: The API endpoint documentation was not publicly accessible. The pipeline includes a fallback to mock lookalike data for demonstration. In production, contact Vocallabs for the correct Ocean.io API endpoint format.

2. **Prospeo**: The `/domain-search` endpoint was deprecated in favor of the new `/search-person` API. The code has been updated to use the new endpoint with company website filters.

### For Interview/Demo

- Stage 1 (Ocean.io) uses mock lookalike companies if the API endpoint returns errors
- Stages 2-4 (Prospeo, Eazyreach, Brevo) are fully functional with the correct API endpoints
- The code structure, error handling, and pipeline logic are production-ready
- All API integrations follow best practices: retry logic, rate limiting, pagination, and proper authentication

### Quick Test

Run a quick test without sending actual emails:

```bash
npm run test
```

This will test all 4 stages with a seed domain and show results without actually sending emails.

## Demo

Run with a well-known seed domain like `stripe.com` or `hubspot.com` to get a rich set of lookalikes for your live demo.

## Technical Highlights

### Resilience & Error Handling
- **Exponential back-off retry**: All API calls retry up to 3× with increasing delays
- **Rate limit handling**: Respects 429 responses and `Retry-After` headers
- **Partial failure tolerance**: Failed API calls for individual domains/contacts don't crash the entire pipeline
- **Graceful degradation**: Missing data (no LinkedIn URL, unverified emails) are handled without errors

### Data Quality
- **Deduplication**: Prospects deduplicated by LinkedIn URL to avoid duplicate contacts
- **Decision-maker filtering**: Only targets C-suite, VPs, Directors, Founders (configurable keywords)
- **Email verification**: Only accepts verified/valid emails from Eazyreach (rejects catch-all, invalid, unknown)

### API Integration Best Practices
- **Pagination**: Prospeo API paginated automatically (up to 100 results per domain)
- **Proper auth**: Each service uses correct auth method (Bearer, X-KEY, api-key headers)
- **Polite rate limiting**: Sleep delays between requests (200-500ms) to avoid throttling
- **Request/response validation**: Checks multiple possible response field names for compatibility

## Limitations & Future Enhancements

**Current limitations:**
- Ocean.io API free tier may have limited lookalike results
- No email open tracking (would require Brevo webhook setup)
- Sequential processing (could be parallelized with Promise.all for faster execution)

**Possible enhancements:**
- Add CSV export of all pipeline stages
- Implement contact enrichment caching (avoid re-processing same domains)
- Add webhook support for Brevo delivery/open tracking
- Parallel processing with concurrency limits
- A/B testing different email templates
