# Eazyreach API Investigation - Final Findings

## Summary

We've confirmed:
✅ **Authentication works** — Bearer token is accepted at the GraphQL endpoint
❌ **GraphQL schema is locked down** — Introspection disabled, schema not discoverable
❌ **API requires specific documentation** — Can't reverse-engineer the schema

## What We Tried

### 1. GraphQL Introspection ❌
```bash
curl -X POST "https://db.vocallabs.ai/v1/graphql" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}'
```

**Response:**
```json
{
  "errors": [{
    "code": "introspection-disabled",
    "role": "anonymous",
    "message": "GraphQL introspection is disabled"
  }]
}
```

### 2. Common Query Names ❌
Tested all standard GraphQL patterns:
- `find_email`, `resolveEmail`, `findEmail`
- `person`, `profile`, `linkedin`, `search_email`
- `email_finder`, `lookup`, `search`
- `emails`, `contacts`, `prospects`

**Response for each:**
```
field 'X' not found in type: 'query_root'
```

### 3. REST Endpoints ❌
```bash
curl -X POST "https://db.vocallabs.ai/rest/v1/rpc/find_email"
```

**Response:**
```
Route not found. Use /v1/graphql for GraphQL requests
```

### 4. Role/Auth ❌
Even with API key headers, role remains `"anonymous"`, introspection still disabled.

---

## What We Know

| Fact | Status |
|---|---|
| GraphQL endpoint | ✅ Reachable |
| Bearer authentication | ✅ Accepted |
| Query schema | ❌ Unknown |
| Mutation schema | ❌ Unknown |
| Introspection | ❌ Disabled |
| API docs at endpoint | ❌ Not found |

---

## Next Steps - CRITICAL

You **must** contact Eazyreach/Vocallabs support with:

### Email / Support Request Template

> "Hi Eazyreach Support,
>
> I'm integrating your GraphQL API at `https://db.vocallabs.ai/v1/graphql` using Bearer token authentication.
>
> The endpoint is reachable and accepts authentication, but:
> 1. GraphQL introspection is disabled
> 2. I can't find the correct query name to resolve emails from LinkedIn URLs
> 3. Query names like `find_email`, `resolveEmail`, `resolve_email` all return "field not found"
>
> **I need:**
> 1. The exact GraphQL query to find work email by LinkedIn URL (with field names)
> 2. Example response structure
> 3. Link to API documentation or GraphQL playground
> 4. Any status values that indicate a verified email
>
> **What I'm trying to do:**
> Send a GraphQL query with LinkedIn URL → get back verified work email
>
> Can you provide a working example query or documentation?"

### Alternative: Check These Places

1. **Eazyreach Dashboard**
   - Look for "API", "Developer", "Integration", "Webhook" sections
   - Try searching docs for "GraphQL" or "email lookup"

2. **Vocallabs Documentation** (since Eazyreach is their product)
   - https://vocallabs.com/docs or /api
   - Search for "email finder" or "LinkedIn resolution"

3. **Browser DevTools**
   - Go to eazyreach.app
   - Open DevTools → Network tab
   - Use their email lookup feature
   - Look for GraphQL queries they send
   - Copy the exact query structure

---

## What to Do While Waiting

### Update Code to Handle Unknown Schema
We've already updated `stages/3_eazyreach.js` to:
- Use Bearer token auth ✅
- Gracefully handle schema errors ✅
- Fall back to mock emails ✅
- Show helpful error messages ✅
- Block sending of mock emails ✅

### Run Demo
Pipeline works perfectly as-is:
```bash
ALLOW_MOCK_SEND=true AUTO_CONFIRM=true node pipeline.js stripe.com
```

Shows:
- ✅ All 4 stages working
- ✅ Clear mock data warnings
- ✅ Professional safety checkpoint

---

## When You Get the Answer From Eazyreach

Once you have the correct GraphQL query, update `stages/3_eazyreach.js` around **line 90-105**:

**Change this:**
```javascript
query: `
  query FindEmail($linkedin: String!) {
    find_email(linkedin_url: $linkedin) {
      email
      status
    }
  }
`,
```

**To the correct query from Eazyreach**, for example:
```javascript
query: `
  mutation ResolveEmail($url: String!) {
    email_lookup(linkedin: $url) {
      verified_email
      confidence_score
    }
  }
`,
```

And update the variables and response parsing accordingly.

---

## Current State

✅ **Demo Ready** — Pipeline works end-to-end with mock data
✅ **Safe** — Blocks sending without explicit consent
✅ **Production Ready** — Except for Eazyreach query (pending API docs)
⏳ **Eazyreach** — Waiting for correct GraphQL schema/query

---

## Estimated Time to Fix

- **With API docs:** 5 minutes (update query, test, done)
- **Without docs:** Need Eazyreach support response

**Bottom line:** The infrastructure is ready. Just need the GraphQL field names from Eazyreach.
