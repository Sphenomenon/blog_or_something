/**
 * Cloudflare Pages Function: GET /api/auth
 *
 * Redirects the user to GitHub's OAuth authorize page so a CMS (Decap CMS
 * or Sveltia CMS) can initiate the GitHub OAuth flow.  The CMS opens this
 * URL in a popup.
 *
 * IMPORTANT: All query parameters from the CMS request (PKCE, state,
 * provider, site_id, etc.) are forwarded to GitHub's authorize URL so that
 * Sveltia CMS's PKCE flow and CSRF protection work correctly.
 */
export async function onRequest(context) {
  const { request, env } = context;

  // Read client id from environment variables – never hardcoded.
  const clientId = env.CLIENT_ID;
  if (!clientId) {
    return new Response("CLIENT_ID environment variable is not set", {
      status: 500,
    });
  }

  // Build the redirect URI dynamically from the request's own origin so the
  // flow works across preview URLs (*.pages.dev) and custom domains.
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/callback`;

  // Start with the required OAuth params.
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo,user",
    redirect_uri: redirectUri,
  });

  // Forward ALL additional query params from the CMS request (PKCE
  // challenge, state token, provider, site_id, etc.) to GitHub's authorize
  // URL.  Skipping keys we already set above to avoid conflicts.
  for (const [key, value] of url.searchParams) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }

  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  // 302 redirect the browser to GitHub.
  return Response.redirect(authorizeUrl, 302);
}
