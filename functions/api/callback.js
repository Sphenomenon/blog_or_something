/**
 * Cloudflare Pages Function: GET /api/auth/callback
 *
 * After the user authorises on GitHub, GitHub redirects here with a `code`
 * query parameter.  This function exchanges that code for an access token
 * and returns an HTML page that posts the token back to the Decap CMS
 * window via `window.opener.postMessage`.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. Extract the authorization code from the query string.
  const code = url.searchParams.get("code");
  if (!code) {
    return renderError("No authorization code received from GitHub.");
  }

  // 2. Read credentials from environment variables.
  const clientId = env.CLIENT_ID;
  const clientSecret = env.CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return renderError(
      "Server misconfiguration: CLIENT_ID or CLIENT_SECRET is not set.",
    );
  }

  // 3. Exchange the code for an access token via GitHub's OAuth endpoint.
  let tokenResponse;
  try {
    tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );
  } catch (err) {
    return renderError(
      `Network error while contacting GitHub: ${err.message}`,
    );
  }

  if (!tokenResponse.ok) {
    return renderError(
      `GitHub returned HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`,
    );
  }

  // 4. Parse the JSON response from GitHub.
  let data;
  try {
    data = await tokenResponse.json();
  } catch (err) {
    return renderError(`Failed to parse GitHub response: ${err.message}`);
  }

  // GitHub may return an error_description field even with HTTP 200.
  if (data.error) {
    return renderError(
      data.error_description || data.error || "Unknown GitHub OAuth error.",
    );
  }

  const accessToken = data.access_token;
  if (!accessToken) {
    return renderError("GitHub did not return an access token.");
  }

  // 5. Return a minimal HTML page that sends the token to the opener window
  //    via the postMessage protocol expected by Decap CMS.
  return renderSuccess(accessToken);
}

/**
 * Return an HTML page that posts the token to the Decap CMS opener window.
 */
function renderSuccess(token) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authorized &mdash; Nocturne Archive</title>
</head>
<body>
  <p>Logged in! You can close this window.</p>
  <script>
    (function () {
      // Decap CMS expects a postMessage with this exact shape.
      window.opener.postMessage(
        { token: ${JSON.stringify(token)}, provider: "github" },
        "*"
      );
      // Optionally close the popup after a short delay so the
      // opener has time to process the message.
      setTimeout(function () {
        window.close();
      }, 200);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Return an HTML page showing the error to the user.
 */
function renderError(message) {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authorization Failed &mdash; Nocturne Archive</title>
</head>
<body>
  <p>Authorization failed: ${escaped}</p>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
