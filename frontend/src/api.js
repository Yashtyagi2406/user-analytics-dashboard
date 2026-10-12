/**
 * api.js – Thin fetch wrapper for the analytics backend.
 * All paths are relative to VITE_API_URL (set via .env).
 */

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  sessions:      ()    => get('/api/sessions'),
  sessionEvents: (id)  => get(`/api/sessions/${encodeURIComponent(id)}/events`),
  heatmapPages:  ()    => get('/api/heatmap/pages'),
  heatmap:       (url) => get(`/api/heatmap?url=${encodeURIComponent(url)}`),
  health:        ()    => get('/api/health'),
};
