# Vercel Deployment Notes

- Framework Preset: Other
- Build Command: `npm run vercel-build`
- Output Directory: `public`
- Edge WebSocket function is at `api/ws.js` and declares `export const config = { runtime: 'edge' }`.
- `vercel.json` handles redirects and headers only; runtime is set in the function file.
