import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Heatmap – Shows a dropdown of pages with click data, renders click positions
 * as translucent radial dots on a scaled canvas.
 *
 * Coordinate system:
 *   - Clicks are stored as document-relative pageX/pageY.
 *   - The canvas is sized to the largest (page_w × page_h) recorded for that page,
 *     then all dots are plotted as percentages of those dimensions.
 *   - An optional iframe overlay shows the live page for context (may be blocked
 *     by X-Frame-Options on external sites).
 */
export default function Heatmap() {
  const [pages,     setPages]     = useState([]);
  const [url,       setUrl]       = useState('');
  const [clicks,    setClicks]    = useState([]);
  const [showPage,  setShowPage]  = useState(false);
  const [loadingP,  setLoadingP]  = useState(true);
  const [loadingC,  setLoadingC]  = useState(false);
  const [error,     setError]     = useState('');

  // Fetch the list of pages that have click data
  useEffect(() => {
    setLoadingP(true);
    api.heatmapPages()
      .then((p) => {
        setPages(p);
        if (p.length > 0) setUrl(p[0].page_url);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingP(false));
  }, []);

  // Fetch click data whenever the selected URL changes
  useEffect(() => {
    if (!url) return;
    setLoadingC(true);
    setClicks([]);
    api.heatmap(url)
      .then(setClicks)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingC(false));
  }, [url]);

  // Determine canvas dimensions from the maximum recorded page size
  const canvasW = Math.max(1, ...clicks.map((c) => c.page_w || 0), ...clicks.map((c) => c.x || 0));
  const canvasH = Math.max(1, ...clicks.map((c) => c.page_h || 0), ...clicks.map((c) => c.y || 0));

  const selectedPage = pages.find((p) => p.page_url === url);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Click Heatmap</h1>
          <p>Visualise where users click on each page. Dots are plotted in document coordinates.</p>
        </div>
      </div>

      {error && <div className="error-box" role="alert">⚠️ {error}</div>}

      <div className="panel" style={{ maxWidth: '100%' }}>
        <div className="panel-header">
          <div className="panel-title">
            <div className="panel-title-icon icon-orange">🔥</div>
            Heatmap Canvas
          </div>
        </div>

        {/* Controls */}
        <div className="heatmap-controls">
          <div className="select-wrap">
            {loadingP ? (
              <select disabled><option>Loading pages…</option></select>
            ) : pages.length === 0 ? (
              <select disabled><option>No click data yet – open the demo page and click around</option></select>
            ) : (
              <select
                id="heatmap-page-select"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              >
                {pages.map((p) => (
                  <option key={p.page_url} value={p.page_url}>
                    {p.page_url}  ({p.clicks} click{p.clicks !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            )}
            <span className="select-arrow">▾</span>
          </div>

          <label className="toggle-label" htmlFor="show-page-toggle">
            <input
              id="show-page-toggle"
              type="checkbox"
              checked={showPage}
              onChange={(e) => setShowPage(e.target.checked)}
            />
            Show page behind
          </label>
        </div>

        {/* Info chips */}
        {clicks.length > 0 && (
          <div className="heatmap-info">
            <div className="heatmap-info-chip">
              🖱 <strong>{clicks.length}</strong> click{clicks.length !== 1 ? 's' : ''} plotted
            </div>
            {selectedPage && (
              <div className="heatmap-info-chip">
                📄 <strong>{selectedPage.clicks}</strong> total for this page
              </div>
            )}
            <div className="heatmap-info-chip">
              📐 Canvas: {canvasW} × {canvasH}px
            </div>
          </div>
        )}

        {/* The heatmap canvas */}
        {loadingC ? (
          <div className="heat-empty">
            <div className="spinner" />
            <div>Loading click data…</div>
          </div>
        ) : clicks.length === 0 && url ? (
          <div className="heat-empty">
            <div style={{ fontSize: 36 }}>🕳️</div>
            <div>No clicks recorded for this URL yet.</div>
          </div>
        ) : clicks.length === 0 ? (
          <div className="heat-empty">
            <div style={{ fontSize: 36 }}>🔥</div>
            <div>Select a page URL above to see its heatmap.</div>
          </div>
        ) : (
          <div
            id="heatmap-canvas"
            className="heat-canvas"
            style={{ aspectRatio: `${canvasW} / ${canvasH}` }}
          >
            {/* Optional iframe overlay */}
            {showPage && url && (
              <iframe
                src={url}
                title="Page preview"
                sandbox="allow-same-origin allow-scripts"
              />
            )}

            {/* Click dots */}
            {clicks.map((c, i) => (
              <div
                key={i}
                className="heat-dot"
                style={{
                  left:  `${((c.x || 0) / canvasW) * 100}%`,
                  top:   `${((c.y || 0) / canvasH) * 100}%`,
                }}
                title={`x:${c.x} y:${c.y}`}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        {clicks.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(249,115,22,.85) 0%, rgba(249,115,22,0) 80%)'
            }} />
            Each dot = one click. Overlapping dots indicate hotspots.
          </div>
        )}
      </div>
    </>
  );
}
