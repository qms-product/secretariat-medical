# Assistant Vocal - Secretariat Medical

Assistant vocal local pour secretariat medical — transcription vocale, traitement par IA, reponse vocale. **Donnees fictives uniquement.**

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in ELEVENLABS_API_KEY and ANTHROPIC_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

## Architecture

- **Next.js 15 App Router** with server-side API routes for all external calls
- **ElevenLabs** for speech-to-text and text-to-speech
- **Claude Sonnet** for conversational processing (administrative info only)
- **Fictitious data** hardcoded as TypeScript constants — no database

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and conventions.
