# User Analytics Dashboard

> **CausalFunnel hiring assignment** – Full-stack user analytics: a drop-in JS tracking script, a Node/Express + MongoDB API, and a React dashboard with session journeys and click heatmaps.

![Sessions View](./docs/screenshots/sessions.png)
![Heatmap View](./docs/screenshots/heatmap.png)

---

## Live URLs

| Service | URL |
|---------|-----|
| 📊 **Dashboard** | *(add after Vercel deploy)* |
| 🔧 **Backend API** | *(add after Render deploy)* |
| 🌐 **Demo page** | *(backend URL)/demo.html* |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Tracker** | Vanilla JS (zero dependencies) |
| **Backend** | Node.js 18+, Express 4, Mongoose 8 |
| **Database** | MongoDB 7 (Atlas or local) |
| **Dashboard** | React 18, Vite 5 |
| **Deploy** | Render (backend) + Vercel (frontend) |

---

## Project Structure

```
user-analytics-dashboard/
├── backend/
│   ├── public/
│   │   ├── tracker.js        ← drop-in tracking script
│   │   └── demo.html         ← interactive test page
│   ├── server.js             ← Express API + Mongoose schema
│   ├── test.js               ← automated test suite
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx           ← root component + tab nav
│   │   ├── Sessions.jsx      ← sessions table + journey timeline
│   │   ├── Heatmap.jsx       ← click heatmap with page overlay
│   │   ├── api.js            ← fetch wrapper
│   │   └── styles.css        ← design system
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── render.yaml               ← Render deployment config
├── vercel.json               ← Vercel deployment config
├── .gitignore
└── README.md
```

---

## Local Setup

### Prerequisites

- **Node.js 18+** – [nodejs.org](https://nodejs.org)
- **MongoDB** – local install *or* a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster

### 1. Backend

```bash
cd backend
cp .env.example .env          # edit MONGODB_URI if using Atlas
npm install
npm start                     # → http://localhost:4000
```

The backend serves:
- `GET  /api/health`   – health check
- `POST /api/events`   – event ingest
- `GET  /api/sessions` – sessions list
- `GET  /api/sessions/:id/events` – user journey
- `GET  /api/heatmap/pages` – pages with clicks
- `GET  /api/heatmap?url=…` – click coordinates
- `GET  /tracker.js`  – static tracker script
- `GET  /demo.html`   – test page

### 2. Dashboard

```bash
# new terminal
cd frontend
cp .env.example .env          # set VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # → http://localhost:5173
```

### 3. Test it

1. Open **http://localhost:4000/demo.html** and click around.
2. Open the dashboard at **http://localhost:5173**.
3. Sessions tab → click a session to see the user journey.
4. Heatmap tab → select a page from the dropdown.

### 4. Run the automated tests

```bash
cd backend
npm test                      # unit tests only (no DB needed)
npm test -- --api             # + API integration tests (start server first)
```

---

## Embedding the Tracker

Add one `<script>` tag to any page:

```html
<!-- Replace with your deployed backend URL -->
<script src="http://localhost:4000/tracker.js" defer></script>
```

Override the ingest endpoint with a `data-api` attribute:

```html
<script
  src="https://your-backend.onrender.com/tracker.js"
  data-api="https://your-backend.onrender.com/api/events"
  defer
></script>
```

---

## API Reference

| Method | Path | Description | Body / Params |
|--------|------|-------------|---------------|
| `GET`  | `/api/health` | Health check | – |
| `POST` | `/api/events` | Ingest events | JSON object or array – see schema below |
| `GET`  | `/api/sessions` | Sessions list (newest first, max 500) | – |
| `GET`  | `/api/sessions/:id/events` | All events for one session | `:id` = session_id |
| `GET`  | `/api/heatmap/pages` | Pages with click data + counts | – |
| `GET`  | `/api/heatmap?url=<url>` | Click coordinates for a page | `url` = encoded page URL |

### Event Document Schema

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "type":       "click",
  "page_url":   "http://localhost:4000/demo.html",
  "timestamp":  "2024-01-15T10:23:45.678Z",
  "x":          320,
  "y":          480,
  "page_w":     1280,
  "page_h":     2000,
  "viewport_w": 1280,
  "viewport_h": 720
}
```

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `session_id` | string | ✅ | Max 100 chars |
| `type` | `"page_view"` \| `"click"` | ✅ | Enum |
| `page_url` | string | ✅ | Max 2000 chars |
| `timestamp` | ISO 8601 | ✅ | Client clock; server trusts it |
| `x`, `y` | number | ✅ for clicks | Document-relative pageX/pageY |
| `page_w`, `page_h` | number | optional | Document dimensions at click time |
| `viewport_w`, `viewport_h` | number | optional | Viewport size at click time |

**Indexes:**
- `{ session_id: 1, timestamp: 1 }` – journey lookups
- `{ type: 1, page_url: 1 }` – heatmap lookups

---

## Deployment

### Option A: Render (backend) + Vercel (dashboard)

#### 1. MongoDB Atlas (database)
1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (free tier M0).
2. Create a cluster, add a database user, whitelist `0.0.0.0/0` (or Render IPs).
3. Copy the connection string: `mongodb+srv://user:pass@cluster.mongodb.net/user_analytics`.

#### 2. Backend → Render
1. Connect GitHub repo at [render.com](https://render.com).
2. New → Web Service, select this repo.
3. **Root directory:** `backend`  
   **Build command:** `npm install`  
   **Start command:** `npm start`
4. Add env vars: `MONGODB_URI` (Atlas URI), `PORT=4000`.
5. Deploy → note the URL (e.g. `https://user-analytics-api.onrender.com`).

#### 3. Dashboard → Vercel
1. Import repo at [vercel.com](https://vercel.com).
2. **Framework:** Vite  
   **Root directory:** `frontend`  
   **Build command:** `npm run build`  
   **Output directory:** `dist`
3. Add env var: `VITE_API_URL=https://user-analytics-api.onrender.com` (no trailing slash).
4. Deploy → copy the dashboard URL.

#### 4. Update tracker snippet in demo.html
After deploying, update `demo.html` line:
```html
<script src="https://YOUR-BACKEND.onrender.com/tracker.js" defer></script>
```

---

## Assumptions & Trade-offs

| Topic | Decision |
|-------|----------|
| **Session definition** | 30-minute inactivity timeout, UUID in localStorage, cookie fallback. No server-side session tracking. |
| **Click coordinates** | Document-relative `pageX`/`pageY`. The heatmap normalises to the largest `page_w × page_h` recorded, so clicks from different screen sizes / zoom levels are only approximately co-located. Production would group by viewport bucket or use CSS-relative coordinates. |
| **URL keying** | Heatmap keys on the full URL including query string. Production would strip UTM params and normalise paths. |
| **Auth / rate limiting** | None. The API is completely open (CORS `*`). Real deployment needs per-site API keys, rate limiting, and bot filtering. |
| **Batching** | The tracker sends one event per request (fetch keepalive). The API already accepts arrays, so batching is a one-line change. |
| **Aggregation** | Sessions are aggregated on read (MongoDB `$group`), capped at 500. At scale, pre-aggregate into a `sessions` collection, paginate results, and bin heatmap data server-side. |
| **Timestamps** | Trusted from the client clock after ISO format validation. Server-side `Date.now()` could be used for the stored timestamp, but client time is needed to see true user behaviour (e.g. time between clicks). |

---

## License

MIT
