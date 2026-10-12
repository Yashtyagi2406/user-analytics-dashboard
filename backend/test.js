#!/usr/bin/env node
/**
 * test.js – Automated API test suite
 *
 * Tests:
 *   1. Event validation (normalise() unit tests) – no DB required
 *   2. API integration tests (requires backend running on localhost:4000 or TEST_API_URL)
 *
 * Run:
 *   npm test            # just validation unit tests
 *   npm test -- --api   # validation + live API tests (start server first)
 */

'use strict';

const { normalise } = require('./server');

/* ── Tiny test harness ─────────────────────────────────────────────────── */
let pass = 0, fail = 0;
function assert(desc, got, expected) {
  if (JSON.stringify(got) === JSON.stringify(expected) ||
      (expected === null && got === null) ||
      (expected !== null && got !== null && expected === 'truthy' && got)) {
    console.log(`  ✓ ${desc}`);
    pass++;
  } else {
    console.error(`  ✗ ${desc}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      got:      ${JSON.stringify(got)}`);
    fail++;
  }
}
function ok(desc, v)  { assert(desc, !!v, true);  }
function nil(desc, v) { assert(desc, v, null); }

/* ── 1. normalise() unit tests ─────────────────────────────────────────── */
console.log('\n── Event validation tests ────────────────────────────────────\n');

const validPV = {
  session_id: 'abc-123',
  type: 'page_view',
  page_url: 'http://localhost/demo.html',
  timestamp: new Date().toISOString(),
};
const validClick = {
  ...validPV,
  type: 'click',
  x: 100, y: 200, page_w: 1280, page_h: 800, viewport_w: 1280, viewport_h: 720,
};

ok('valid page_view returns an object',         normalise(validPV));
ok('valid click returns an object',             normalise(validClick));
nil('null input returns null',                  normalise(null));
nil('non-object returns null',                  normalise('string'));
nil('missing session_id returns null',          normalise({ ...validPV, session_id: '' }));
nil('session_id > 100 chars returns null',      normalise({ ...validPV, session_id: 'x'.repeat(101) }));
nil('unknown type returns null',                normalise({ ...validPV, type: 'scroll' }));
nil('missing page_url returns null',            normalise({ ...validPV, page_url: '' }));
nil('page_url > 2000 chars returns null',       normalise({ ...validPV, page_url: 'x'.repeat(2001) }));
nil('invalid timestamp returns null',           normalise({ ...validPV, timestamp: 'not-a-date' }));
nil('click without x returns null',             normalise({ ...validClick, x: undefined }));
nil('click without y returns null',             normalise({ ...validClick, y: undefined }));
nil('click with non-numeric x returns null',    normalise({ ...validClick, x: 'abc' }));

// Coercion: x/y can be numeric strings
ok('click with string numbers is accepted',     normalise({ ...validClick, x: '42', y: '88' }));

// page_view should NOT require x/y
ok('page_view without x/y is valid',            normalise({ ...validPV }));

// Timestamp stored as Date
const result = normalise(validPV);
ok('timestamp is a Date object',                result && result.timestamp instanceof Date);

/* ── 2. Array normalise / batch ─────────────────────────────────────────── */
console.log('\n── Batch / array tests ───────────────────────────────────────\n');

const batch = [validPV, validClick, { type: 'bad' }].map(normalise).filter(Boolean);
assert('batch of 3 with 1 invalid => 2 valid', batch.length, 2);

/* ── 3. API integration tests ──────────────────────────────────────────── */
const runApi = process.argv.includes('--api');
if (!runApi) {
  printSummary();
  process.exit(fail > 0 ? 1 : 0);
}

console.log('\n── API integration tests ─────────────────────────────────────\n');

const API = process.env.TEST_API_URL || 'http://localhost:4000';

async function apiTest(desc, method, path, body, expectStatus) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(API + path, opts);
    const json = await res.json().catch(() => ({}));
    if (res.status === expectStatus) {
      console.log(`  ✓ ${desc} (${res.status})`);
      pass++;
    } else {
      console.error(`  ✗ ${desc} – expected ${expectStatus}, got ${res.status}`);
      console.error('      body:', json);
      fail++;
    }
    return { status: res.status, json };
  } catch (e) {
    console.error(`  ✗ ${desc} – fetch error: ${e.message}`);
    fail++;
    return null;
  }
}

(async () => {
  // Health
  await apiTest('GET /api/health',                   'GET',  '/api/health', null, 200);

  // Ingest – valid single event
  await apiTest('POST /api/events – single page_view', 'POST', '/api/events', validPV, 201);

  // Ingest – valid click
  await apiTest('POST /api/events – single click',    'POST', '/api/events', validClick, 201);

  // Ingest – array
  await apiTest('POST /api/events – array of 2',      'POST', '/api/events', [validPV, validClick], 201);

  // Ingest – entirely invalid payload
  await apiTest('POST /api/events – no valid events', 'POST', '/api/events', { type: 'bad' }, 400);

  // Ingest – empty body
  await apiTest('POST /api/events – empty object',    'POST', '/api/events', {}, 400);

  // Sessions list
  const r = await apiTest('GET /api/sessions',        'GET',  '/api/sessions', null, 200);
  if (r && Array.isArray(r.json)) ok('sessions is an array', r.json);

  // Session events
  await apiTest(`GET /api/sessions/${validPV.session_id}/events`, 'GET',
    `/api/sessions/${validPV.session_id}/events`, null, 200);

  // Heatmap pages
  const hp = await apiTest('GET /api/heatmap/pages',  'GET',  '/api/heatmap/pages', null, 200);
  if (hp && Array.isArray(hp.json)) ok('heatmap pages is an array', hp.json);

  // Heatmap data – missing url param
  await apiTest('GET /api/heatmap – missing url',     'GET',  '/api/heatmap', null, 400);

  // Heatmap data – with url
  await apiTest('GET /api/heatmap?url=…',             'GET',
    `/api/heatmap?url=${encodeURIComponent(validClick.page_url)}`, null, 200);

  printSummary();
  process.exit(fail > 0 ? 1 : 0);
})();

function printSummary() {
  console.log(`\n── Summary: ${pass} passed, ${fail} failed ─────────────────────────\n`);
}
