# evora — Setup

Built with **xAI · Vercel · Cursor · Inngest**

## 1. xAI API Key (Grok + Grok Voice)
- Go to https://console.x.ai → API Keys → Create key
- Add to `.env.local`:
  ```
  XAI_API_KEY=xai-...
  ```
- **Models used:**
  - `grok-3-mini` — live companion conversation (streaming)
  - `grok-3` — cognition reports + escalation summaries
- **Grok Voice (fallback TTS):**
  - TTS: `ara` voice via `POST /v1/tts`
  - STT: `POST /v1/stt` (patient speech → text)
  - Proxied through `/api/voice/tts` and `/api/voice/stt`

## 1b. ElevenLabs (recommended — most natural voice)
- Go to https://elevenlabs.io → Profile → API Keys
- Add to `.env.local`:
  ```
  ELEVENLABS_API_KEY=sk_...
  # optional tuning:
  ELEVENLABS_VOICE_ID=XrExE9yKIg1WjnnlVkGX   # Matilda (warm default)
  ELEVENLABS_MODEL=eleven_flash_v2_5           # fast, conversational in-app
  ELEVENLABS_PHONE_MODEL=eleven_multilingual_v2 # richer tone on phone calls
  TTS_PROVIDER=auto                            # auto | elevenlabs | xai
  ```
- When `ELEVENLABS_API_KEY` is set, evora uses ElevenLabs for in-app speech automatically.
- **Phone calls** use ElevenLabs + live two-way conversation when deployed (Vercel sets `VERCEL_URL`) or when you expose the app publicly:
  ```
  NEXT_PUBLIC_APP_URL=https://your-ngrok-or-vercel-url
  ```
  Twilio listens for speech, Grok replies, ElevenLabs speaks back — up to ~8 turns for Margaret, ~5 for James.
  Locally on `localhost` only, calls are one-way (no webhook for Twilio to reach you).

## 2. Inngest (background workflows)
- Go to https://app.inngest.com → Create account → New app
- Add to `.env.local`:
  ```
  INNGEST_EVENT_KEY=...
  INNGEST_SIGNING_KEY=...
  ```
- **Workflows:**
  - `evora/call-started` / `evora/call-ended` — session logging
  - `evora/escalation` — Grok summary + caregiver notification
- In dev, run the Inngest dev server alongside Next.js:
  ```bash
  npm run dev
  # in another terminal:
  npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
  ```

## 3. Run locally
```bash
npm install
npm run dev
```

Open http://localhost:3000 → tap the green call button → hold **Space** to speak.

## 4. Deploy to Vercel
```bash
npx vercel --prod
```

**Environment variables** (Vercel → Project → Settings → Environment Variables):

| Variable | Required | Notes |
|----------|----------|-------|
| `XAI_API_KEY` | Yes | Grok chat + phone replies |
| `ELEVENLABS_API_KEY` | Recommended | Natural voice in-app + on phone |
| `TWILIO_ACCOUNT_SID` | For phone | Twilio console |
| `TWILIO_AUTH_TOKEN` | For phone | Twilio console |
| `TWILIO_PHONE_NUMBER` | For phone | Your Twilio number |
| `PATIENT_PHONE` | For phone | e.g. `+17167509405` |
| `CAREGIVER_PHONE` | For phone | Caregiver number |
| `INNGEST_EVENT_KEY` | For workflows | Inngest dashboard |
| `INNGEST_SIGNING_KEY` | For workflows | Inngest dashboard |
| `NEXT_PUBLIC_SUPABASE_URL` | Persistence | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Persistence | Supabase service role key |
| `AUTH_SECRET` | **Yes (prod)** | Long random string for session cookies |
| `AUTH_PASSWORD_PATIENT` | **Yes (prod)** | Login password for Margaret |
| `AUTH_PASSWORD_CARETAKER` | **Yes (prod)** | Login password for James |
| `AUTH_PASSWORD_FAMILY` | **Yes (prod)** | Login password for Sarah |

On Vercel, two-way phone calls work automatically (`VERCEL_URL` is set). No ngrok needed.

- In Inngest dashboard: add your Vercel URL as the production endpoint (`https://your-app.vercel.app/api/inngest`)

## Production checklist

Before going live on Vercel:

1. Set all **auth** env vars (`AUTH_SECRET`, `AUTH_PASSWORD_*`) — demo passwords are disabled in production
2. Run the latest [`supabase/schema.sql`](./supabase/schema.sql) — includes `phone_sessions` and `tts_sessions` tables required for two-way Twilio on serverless
3. Set `PATIENT_PHONE`, `CAREGIVER_PHONE`, and all Twilio keys
4. Confirm Twilio webhook URLs point to `https://your-app.vercel.app/api/twilio/voice` (automatic when using outbound API)
5. Deploy with `npx vercel --prod`
6. Test login for all three portals, in-app voice, and a phone call

Copy [`.env.example`](./.env.example) as a template for all variables.

## Demo flow
1. Patient taps **call evora** → Inngest logs `evora/call-started`
2. Evora greets via **ElevenLabs** (or Grok Voice fallback), patient speaks via **Grok STT**
3. Grok-3-mini streams warm companion replies
4. On distress/loops → `<escalate>` tag → Inngest `evora/escalation` workflow
5. Caregiver dashboard shows alerts + can generate **Grok-3** cognition report

## Who gets called

| Role | Number | When |
|------|--------|------|
| **Patient (you)** | `+17167509405` | Daily check-ins at 10am, 5pm, 7pm ET |
| **Caregiver** | `CAREGIVER_PHONE` | Alerts on medium/high escalations |

## Proactive check-ins (patient phone)

Margaret's number defaults to **`+17167509405`**. Override with `PATIENT_PHONE` in `.env.local`.

Outbound check-in calls run automatically via **Inngest cron** (America/New_York):

| Time | Call |
|------|------|
| **10:00 AM** | Morning check-in |
| **5:00 PM** | Sundown check-in |
| **7:00 PM** | Evening comfort call |

## Caregiver alerts (escalations)

When evora detects distress during a call, the caregiver is notified based on severity:

| Severity | Daytime | Sundowning / overnight (5pm–6am ET) |
|----------|---------|-------------------------------------|
| **High** | Phone call + SMS | Phone call + SMS |
| **Medium** | SMS only | Phone call + SMS |
| **Low** | Dashboard only | Dashboard only |

Required env vars:
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...        # Twilio outbound number
PATIENT_PHONE=+17167509405       # you — daily check-in calls
CAREGIVER_PHONE=+1...            # family/caregiver — alert calls & texts
PATIENT_TIMEZONE=America/New_York
```

**Trial Twilio accounts** must verify both patient and caregiver numbers in the Twilio console.

Caregiver dashboard **call now** rings the patient immediately. Scheduled check-ins and escalation alerts run via Inngest once deployed.

## Optional
```
DOCTOR_PHONE=+1...               # also notified on escalations
```

## 5. Supabase (persistent messages, family notes, alerts)

Without Supabase, data lives in memory and resets when the server restarts. With Supabase, Sarah's notes, Margaret's conversation, and caregiver alerts persist across devices and deploys.

### Create the database

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Open **SQL Editor** → **New query**
3. Paste and run the full script from [`supabase/schema.sql`](./supabase/schema.sql)
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **service_role** key (secret — server only)

### Environment variables

Add to `.env.local` and Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is optional for now — the app uses the service role on API routes only.

Restart the dev server after adding keys. The app falls back to in-memory storage if Supabase is not configured.

### What's stored

| Table | Data |
|-------|------|
| `messages` | Patient ↔ evora conversation (syncs to caregiver dashboard) |
| `memories` | Family notes + memory anchors |
| `alerts` | Escalation alerts |
| `phone_sessions` | Two-way Twilio call state (serverless-safe) |
| `tts_sessions` | ElevenLabs audio segments for phone playback |

### Verify

```bash
curl http://localhost:3000/api/session/memories
curl http://localhost:3000/api/session/messages
curl http://localhost:3000/api/session/alerts
```
