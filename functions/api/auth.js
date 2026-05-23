/**
 * Cloudflare Pages Function: GET /api/auth
 *
 * Redirects the user to GitHub's OAuth authorize page so Decap CMS can
 * initiate the GitHub OAuth flow.  The CMS opens this URL in a popup.
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

  // Construct the GitHub authorize URL with the required scopes.
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo,user",
    redirect_uri: redirectUri,
  });
  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  // 302 redirect the browser to GitHub.
  return Response.redirect(authorizeUrl, 302);
}
