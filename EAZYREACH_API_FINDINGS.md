# Eazyreach API Authentication - Findings & Next Steps

## What We Discovered ✅

### Authentication Works
- ✅ GraphQL endpoint: `https://db.vocallabs.ai/v1/graphql` is reachable
- ✅ Bearer token authentication: CLIENT_SECRET works as a direct Bearer token
- ✅ The CLIENT_SECRET successfully authenticates to the GraphQL endpoint

### Example curl test that worked:
```bash
curl -X POST "https://db.vocallabs.ai/v1/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer Hwj1h2Mndw39S4UGPTR5DmleSHTjAp4X" \
  -d '{"query":"query { ... }"}' 
```

Response: ✅ Accepted the Bearer token (no 401 errors)

---

## What's Still Unknown ❌

### GraphQL Schema is Private
- Introspection is disabled (introspection-disabled)
- Can't query `__schema` or `__type` to discover available fields
- Query names like `find_email`, `findEmail`, `resolve_email`, etc. all return "field not found"

### What We Need From Eazyreach

You need to find **one** of these:

1. **GraphQL API Documentation** — Shows correct query structure
   - Example: "To find email by LinkedIn, use: `query { resolveEmailByLinkedIn(...) { ... } }`"

2. **GraphQL Playground Link** — Interactive explorer
   - Usually at: `https://api.service.com/graphql`
   - Or in dashboard under "API"

3. **API Reference** — REST or GraphQL endpoint docs
   - Look for Eazyreach API docs or Vocallabs API docs

4. **Example Queries** — Code samples from their docs
   - Shows exact field names and structure

---

## How to Find the Right Query

### In Eazyreach Dashboard:

1. Go to `eazyreach.app` → Account / API section
2. Look for:
   - "GraphQL Playground"
   - "API Reference"
   - "Developer Docs"
   - "Integration Guide"

3. Search the docs for:
   - "find email" OR "resolve email" OR "email lookup"
   - "LinkedIn" as a search field
   - GraphQL query examples

### In Browser DevTools:

1. Open DevTools (F12)
2. Go to Network tab
3. Make a request in Eazyreach UI to find an email by LinkedIn
4. Look at the GraphQL `mutation` or `query` it sends
5. Copy that exact query structure

---

## Once You Have the Correct Query

### Update the code in `stages/3_eazyreach.js`:

Replace this line (around line 85):
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

With the **correct query from Eazyreach docs**, for example:
```javascript
query: `
  query ResolveEmail($url: String!) {
    email_finder(linkedinUrl: $url) {
      verified_email
      status
    }
  }
`,
```

And update the variable name:
```javascript
variables: { url: prospect.linkedinUrl }  // instead of { linkedin: ... }
```

And update the response parsing (line ~115):
```javascript
const email = result.verified_email;  // instead of result.email
const status = result.status ?? "";
```

---

## Current Code State

The code is now set up to:
1. ✅ Authenticate using CLIENT_SECRET as Bearer token
2. ⏳ Try to query for emails (but query structure is unknown)
3. ✅ Gracefully fall back to mock emails if query fails
4. ✅ Log helpful debug messages if GraphQL schema errors occur

---

## Test After Fixing

Once you update the query:

```bash
node pipeline.js stripe.com
```

You should see:
```
[Eazyreach] Resolving https://www.linkedin.com/in/jack-dorsey-example
[Eazyreach] Jack Dorsey → Resolved: jack.dorsey@square.com
```

(Without ⚠ MOCK label)

---

## Questions to Ask Eazyreach Support

If you can't find it in their docs:

> "I'm trying to integrate your GraphQL API to find work emails from LinkedIn URLs. 
> Our credentials work with the `/v1/graphql` endpoint, but we need the correct 
> query structure. Can you provide:
> 
> 1. The GraphQL query to find email by LinkedIn URL
> 2. Example response format
> 3. Any status values that indicate a verified email
> 4. Link to API documentation or GraphQL playground"

---

## What's Ready to Go

Everything else is production-ready:
- ✅ Ocean.io integration (lookalike companies)
- ✅ Prospeo integration (decision-makers)
- ✅ Brevo integration (email sending)
- ✅ Safety checkpoint (blocks mock emails)
- ⏳ Eazyreach integration (just needs query structure)

Once Eazyreach query is confirmed, it's a 2-minute fix and you're fully production-ready.

---

## Current Error Output

What you're seeing now:
```
[Eazyreach] GraphQL schema issue: field 'find_email' not found in type: 'query_root'
[Eazyreach] ⚠️  Check Eazyreach API docs for correct query fields
[Eazyreach] Jack Dorsey → Using mock email: jack.dorsey@square.com [⚠ MOCK]
```

After fix, will show:
```
[Eazyreach] Jack Dorsey → Resolved: jack.dorsey@square.com [✅ REAL]
```

---

## Useful Info for Your Inquiry

**What works:**
- Endpoint: ✅ `https://db.vocallabs.ai/v1/graphql`
- Auth: ✅ `Authorization: Bearer {CLIENT_SECRET}`
- Content-Type: ✅ `application/json`

**What's missing:**
- Query field names (introspection disabled)
- Response field names
- Status value meanings

This narrows it down significantly for support to help you!
