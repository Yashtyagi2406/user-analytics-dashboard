import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

/** Format a Date (or ISO string) as a locale string. */
const fmt    = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
/** Relative time, e.g. "2 min ago". */
const fmtRel = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000)       return 'just now';
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

/**
 * Sessions – Shows a table of sessions (left) and a user journey timeline (right).
 */
export default function Sessions() {
  const [sessions, setSessions]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [events,   setEvents]     = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [evtLoad,  setEvtLoad]    = useState(false);
  const [error,    setError]      = useState('');

  /** Fetch the sessions list. */
  const loadSessions = useCallback(() => {
    setLoading(true);
    setError('');
    api.sessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /** Open a session and fetch its events. */
  const openSession = (id) => {
    if (selected === id) return;
    setSelected(id);
    setEvents([]);
    setEvtLoad(true);
    api.sessionEvents(id)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setEvtLoad(false));
  };

  // Derived stats for the header cards
  const totalEvents  = sessions.reduce((s, x) => s + x.total_events, 0);
  const totalClicks  = sessions.reduce((s, x) => s + x.clicks, 0);
  const totalViews   = sessions.reduce((s, x) => s + x.page_views, 0);

  return (
    <>
      {/* ── Stat cards ── */}
      <div className="page-header">
        <div>
          <h1>Sessions</h1>
          <p>Click a row to see the full user journey for that session.</p>
        </div>
        <button id="refresh-sessions" className="btn btn-ghost" onClick={loadSessions} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : '↺'}
          {' '}Refresh
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Sessions</div>
          <div className="stat-value primary">{sessions.length}</div>
          <div className="stat-sub">unique visitors</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value success">{totalEvents}</div>
          <div className="stat-sub">tracked interactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Page Views</div>
          <div className="stat-value accent">{totalViews}</div>
          <div className="stat-sub">across all sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Click Events</div>
          <div className="stat-value warning">{totalClicks}</div>
          <div className="stat-sub">across all sessions</div>
        </div>
      </div>

      {error && (
        <div className="error-box" role="alert">⚠️ {error}</div>
      )}

      {/* ── Two-column split: table | journey ── */}
      <div className="split">
        {/* Left: sessions table */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <div className="panel-title-icon icon-purple">🧑‍💻</div>
              All Sessions
            </div>
            <span className="badge badge-count">{sessions.length}</span>
          </div>

          {loading ? (
            <div className="state-box">
              <div className="spinner" />
              <div className="state-sub">Loading sessions…</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="state-box">
              <div className="state-icon">📭</div>
              <div className="state-title">No sessions yet</div>
              <div className="state-sub">
                Open the demo page and click around to generate your first session.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table id="sessions-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Events</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.session_id}
                      id={`session-row-${s.session_id.slice(0, 8)}`}
                      className={s.session_id === selected ? 'selected' : ''}
                      onClick={() => openSession(s.session_id)}
                      title={`Session: ${s.session_id}`}
                    >
                      <td>
                        <span className="session-id-chip">
                          {s.session_id.slice(0, 8)}…
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{s.total_events}</span>
                        {' '}
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                          (<span className="pill pill-blue">{s.page_views}v</span>
                          {' '}
                          <span className="pill pill-orange">{s.clicks}c</span>)
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{fmtRel(s.last_seen)}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(s.last_seen)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: user journey timeline */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <div className="panel-title-icon icon-green">🗺️</div>
              User Journey
            </div>
            {events.length > 0 && (
              <span className="badge badge-count">{events.length} events</span>
            )}
          </div>

          {!selected ? (
            <div className="state-box">
              <div className="state-icon">👆</div>
              <div className="state-title">Select a session</div>
              <div className="state-sub">Click any row on the left to see the ordered event timeline.</div>
            </div>
          ) : evtLoad ? (
            <div className="state-box">
              <div className="spinner" />
              <div className="state-sub">Loading journey…</div>
            </div>
          ) : events.length === 0 ? (
            <div className="state-box">
              <div className="state-icon">🕳️</div>
              <div className="state-title">No events found</div>
            </div>
          ) : (
            <ol className="timeline" id="journey-timeline">
              {events.map((e, i) => (
                <li key={e._id || i} className="timeline-item">
                  <span className={`badge ${e.type === 'click' ? 'badge-click' : 'badge-view'}`}>
                    {e.type === 'click' ? '🖱' : '📄'}
                    {' '}
                    {e.type === 'click' ? 'click' : 'view'}
                  </span>
                  <div className="timeline-content">
                    <div className="timeline-url">{e.page_url}</div>
                    <div className="timeline-meta">
                      <span>{fmt(e.timestamp)}</span>
                      {e.type === 'click' && (
                        <span className="timeline-coord">
                          x:{e.x} y:{e.y}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
