/**
 * server.js – User Analytics API
 *
 * Endpoints:
 *   POST /api/events            – ingest one event or an array
 *   GET  /api/sessions          – sessions list (aggregation, newest first, limit 500)
 *   GET  /api/sessions/:id/events – ordered events for one session
 *   GET  /api/heatmap/pages     – distinct pages with click data
 *   GET  /api/heatmap?url=…     – click coordinates for one page
 *   GET  /api/health            – health check
 *
 * Static:
 *   /tracker.js   – drop-in analytics script
 *   /demo.html    – interactive test page
 */

'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const mongoose  = require('mongoose');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors()); // open CORS for dev; tighten with an origin allowlist in prod

// Accept both application/json and text/plain so sendBeacon can skip the CORS preflight
app.use(express.json({
  limit: '100kb',
  type: ['application/json', 'text/plain'],
}));

// Static files: /tracker.js and /demo.html
app.use(express.static(path.join(__dirname, 'public')));

// Root route: redirect to the demo testbed
app.get('/', (_req, res) => {
  res.redirect('/demo.html');
});

// ── Schema ─────────────────────────────────────────────────────────────────
const eventSchema = new mongoose.Schema(
  {
    session_id:  { type: String, required: true, maxlength: 100 },
    type:        { type: String, enum: ['page_view', 'click'], required: true },
    page_url:    { type: String, required: true, maxlength: 2000 },
    timestamp:   { type: Date,   required: true },
    // Click-only fields (optional on page_view)
    x:           Number, // document-relative pageX
    y:           Number, // document-relative pageY
    page_w:      Number, // document width at click time (for heatmap scaling)
    page_h:      Number,
    viewport_w:  Number,
    viewport_h:  Number,
  },
  { versionKey: false }
);

// Composite indexes for the two main query patterns
eventSchema.index({ session_id: 1, timestamp: 1 }); // journey lookup
eventSchema.index({ type: 1,       page_url: 1  }); // heatmap lookup

const Event = mongoose.model('Event', eventSchema);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Safely parse a value as a finite number; returns undefined if invalid. */
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Validate and normalise a raw event object.
 * Returns a clean document ready for insertion, or null if invalid.
 */
function normalise(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const { session_id, type, page_url } = raw;

  // Required string fields
  if (typeof session_id !== 'string' || !session_id.trim() || session_id.length > 100) return null;
  if (!['page_view', 'click'].includes(type)) return null;
  if (typeof page_url !== 'string' || !page_url.trim() || page_url.length > 2000) return null;

  // Timestamp must be a valid date
  const ts = new Date(raw.timestamp);
  if (isNaN(ts.getTime())) return null;

  const doc = { session_id, type, page_url, timestamp: ts };

  // Click-specific fields: x and y are required; dimensions are optional but stored if present
  if (type === 'click') {
    const x = toNum(raw.x);
    const y = toNum(raw.y);
    if (x === undefined || y === undefined) return null; // clicks must have coordinates
    Object.assign(doc, {
      x,
      y,
      page_w:     toNum(raw.page_w),
      page_h:     toNum(raw.page_h),
      viewport_w: toNum(raw.viewport_w),
      viewport_h: toNum(raw.viewport_h),
    });
  }

  return doc;
}

/** Async route wrapper – passes errors to Express default error handler. */
const wrap = (fn) => (req, res, next) =>
  fn(req, res).catch(next);

// ── Routes ──────────────────────────────────────────────────────────────────

// 1. Ingest: accepts a single event object OR an array of events
app.post('/api/events', wrap(async (req, res) => {
  const raw  = Array.isArray(req.body) ? req.body : [req.body];
  const docs = raw.map(normalise).filter(Boolean);

  if (docs.length === 0) {
    return res.status(400).json({ error: 'No valid events in request body.' });
  }

  // ordered:false lets partial inserts succeed (e.g. if one event is a duplicate)
  await Event.insertMany(docs, { ordered: false });
  res.status(201).json({ stored: docs.length, rejected: raw.length - docs.length });
}));

// 2. Sessions list – newest first, capped at 500
app.get('/api/sessions', wrap(async (_req, res) => {
  const sessions = await Event.aggregate([
    {
      $group: {
        _id:          '$session_id',
        total_events: { $sum: 1 },
        clicks:       { $sum: { $cond: [{ $eq: ['$type', 'click'] },     1, 0] } },
        page_views:   { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
        first_seen:   { $min: '$timestamp' },
        last_seen:    { $max: '$timestamp' },
      },
    },
    { $sort: { last_seen: -1 } },
    { $limit: 500 },
    {
      $project: {
        _id:          0,
        session_id:   '$_id',
        total_events: 1,
        clicks:       1,
        page_views:   1,
        first_seen:   1,
        last_seen:    1,
      },
    },
  ]);
  res.json(sessions);
}));

// 3. User journey: all events for one session, ordered by time
app.get('/api/sessions/:id/events', wrap(async (req, res) => {
  const events = await Event
    .find({ session_id: req.params.id })
    .sort({ timestamp: 1, _id: 1 })
    .lean();
  res.json(events);
}));

// 4a. Heatmap pages: distinct pages that have click events, sorted by click count desc
app.get('/api/heatmap/pages', wrap(async (_req, res) => {
  const pages = await Event.aggregate([
    { $match: { type: 'click' } },
    { $group: { _id: '$page_url', clicks: { $sum: 1 } } },
    { $sort:  { clicks: -1 } },
    { $project: { _id: 0, page_url: '$_id', clicks: 1 } },
  ]);
  res.json(pages);
}));

// 4b. Heatmap data: click coordinates for a specific page URL
app.get('/api/heatmap', wrap(async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required.' });
  }

  const clicks = await Event
    .find({ type: 'click', page_url: url })
    .select('x y page_w page_h viewport_w viewport_h timestamp -_id')
    .limit(10_000) // safety cap – at scale, use server-side spatial binning
    .lean();

  res.json(clicks);
}));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Error handler ───────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Boot ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/user_analytics';

if (require.main === module) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log(`[db] MongoDB connected: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
      app.listen(PORT, () =>
        console.log(`[api] Listening on http://localhost:${PORT}  (tracker + demo at /tracker.js, /demo.html)`)
      );
    })
    .catch((err) => {
      console.error('[db] Connection failed:', err.message);
      process.exit(1);
    });
}

// Export for testing
module.exports = { app, normalise };
