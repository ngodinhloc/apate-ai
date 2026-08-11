# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # next dev --webpack, http://localhost:3000
npm run build
npm run start
npm run lint      # eslint .
npm run format    # prettier --write "src/**/*.{ts,tsx}"
```

No test suite is configured in this package.

`npm run dev` needs `chat-service` (and, for extraction, `extract-service`) reachable — see `next.config.ts` rewrites below. Easiest path: `docker compose up --build` from the repo root, which starts all three services together.

## Architecture

This is the Next.js (App Router) frontend for Apate AI, a scam-baiting chatbot. It is one of three services in the monorepo (`chat-frontend`, `chat-service`, `extract-service`) — see the root `README.md` and `SPECS.md` for the system-wide architecture and the `Conversation`/`Message`/`ExtractOutput` wire interfaces this app consumes.

**Backend proxying** — the frontend never talks to `chat-service`/`extract-service` directly. `next.config.ts` rewrites same-origin `/api/*` requests to `API_TARGET` (chat-service, default `localhost:8000`) and `/api/extract/*` to `EXTRACT_API_TARGET` (extract-service, default `localhost:8001`); the extract rewrite must precede the general one since both mount under `/api`. `proxyTimeout` is raised to 120s because LLM replies can exceed Next's default 30s proxy timeout.

**URL-driven chat state** (`ScamChat.tsx`) — there's a single chat route (`/`) whose behavior is driven entirely by query params, not by distinct pages:
- `?session=<timestamp>` (set by Sidebar's "New Chat") triggers a full reset effect — clears conversation state and disconnects any socket — without ending the conversation being left, so it stays resumable from Redis on the backend.
- `?chat=<uuid>` loads a past conversation read-only via `GET /api/chat/{uuid}`, with no WebSocket reconnect.

**Send/receive flow** — `ChatInput` → `ScamChat.handleSend` → `lib/api.ts`'s `newChat`/`continueChat` (`POST /api/chat/` or `POST /api/chat/{uuid}`). The user's message is appended optimistically to local state, then a WebSocket (`NEXT_PUBLIC_WS_URL` or derived from `window.location`, path `/ws`) is opened and subscribed to the conversation id; the backend pushes `chat-update` events with the full `Conversation` as the agent reply streams in, and `agentStatus: 'hasReplied'` ends the loading state and closes the socket.

**Ending a conversation** — the only trigger is a real tab close/navigation-away: a `beforeunload` handler uses `navigator.sendBeacon` (not `fetch`, which can be cancelled mid-flight) to hit `POST /api/chat/{id}/end`.

**Sidebar history** — polls `GET /api/chat/` on mount and refreshes on a custom `chat-ended` window event.

**ExtractionsPanel** — lazily fetches `GET /api/extract/{uuid}` on first expand and caches results per conversation id; `scamProbability` drives a red/amber/emerald badge.

**Shared types** — `src/types/chat.ts` mirrors the wire shapes defined in the root `SPECS.md` (`Message`, `Conversation`, `ExtractDataType`, etc.) for both chat-service and extract-service; keep it in sync if those interfaces change.

**Voice (local prototype)** — `src/lib/speech.ts` + `src/hooks/useSpeechToText.ts` wrap the browser's native Web Speech API: `SpeechRecognition` for mic input in `ChatInput`, `speechSynthesis` for reading agent replies aloud in `ScamChat`/`MessageBubble`. This is entirely client-side (Chrome/Edge only) with no backend or LLM involvement — ambient types live in `src/types/speech.d.ts` since they aren't in TypeScript's DOM lib.

**Styling** — Tailwind v4 via `@tailwindcss/postcss`; dark mode follows system preference through `dark:` classes (no manual toggle).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
