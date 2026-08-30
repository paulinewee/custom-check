# Custom Check

Construct a valid request against a translation or transcription API, prove the service is functionally healthy, and see exactly why it failed when it is not.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Start with **Translate** or paste any GET/POST endpoint, then **Test Request**. Auth, body, and assertions appear only when the response says they are missing.

## Secret handling

Secrets stay in the browser session. They are sent to `/api/test` only for the outbound request, never written to logs, and always masked in the curl preview (`••••` plus the last 4 characters). Reveal and copy are explicit user actions.

Intended architecture if this grows:

- Keep keys in memory or `sessionStorage`, not `localStorage` or a database.
- Proxy tests through the server so the browser does not call third parties directly.
- Redact `Authorization`, `*key*`, and query secrets before any log, history, or support export.
- If persistence is added later, encrypt at rest and never return the raw secret after the first save.
