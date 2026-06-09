# secretariat-medical

## Stack
- **Framework**: Next.js 15 App Router + TypeScript
- **External services**: ElevenLabs STT/TTS, Anthropic Claude Sonnet
- **Data**: Fictitious data hardcoded as TypeScript constants (no database)
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint (next/core-web-vitals + next/typescript)

## Commands
- `npm run dev` — Start dev server
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

## Coding Conventions
- Server-side API keys only (never prefix with NEXT_PUBLIC_)
- All external calls proxied through `/api/*` routes
- French language for user-facing text
- TypeScript strict mode enabled
