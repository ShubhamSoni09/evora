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
- **Grok Voice:**
  - TTS: `eve` voice via `POST /v1/tts` (evora speaks)
  - STT: `POST /v1/stt` (patient speech → text)
  - Proxied through `/api/voice/tts` and `/api/voice/stt`

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
- Set `XAI_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` in the Vercel dashboard
- In Inngest dashboard: add your Vercel URL as the production endpoint (`https://your-app.vercel.app/api/inngest`)

## Demo flow
1. Patient taps **call evora** → Inngest logs `evora/call-started`
2. Evora greets via **Grok Voice** (TTS), patient speaks via **Grok STT**
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
