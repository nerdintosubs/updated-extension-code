#!/usr/bin/env node
// Measure URL-check success against a ground-truth CSV.
// Usage:
//   node scripts/measure-urls.js --input test-results/url_measurement/urls_ground_truth.csv --out test-results/url_measurement/run-YYYYMMDD-HHMM [--markers markers.json] [--timeout 12000] [--concurrency 5]

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeText } from '../ou-link-validator-A/src/textNormalize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
      args[k] = v;
    }
  }
  return args;
}

function csvParseSimple(text) {
  // Assumes no embedded commas/quotes in fields (our urls should be safe; notes should avoid commas)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, idx) => obj[h] = (cols[idx] ?? '').trim());
    return obj;
  });
  return { header, rows };
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function compileMarkers(markers) {
  return (markers || []).map(m => ({ raw: String(m), norm: normalizeText(m) }));
}

function findSoftFailMarker(bodyText, compiledMarkers) {
  const hay = normalizeText(bodyText || '');
  for (const m of compiledMarkers || []) {
    if (m.norm && hay.includes(m.norm)) return m.raw;
  }
  return null;
}

async function readMarkers(markersPath) {
  if (!markersPath) {
    // Default minimal set; override via --markers markers.json when needed
    return [
      'page not found',
      '404',
      'access denied',
      'forbidden',
      'error',
      'gone',
      'not available',
      'temporarily unavailable'
    ];
  }
  try {
    const txt = await fsp.readFile(markersPath, 'utf8');
    return JSON.parse(txt);
  } catch {
    console.warn(`[measure-urls] Failed to read markers file: ${markersPath}, using defaults.`);
    return undefined;
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ac.signal });
    return res;
  } finally {
    clearTimeout(to);
  }
}

async function readLimitedBody(res, limitBytes = 200_000) {
  const reader = res.body?.getReader ? res.body.getReader() : null;
  if (!reader) return await res.text();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received <= limitBytes) chunks.push(value);
    if (received > limitBytes) break;
  }
  const dec = new TextDecoder();
  return dec.decode(Buffer.concat(chunks));
}

async function main() {
  const args = parseArgs(process.argv);
  const input = args.input || args.i;
  const outDir = args.out || args.o;
  const markersPath = args.markers || null;
  const timeoutMs = Number(args.timeout || 12000);
  const concurrency = Math.max(1, Number(args.concurrency || 5));
  if (!input || !outDir) {
    console.error('Usage: node scripts/measure-urls.js --input <ground_truth.csv> --out <output_dir> [--markers markers.json] [--timeout 12000] [--concurrency 5]');
    process.exit(2);
  }

  const raw = await fsp.readFile(input, 'utf8');
  const { header, rows } = csvParseSimple(raw);
  const requiredCols = ['url', 'expected_label'];
  for (const c of requiredCols) {
    if (!header.includes(c)) {
      console.error(`Missing required column in CSV: ${c}`);
      process.exit(2);
    }
  }

  await ensureDir(outDir);
  const outCsv = path.join(outDir, 'results.csv');
  const headerOut = ['url','expected_label','predicted_label','status_code','soft_fail_hit','off_host','duration_ms','error'];
  await fsp.writeFile(outCsv, headerOut.join(',') + '\n', 'utf8');

  const markers = await readMarkers(markersPath);
  const compiledMarkers = compileMarkers(markers);

  const q = rows.slice();
  let inFlight = 0;
  let idx = 0;

  async function next() {
    if (idx >= q.length) return;
    const row = q[idx++];
    inFlight++;
    try {
      const url = row.url;
      const expected = (row.expected_label || '').trim().toLowerCase();
      const hostType = (row.host_type || '').trim().toLowerCase();
      const off_host = hostType === 'off' ? true : (hostType === 'same' ? false : '');

      const t0 = Date.now();
      let status = '';
      let predicted = 'broken';
      let softHit = '';
      let errMsg = '';
      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        status = String(res.status);
        let body = '';
        try { body = await readLimitedBody(res); } catch {}
        const hit = findSoftFailMarker(body, compiledMarkers);
        softHit = hit ? 'true' : '';
        if (res.status >= 200 && res.status < 400 && !hit) predicted = 'ok';
        else if (hit) predicted = 'soft-fail';
        else predicted = 'broken';
      } catch (e) {
        errMsg = (e && e.name === 'AbortError') ? 'timeout' : (e?.message || 'error');
        status = '';
        predicted = 'broken';
      }
      const dt = Date.now() - t0;
      const line = [url, expected, predicted, status, softHit, off_host, dt, errMsg].map(csvEscape).join(',') + '\n';
      await fsp.appendFile(outCsv, line, 'utf8');
    } finally {
      inFlight--;
      schedule();
    }
  }

  function schedule() {
    while (inFlight < concurrency && idx < q.length) next();
  }

  schedule();
  await new Promise(resolve => {
    const iv = setInterval(() => {
      if (idx >= q.length && inFlight === 0) { clearInterval(iv); resolve(); }
    }, 100);
  });

  console.log(`[measure-urls] Wrote ${outCsv}`);
}

main().catch(err => { console.error(err); process.exit(1); });
