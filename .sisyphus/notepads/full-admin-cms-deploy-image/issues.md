# Issues — full-admin-cms-deploy-image

## Environment
- No git repo initialized
- No vite.config.js exists (Vite zero-config)
- LSP server 'typescript' not installed

## Pre-existing: `npm run verify:visual` fails in dev mode
- Browser reports JS error `"Unexpected token ':'"` with no stack trace
- React app fails to mount — greeting gate never renders
- Error is browser-level (Vite dev app), not in the test script
- Present before visual-core.mjs YAML changes (confirmed via evidence dir)
- Build mode succeeds (`npx vite build` passes cleanly)
- Likely a Vite dev dependency transform issue — not related to YAML loading
