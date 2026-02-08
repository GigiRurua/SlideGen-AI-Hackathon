<img width="679" height="351" alt="Screenshot 2026-02-07 at 7 51 12 PM" src="https://github.com/user-attachments/assets/faae4de9-60eb-4f79-bf82-1b941c4ca407" />

**SlideGen AI - Turn spoken lectures into polished presentations in seconds.**

An end-to-end AI pipeline that transcribes audio with **OpenAI Whisper**, generates structured slide content with **Anthropic Claude 4.5**, and delivers slides to **PowerPoint** and a **mobile recording app**. Built for educators, students, and professionals who want to go from voice to deck without manual work.

---

## Overview

Lecture to Slide records or accepts lecture audio, transcribes it with Whisper, and uses Claude 4.5 to produce a 5-slide presentation (titles, bullets, speaker notes). You get a **6-digit join code** to pull the same slides into the PowerPoint add-in or to share with others.

| Component        | Role |
|-----------------|------|
| **Mobile app**  | Record lecture audio → upload → receive join code |
| **Backend**     | Whisper transcription → Claude 4.5 slide generation → session storage |
| **PowerPoint add-in** | Enter join code → fetch slides → insert into current deck |

---

## Project Structure

```
SlideGen-AI-Hackathon/
├── backend/                 # Node.js API (Express)
│   ├── server.js            # Upload, Whisper, Claude, /fetch-slides
│   ├── .env                 # OPENAI_API_KEY, ANTHROPIC_API_KEY (not committed)
│   └── uploads/              # Temporary audio files (not committed)
├── mobile-app/              # React Native (Expo) recording app
│   ├── App.js                # Record, upload, display join code
│   └── app.json
├── ppt-addin/
│   └── LectureToSlide/       # Office PowerPoint add-in
│       ├── manifest.xml      # Add-in registration
│       └── src/taskpane/     # Task pane UI, sync slides into deck
├── .gitignore
├── package.json
└── README.md
```

---

## Tech Stack

- **Transcription:** OpenAI Whisper (`whisper-1`)
- **Slide generation:** Anthropic Claude 4.5 Sonnet (`claude-sonnet-4-5-20250929`)
- **Backend:** Node.js, Express, Multer, CORS
- **Front-end:** Office.js (PowerPoint add-in), React Native + Expo (mobile)
- **Deployment (demo):** Backend exposed via Cloudflare Tunnel; add-in and app point to that URL

---

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key (Whisper)
- Anthropic API key (Claude 4.5)
- For mobile: Expo Go or dev build
- For add-in: PowerPoint (desktop or web) with sideloading

### Backend

```bash
cd backend
cp .env.example .env   # or create .env with OPENAI_API_KEY and ANTHROPIC_API_KEY
npm install
node server.js
```

Server runs on `http://0.0.0.0:8080`. For mobile/add-in from another network, use a tunnel (e.g. Cloudflare Tunnel) and set the base URL in the add-in and app.

### Mobile app

```bash
cd mobile-app
npm install
npx expo start
```

Record a lecture, tap to upload; the 6-digit join code is shown on success.

### PowerPoint add-in

1. Open the `ppt-addin/LectureToSlide` project in your Office add-in workflow (e.g. npm install, build, sideload).
2. In the task pane, enter the 6-digit join code and sync to insert the AI-generated slides into the current presentation.

---

## API (Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-data` | Body: `audio` (file) or `transcript` (text). Returns `{ joinCode }`. |
| `GET`  | `/fetch-slides/:code` | Returns slide array for the given 6-digit code. |

---

## Hackathon Notes

- **Problem:** Turning lectures or long audio into slides is manual and time-consuming.
- **Solution:** One-tap record → upload → get a join code; paste code in PowerPoint to get a ready-made deck.
- **Differentiator:** Full pipeline (Whisper + Claude 4.5) with a simple join-code flow across mobile and PowerPoint.

---

## License

MIT (or your chosen license).
