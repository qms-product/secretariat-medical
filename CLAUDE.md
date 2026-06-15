# secretariat-medical

## Stack
- **Framework**: Next.js 15 App Router + TypeScript
- **External services**: ElevenLabs STT/TTS, Anthropic Claude Sonnet
- **Data**: Fictitious data hardcoded as TypeScript constants (no database)
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint (next/core-web-vitals + next/typescript)

## Commands
- `npm run dev` — Start dev server (port 3001)
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npm test` — Run tests (Vitest)
- `npm run test:watch` — Run tests in watch mode

## Directory Structure
```
src/
  app/
    layout.tsx          — Root layout
    page.tsx            — Main voice assistant UI
    api/
      stt/route.ts      — Speech-to-Text (ElevenLabs)
      chat/route.ts     — Chat processing (Claude Sonnet)
      tts/route.ts      — Text-to-Speech (ElevenLabs)
  lib/
    data.ts             — Fictitious data constants (ADR-2)
    errors.ts           — Error types per voice flow step (ADR-3)
    system-prompt.ts    — Claude system prompt (ADR-5)
    __tests__/          — Unit tests
```

## Architecture Decisions
- **ADR-1**: All external API calls go through server-side API routes. API keys are never exposed client-side.
- **ADR-2**: Fictitious data is stored as TypeScript constants. No database.
- **ADR-3**: Granular error messages per voice flow step (capture, transcription, processing, synthesis).
- **ADR-4**: Visual progress indicators for each step of the voice flow.
- **ADR-5**: Claude system prompt explicitly forbids medical advice, redirects to professionals.
- **ADR-10**: Application runs on port 3001 to avoid conflicts with Cal.com on port 3000.

## Docker
- The app runs in Docker: `docker compose up -d` to start, `docker compose down` to stop
- After creating or modifying code, ALWAYS verify it works in Docker:
  1. `docker compose build`
  2. `docker compose up -d`
  3. Verify the app responds (e.g., `curl -s http://localhost:3001`)
  4. `docker compose down`
- If `Dockerfile` or `docker-compose.yml` don't exist yet, create them first
- The Dockerfile should use multi-stage build (deps → build → run)
- docker-compose.yml must pass env vars from `.env` file

## Coding Conventions
- Server-side API keys only (never prefix with NEXT_PUBLIC_)
- All external calls proxied through `/api/*` routes
- French language for user-facing text
- TypeScript strict mode enabled
