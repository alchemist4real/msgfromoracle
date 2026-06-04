# Msg from Oracle

The prophecy you never asked for. An AI-powered oracle that weaves sarcastic poetry from your deepest wishes.

## How It Works

1. Enter your name and a secret wish
2. The Oracle speaks — a greeting voiced through the void
3. A poem is conjured, an artwork manifested, a whisper delivered
4. Save the prophecy as an image

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Backend**: Vercel Serverless Function (`/api/generate.js`)
- **AI**: Google Gemini (text + image + TTS)
- **Voice**: VoiceRSS (greeting TTS)

## Deploy to Vercel

1. Push this repo to GitHub
2. Connect the repo on [Vercel](https://vercel.com)
3. Add these **Environment Variables**:
   - `GEMINI_API_KEYS` — comma-separated Gemini API keys
   - `VOICERSS_API_KEY` — your VoiceRSS API key
4. Deploy. Done.

## Credit

by **alchemist4real**
