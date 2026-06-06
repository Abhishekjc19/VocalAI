# Eazyreach GraphQL API Migration

## Current Status ⚠️

The pipeline is now **safe for demo**, but Eazyreach integration needs the correct GraphQL setup. 

### What Just Changed

1. **Mock Data Tracking**: All emails now have `isRealEmail` flag
   - `true` = Verified from Eazyreach API
   - `false` = Generated mock (marked with ⚠ MOCK in output)

2. **Safety Block**: Pipeline prevents sending mock emails unless:
   - All emails are real (API verified), OR
   - `ALLOW_MOCK_SEND=true` env var is set (demo mode)

3. **GraphQL Ready**: Code now uses GraphQL endpoint `/v1/graphql` instead of REST

### Current OAuth Error

```
404: {"error":"Route not found. Use /v1/graphql for GraphQL requests"}
```

This means the auth endpoint is being hit, but credentials are **not valid** for the current Eazyreach account.

---

## How to Fix Eazyreach Integration

### Step 1: Verify Your Credentials

Check in `.env`:
```bash
EAZYREACH_CLIENT_ID=???
EAZYREACH_CLIENT_SECRET=???
```

**Question**: Are these definitely correct for your Eazyreach account?

### Step 2: Check Auth Flow

The code tries two auth methods (in order):

**Method A** (current attempt):
```javascript
{
  client_id: EAZYREACH_CLIENT_ID,
  client_secret: EAZYREACH_CLIENT_SECRET
}
```

**Method B** (fallback if A fails):
```javascript
{
  email: EAZYREACH_CLIENT_ID,      // Try treating it as email
  password: EAZYREACH_CLIENT_SECRET
}
```

**Action**: Check your Eazyreach/Vocallabs dashboard:
- Is CLIENT_ID a client ID or an email address?
- Should we use `email` + `password` instead?

### Step 3: Verify GraphQL Endpoint

Once authenticated, the query will be:

```graphql
query FindEmail($linkedin: String!) {
  find_email(linkedin_url: $linkedin) {
    email
    status
  }
}
```

**This assumes** the GraphQL schema matches. If Eazyreach uses different field names, you'll get a schema error.

### Step 4: Get API Documentation

**Recommended**: 
1. Go to your Eazyreach/Vocallabs dashboard
2. Look for "API" or "GraphQL Playground" section
3. Check:
   - Exact auth flow (client credentials vs email/password vs API key?)
   - GraphQL query for finding emails by LinkedIn URL
   - Response field names (is it `email`? `work_email`? Something else?)
   - Status field values (what indicates "verified"?)

### Step 5: Update the Code

Once you have the correct auth method, update [stages/3_eazyreach.js](stages/3_eazyreach.js):

#### If auth uses API key instead:
```javascript
async function getAccessToken() {
  // Return the API key directly if not using OAuth
  return process.env.EAZYREACH_API_KEY;
}

// Then in resolveOne():
const response = await fetch(GRAPHQL_ENDPOINT, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.EAZYREACH_API_KEY}`,  // Or "X-API-Key"
    "Content-Type": "application/json",
  },
  // ... rest of query
});
```

#### If GraphQL query schema is different:
```javascript
const query = `
  query FindEmail($linkedin: String!) {
    find_email(linkedin_url: $linkedin) {
      email           # Change field names here
      verified_status # if different from "status"
    }
  }
`;
```

---

## Testing the Fix

Once you update credentials/auth:

### Test 1: Basic auth
```bash
node pipeline.js stripe.com
```

Look for in output:
```
✓ [Eazyreach] CEO of stripe → Resolved: john.doe@stripe.com
```

(NOT ⚠ MOCK — should say "Resolved:")

### Test 2: Verify no safety block
```bash
ALLOW_MOCK_SEND=false AUTO_CONFIRM=false node pipeline.js stripe.com
```

Should **NOT** show the safety block if all emails are real:
```
SAFETY BLOCK: 5/5 emails are MOCK DATA ❌
```

### Test 3: Full end-to-end with real credentials
```bash
AUTO_CONFIRM=true node pipeline.js stripe.com
```

Should show green checkmarks for all Eazyreach emails, then proceed to send.

---

## Until Eazyreach is Fixed

**For your interview demo**, you can run with:
```bash
ALLOW_MOCK_SEND=true AUTO_CONFIRM=true node pipeline.js stripe.com
```

This clearly shows:
- ✅ Pipeline architecture works end-to-end
- ✅ All 4 stages execute in sequence
- ✅ Safety checkpoint prevents real spam
- ⚠️  Eazyreach auth needs credentials (will fix before production)

---

## Questions for Eazyreach Support

If you contact them:

1. "What's the correct OAuth2 flow for accessing the GraphQL API?"
2. "Are EAZYREACH_CLIENT_ID and CLIENT_SECRET the right creds, or do we need API key?"
3. "What's the GraphQL query to find email by LinkedIn URL?"
4. "What status values indicate a verified email?"
5. "Do you have API docs or GraphQL schema reference?"

---

## Useful Debug Command

To test auth directly:
```bash
curl -X POST "https://db.vocallabs.ai/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }'
```

If it returns `access_token`, auth is working. Copy that token and test the GraphQL query:

```bash
curl -X POST "https://db.vocallabs.ai/v1/graphql" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query FindEmail($linkedin: String!) { find_email(linkedin_url: $linkedin) { email status } }",
    "variables": { "linkedin": "https://www.linkedin.com/in/some-profile" }
  }'
```

---

## Code Location

All changes in: [stages/3_eazyreach.js](stages/3_eazyreach.js)

Key functions:
- `getAccessToken()` — OAuth flow (lines 25-74)
- `resolveOne()` — GraphQL query (lines 81-146)
- `resolveEmails()` — Tracks isRealEmail flag (lines 153-185)
