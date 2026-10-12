/*!
 * tracker.js – Lightweight analytics tracker (v1.0)
 *
 * Usage:
 *   <script src="https://YOUR-BACKEND/tracker.js" defer></script>
 *
 * Optional attribute to override the ingest endpoint:
 *   <script src="…/tracker.js" data-api="https://YOUR-BACKEND/api/events" defer></script>
 *
 * What it tracks:
 *   - page_view on load + every SPA navigation (pushState / popstate)
 *   - click  with document-relative x/y, page size, and viewport size
 *
 * Session management:
 *   - UUID stored in localStorage; cookie fallback when storage is blocked.
 *   - A new session is created after 30 min of inactivity.
 *
 * Network:
 *   - Primary: fetch with keepalive=true (works during page unload)
 *   - Fallback: navigator.sendBeacon (if fetch throws)
 *   - Any network/API error is swallowed; the host page is never affected.
 */
(function () {
  'use strict';

  /* ---- Configuration ---- */
  var script    = document.currentScript;
  var ENDPOINT  = (script && script.getAttribute('data-api')) ||
                  (script && new URL(script.src).origin + '/api/events');
  if (!ENDPOINT) return; // cannot determine endpoint – bail silently

  var SESSION_KEY = 'ua_session';
  var SESSION_TTL = 30 * 60 * 1000; // 30 minutes

  /* ---- UUID ---- */
  function uuid() {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* ---- Session management ---- */
  function getSession() {
    var now = Date.now();
    var s   = null;

    // Try localStorage first
    try {
      s = JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (_) {}

    // Expire after inactivity or create new
    if (!s || !s.id || (now - s.last) > SESSION_TTL) {
      s = { id: uuid(), last: now };
    }
    s.last = now;

    // Persist – try localStorage, fall back to cookie
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (_) {
      // localStorage blocked (e.g. private mode on some browsers)
      var m = document.cookie.match(/(?:^|; )ua_sid=([^;]+)/);
      if (m) {
        s.id = m[1];
      }
      document.cookie =
        'ua_sid=' + s.id + '; path=/; max-age=1800; SameSite=Lax';
    }

    return s.id;
  }

  /* ---- Network send ---- */
  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    body,
        keepalive: true, // survives page unload
      }).catch(function () {}); // swallow network errors
    } catch (_) {
      // fetch not available or threw – try sendBeacon
      try {
        navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body);
      } catch (_) {}
    }
  }

  /* ---- Event builders ---- */
  function pageView() {
    send({
      session_id: getSession(),
      type:       'page_view',
      page_url:   location.href,
      timestamp:  new Date().toISOString(),
    });
  }

  function onClick(e) {
    var de = document.documentElement;
    send({
      session_id:  getSession(),
      type:        'click',
      page_url:    location.href,
      timestamp:   new Date().toISOString(),
      x:           Math.round(e.pageX),
      y:           Math.round(e.pageY),
      // Document dimensions allow the heatmap to normalise across screen sizes
      page_w:      Math.max(de.scrollWidth,  de.clientWidth),
      page_h:      Math.max(de.scrollHeight, de.clientHeight),
      viewport_w:  window.innerWidth,
      viewport_h:  window.innerHeight,
    });
  }

  /* ---- Listeners ---- */
  // Capture-phase click so we see every click, even from shadow DOM
  document.addEventListener('click', onClick, true);

  // SPA support: intercept history API mutations
  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var result = original.apply(this, arguments);
      // Emit after the URL has changed
      setTimeout(pageView, 0);
      return result;
    };
  });
  window.addEventListener('popstate', pageView);

  // Fire the initial page view
  pageView();
})();
