import { useState } from 'react';
import Sessions from './Sessions.jsx';
import Heatmap from './Heatmap.jsx';

/**
 * App – Root component with tab navigation between Sessions and Heatmap views.
 */
export default function App() {
  const [tab, setTab] = useState('sessions');

  return (
    <div className="app">
      {/* ── Sticky header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">⚡</div>
          <div>
            <div className="header-title">Analytics Dashboard</div>
            <div className="header-subtitle">Real-time user tracking</div>
          </div>
        </div>

        <nav className="header-nav">
          <button
            id="tab-sessions"
            className={`tab-btn ${tab === 'sessions' ? 'active' : ''}`}
            onClick={() => setTab('sessions')}
          >
            <span>🧑‍💻</span>
            <span>Sessions</span>
          </button>
          <button
            id="tab-heatmap"
            className={`tab-btn ${tab === 'heatmap' ? 'active' : ''}`}
            onClick={() => setTab('heatmap')}
          >
            <span>🔥</span>
            <span>Heatmap</span>
          </button>
        </nav>

        <div className="header-actions">
          <div className="live-badge">
            <span className="live-dot" />
            Live
          </div>
          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/demo.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="demo-link"
            id="demo-page-link"
          >
            <span>🌐</span>
            <span>Demo page</span>
          </a>
        </div>
      </header>

      {/* ── Main content (switches between tabs) ── */}
      <main className="main">
        {tab === 'sessions' ? <Sessions /> : <Heatmap />}
      </main>
    </div>
  );
}
