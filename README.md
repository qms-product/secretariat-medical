# Assistant Vocal - Secretariat Medical

Assistant vocal local pour secretariat medical — transcription vocale, traitement par IA, reponse vocale. **Donnees fictives uniquement.**

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in required API keys (see Environment Variables below)

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

## Variables d'environnement

| Variable | Requis | Description | Defaut |
|----------|--------|-------------|--------|
| `ELEVENLABS_API_KEY` | Oui | Cle API ElevenLabs pour STT/TTS | — |
| `ANTHROPIC_API_KEY` | Oui | Cle API Anthropic pour Claude | — |
| `CAL_COM_API_KEY` | Oui | Cle API Cal.com pour la prise de rendez-vous | — |
| `CAL_COM_BASE_URL` | Non | URL de base de l'instance Cal.com | `http://localhost:3000` |
| `CAL_COM_EVENT_TYPE_ID` | Oui | ID du type d'evenement Cal.com | — |

Toutes les cles API sont server-side uniquement (ADR-1). Ne jamais utiliser le prefixe `NEXT_PUBLIC_`.

## Architecture

- **Next.js 15 App Router** with server-side API routes for all external calls
- **ElevenLabs** for speech-to-text and text-to-speech
- **Claude Sonnet** for conversational processing (administrative info only)
- **Fictitious data** hardcoded as TypeScript constants — no database

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and conventions.
