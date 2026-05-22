# Fix: Netlify Identity widget in root index.html

## TL;DR
Add Netlify Identity widget script to root `index.html` so invite token URLs (`#invite_token=...`) are captured before React router processes them.

## Context
- User deployed to Netlify and enabled Identity. Invite email link goes to main site with `#invite_token=...` hash.
- Main `index.html` doesn't load Identity widget — only `/admin/index.html` does.
- React SPA router intercepts the hash and navigates to greeting page before Identity widget can process the invite token.

## Fix
In `index.html`, add `<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>` BEFORE the main React script.

## TODOs
- [x] Add Identity widget script to `index.html`

  **What**: Insert `<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>` on line 22, before `<script type="module" src="/src/main.jsx"></script>`.

  **Commit**: YES | Message: `fix: add Netlify Identity widget to root index.html for invite token handling`

## Verification
- Push to GitHub → wait for Netlify auto-deploy
- Click invite email link again → should show password setup form instead of greeting page
