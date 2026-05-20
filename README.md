# Backchat

Backchat is a real-time tactical response engine for live conversations. It listens or accepts manual input, keeps the transcript in the background, detects psychological tactics, and generates timely response suggestions.

## Core UX

- Top section: app status, modes, live detection/intel panel.
- Bottom section: response suggestions designed for immediate use.
- Transcript: hidden background buffer, available through drawer/export only.

## Deployment

This repository is designed for Vercel.

### Required environment variables

```env
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
```

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
