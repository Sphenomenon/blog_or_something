# FUNCTIONS API KNOWLEDGE

## OVERVIEW

Cloudflare Pages Functions for Sveltia CMS GitHub OAuth. These endpoints are runtime auth glue for `public/admin/config.yml`, not Vercel/Netlify functions and not static Vite code.

## STRUCTURE

```text
functions/api/
├── auth.js       # GET /api/auth: start GitHub OAuth
└── callback.js   # GET /api/callback: exchange code and post token to CMS popup
```

## RUNTIME

- Use `export async function onRequest(context)`.
- Cloudflare provides `context.request`, `context.env`, `Response`, `URL`, `URLSearchParams`, and `fetch`.
- `wrangler.jsonc` sets Pages output to `dist`.
- `vercel.json` and `netlify.toml` do not provide equivalent handlers.

## ENVIRONMENT

- `CLIENT_ID`: required by `auth.js` and `callback.js`.
- `CLIENT_SECRET`: required by `callback.js`.
- Never hardcode these values or commit local env files.

## CMS COUPLING

- CMS config: `public/admin/config.yml`.
- Backend: GitHub repo `Sphenomenon/blog_or_something`, branch `main`.
- `base_url` currently points to `https://icarusfell.top/api`.
- Admin page loads Sveltia CMS from `public/admin/index.html`.

## AUTH FLOW

1. `auth.js` builds `redirect_uri` from request origin as `${origin}/api/callback`.
2. It redirects to `https://github.com/login/oauth/authorize` with `scope=repo,user`.
3. It forwards extra CMS query params (PKCE/state/provider/site_id). Preserve this.
4. `callback.js` exchanges `code` at `https://github.com/login/oauth/access_token`.
5. It returns HTML that uses Sveltia/Decap string `postMessage` protocol.

## ANTI-PATTERNS

- Do not convert the final CMS popup message to an object payload; comments note Sveltia silently drops non-string messages.
- Do not remove forwarded query params in `auth.js`; that can break PKCE/state.
- Do not assume preview URLs use auth unless `public/admin/config.yml` `base_url` is updated.
- Do not move these to another host target without porting the serverless runtime.
- Do not add package dependencies for simple OAuth glue unless unavoidable.
