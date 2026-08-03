# Builder AI Workspace App (wired)

V0 ZIP UI exported as static Next app. **Do not restyle UI components** — they are SSOT from `../builder-ai-workspace-ssot/`.

## Connection only
- `lib/tasful-bridge.ts` → Intent Router / Estimate Foundation / Cost / Document
- `lib/tasful-scripts.ts` + `app/layout.tsx` Script tags
- `app/page.tsx` — same V0 JSX; `detectIntent` replaced by `runTasuBuilderAi`

## Build / stage
```bash
cd builder/builder-ai-workspace-app
npm install
npm run build
# copy out → deploy/cloudflare/dist/builder/builder-ai-workspace-app
```

Entry: `/builder/builder-ai.html` redirects to `/builder/builder-ai-workspace-app/`.
