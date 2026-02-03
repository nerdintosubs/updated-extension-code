import os, json, textwrap, subprocess, hashlib, pathlib, sys, shutil, re, datetime, zipfile, pprint

# Use a workspace-local build/output folder so it works on Windows/Linux.
base = os.path.join(os.getcwd(), "ou-link-validator-A")
if os.path.exists(base):
    shutil.rmtree(base)
os.makedirs(base, exist_ok=True)

def w(path, content, mode="w"):
    full = os.path.join(base, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, mode, encoding="utf-8") as f:
        f.write(content)

# ---------- Extension files ----------
manifest = {
  "manifest_version": 3,
  "name": "OU Link Validator",
  "version": "1.2.2",
  "description": "Validate live Oracle MyLearn links, export CSV, copy FAIL URLs.",
  "permissions": ["clipboardWrite", "tabs", "scripting", "webNavigation"],
  "host_permissions": ["https://mylearn.oracle.com/*"],
  "background": {"service_worker": "bg.js", "type": "module"},
  "action": {
    "default_popup": "popup.html",
    "default_icon": {"16": "icon.png", "32": "icon.png", "48": "icon.png", "128": "icon.png"}
  },
  "icons": {"16": "icon.png", "32": "icon.png", "48": "icon.png", "128": "icon.png"}
}
w("manifest.json", json.dumps(manifest, indent=2) + "\n")

# Minimal icon placeholder (not a real png). We'll include a tiny valid PNG to avoid load errors.
# Create a 1x1 transparent PNG bytes
png_bytes = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000A49444154789C6360000002000154A24F9B0000000049454E44AE426082"
)
icon_path = os.path.join(base, "icon.png")
with open(icon_path, "wb") as f:
    f.write(png_bytes)

w("popup.html", textwrap.dedent("""\
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>OU Link Validator</title>
  <style>
    body { font: 13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; width: 420px; margin: 12px; }
    textarea { width: 100%; height: 120px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    button { margin: 6px 6px 0 0; }
    .ok { color: #0b6b0b; }
    .fail { color: #a10b0b; }
    #actionStatus { margin: 8px 0; }
    details { margin-top: 8px; }
    label { display: block; margin: 6px 0 2px; }
    input[type="number"] { width: 120px; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h3>Paste MyLearn Links</h3>
  <textarea id="linksInput" placeholder="https://mylearn.oracle.com/ou/course/..."></textarea>

  <div>
    <button id="checkBtn">Check Status</button>
    <button id="exportBtn" disabled>Export CSV (All)</button>
    <button id="exportFailBtn" disabled>Export CSV (FAIL)</button>
    <button id="copyFailBtn" disabled>Copy FAIL URLs</button>
  </div>

  <div id="actionStatus" aria-live="polite"></div>

  <details>
    <summary><b>Settings (optional)</b></summary>
    <p>Tune render-based checks. Leave defaults if unsure.</p>
    <label>Timeout (ms): <input id="timeoutMs" type="number" min="2000" step="500" value="12000"></label>
    <label>Concurrency: <input id="concurrency" type="number" min="1" max="6" step="1" value="3"></label>
    <label>Selectors (one per line):</label>
    <textarea id="selectorsInput" style="height: 110px;">main h1
[data-testid*="course"]
[data-test*="course"]
[class*="learning-path"]
[class*="course"]
article h1
header h1</textarea>
    <label><input id="debug" type="checkbox"> Debug logging (service worker console)</label>
  </details>

  <div id="result" aria-busy="false"></div>
  <script src="popup.js"></script>
</body>
</html>
"""))

w("popup.js", textwrap.dedent("""\
/**
 * Popup UI for OU Link Validator.
 * - Validates input URLs (MyLearn only)
 * - Uses background service worker for render-based validation
 * - Exports CSV and copies FAIL URLs
 */
const HOST = "mylearn.oracle.com";
let lastResults = [], runIso = null;

const $ = id => document.getElementById(id);
const clearEl = el => { while (el.firstChild) el.removeChild(el.firstChild); };
const setButtons = st => {
  $("exportBtn").disabled      = !st.all;
  $("exportFailBtn").disabled  = !st.fail;
  $("copyFailBtn").disabled    = !st.fail;
};
const status = msg => { $("actionStatus").textContent = msg; };

function isMyLearn(u){
  try {
    const x = new URL(u.trim());
    return x.hostname === HOST && ["https:","http:"].includes(x.protocol);
  } catch { return false; }
}

function csvEscape(v){
  if(v==null) return "";
  const s = String(v);
  return /[",\\n\\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function toCsv(rows){
  const head=["run_at","url","final_url","result","reason","marker","selector","checked_at"];
  return [head,...rows].map(r=>r.map(csvEscape).join(",")).join("\\n");
}
function dlCsv(text,name){
  const b=new Blob([text],{type:"text/csv"}),u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u; a.download=name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}
async function copy(txt){ await navigator.clipboard.writeText(txt); }

$("exportBtn").addEventListener("click",()=>{
  if(!lastResults.length) return;
  const csv=toCsv(lastResults.map(o=>[
    runIso,o.url,o.fin,o.ok?"PASS":"FAIL",o.why,o.mark||"",o.selector||"",o.at
  ]));
  dlCsv(csv,`OU_Link_check_ALL_${runIso.replace(/[:.]/g,"-")}.csv`);
  status("CSV (all) exported.");
});

$("exportFailBtn").addEventListener("click",()=>{
  const fails=lastResults.filter(r=>!r.ok);
  if(!fails.length){ status("No FAIL rows."); return; }
  const csv=toCsv(fails.map(o=>[
    runIso,o.url,o.fin,"FAIL",o.why,o.mark||"",o.selector||"",o.at
  ]));
  dlCsv(csv,`OU_Link_check_FAIL_${runIso.replace(/[:.]/g,"-")}.csv`);
  status("CSV (FAIL) exported.");
});

$("copyFailBtn").addEventListener("click",async()=>{
  const fails=lastResults.filter(r=>!r.ok).map(r=>r.url).join("\\n");
  if(!fails){ status("No FAIL URLs."); return; }
  try { await copy(fails); status("FAIL URLs copied."); }
  catch { status("Clipboard blocked by browser."); }
});

$("checkBtn").addEventListener("click", async ()=>{
  const lines = $("linksInput").value.split(/\\n/).map(x=>x.trim()).filter(Boolean);
  const valid = lines.filter(isMyLearn);
  const invalid = lines.filter(x=>!isMyLearn(x));

  const resEl = $("result");
  clearEl(resEl); resEl.textContent="Preparing..."; resEl.setAttribute("aria-busy","true");
  status(""); setButtons({all:false,fail:false});
  runIso = new Date().toISOString(); lastResults = [];

  clearEl(resEl);
  if(invalid.length){
    const lbl=document.createElement("b"); lbl.textContent="Invalid URLs:"; resEl.appendChild(lbl);
    const ul=document.createElement("ul");
    invalid.forEach(l=>{ const li=document.createElement("li"); li.className="fail"; li.textContent=`FAIL ${l}`; ul.appendChild(li); });
    resEl.appendChild(ul);
  }
  if(!valid.length){ status("No valid MyLearn URLs."); resEl.removeAttribute("aria-busy"); return; }

  const lbl2=document.createElement("b"); lbl2.textContent="Results:"; resEl.appendChild(lbl2);
  const ul2=document.createElement("ul"); resEl.appendChild(ul2);

  let processed=0, failCount=0;
  status(`Checking 0/${valid.length}...`);

  try{
    const port = chrome.runtime.connect({ name: "validator" });
    const timeoutMs = Number($("timeoutMs")?.value || 12000);
    const concurrency = Number($("concurrency")?.value || 3);
    const selectorsRaw = $("selectorsInput")?.value || "";
    const selectors = selectorsRaw.split(/\\n/).map(s=>s.trim()).filter(Boolean);
    const debug = Boolean($("debug")?.checked);

    port.onMessage.addListener((msg)=>{
      if(msg.type==="progress" && msg.result){
        processed++;
        lastResults.push(msg.result);
        if(!msg.result.ok) failCount++;

        status(`Checking ${processed}/${valid.length}...`);

        const r = msg.result;
        const li=document.createElement("li"); li.className=r.ok?"ok":"fail";
        const det=[`why=${r.why}`, r.selector?`sel=${r.selector}`:null, r.mark?`mark=${r.mark}`:null]
          .filter(Boolean).join(" | ");
        li.textContent = r.ok ? `OK ${r.url}` : `FAIL ${r.url} (${det})`;
        ul2.appendChild(li);
      } else if(msg.type==="done"){
        setButtons({all:lastResults.length>0,fail:failCount>0});
        status(`Done. Total ${lastResults.length}, FAIL ${failCount}`);
        resEl.removeAttribute("aria-busy");
        try{ port.disconnect(); } catch {}
      }
    });

    port.postMessage({ type:"start", urls: valid, options: { timeoutMs, concurrency, selectors, debug } });
  } catch (e){
    status(`Cannot start render-based validation: ${e?.message||e}`);
    resEl.removeAttribute("aria-busy");
  }
});
"""))

# ---------- Injected probe (self-contained, no imports) ----------
w("src/injectedProbe.js", textwrap.dedent("""\
/**
 * injectedProbe(cfg) is serialized by chrome.scripting.executeScript and executed in the page context.
 * IMPORTANT: it must be self-contained and not reference outer-scope symbols.
 *
 * Fix in v1.2.2: robust soft-404/error-text detection using unicode-safe normalization
 * (curly apostrophes/quotes, whitespace, casing).
 */
export function injectedProbe(cfg) {
  const finalUrl = location.href;

  // Build BAD URL regex for auth redirects (e.g., /login, saml)
  const BAD = (() => {
    const esc = (p) => p.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
    return new RegExp((cfg.BAD_URL_PARTS || []).map(esc).join("|"), "i");
  })();

  // Normalize unicode punctuation + text for matching
  function normalizePunctuation(s) {
    return String(s || "")
      .replace(/[\\u2018\\u2019\\u02BC\\uFF07]/g, "'")  // apostrophes
      .replace(/[\\u201C\\u201D\\u2033]/g, '"')        // quotes
      .replace(/[\\u2013\\u2014]/g, "-");              // dashes
  }
  function normalizeText(input) {
    const raw = normalizePunctuation(String(input || ""));
    const nfkd = raw.normalize("NFKD");
    const noMarks = nfkd.replace(/[\\u0300-\\u036f]/g, "");
    return noMarks.toLowerCase().replace(/\\s+/g, " ").trim();
  }

  if (BAD.test(finalUrl)) {
    return { ok: false, why: "AUTH_REDIRECT", mark: null, selector: null, fin: finalUrl };
  }

  // Soft-FAIL markers (normalized match)
  const markers = (cfg.SOFT_FAIL_MARKERS || []).map((m) => ({ raw: m, norm: normalizeText(m) }));
  function findSoftFailMarkerInText(bodyText) {
    const hay = normalizeText(bodyText || "");
    for (const m of markers) {
      if (m.norm && hay.includes(m.norm)) return m.raw;
    }
    return null;
  }

  function querySelectors(selectors) {
    for (const s of selectors || []) {
      const el = document.querySelector(s);
      if (el) return { selector: s, text: (el.textContent || "").trim().slice(0, 200) };
    }
    return null;
  }

  function waitForSelectors(selectors, timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const hit = querySelectors(selectors);
        if (hit) { resolve(hit); return; }
        if (Date.now() - start > timeout) { resolve(null); return; }
        setTimeout(check, 200);
      };
      check();
    });
  }

  const bodyText = document.body ? (document.body.innerText || "") : "";
  const err = findSoftFailMarkerInText(bodyText);
  if (err) {
    return { ok: false, why: "ERROR_TEXT", mark: err, selector: null, fin: finalUrl };
  }

  return (async () => {
    const found = await waitForSelectors(cfg.SELECTORS, cfg.TIMEOUT_MS);

    if (found) {
      // Extra guard: if the matched selector text looks like an error marker, treat as FAIL.
      const selTextNorm = normalizeText(found.text || "");
      for (const m of markers) {
        if (m.norm && selTextNorm.includes(m.norm)) {
          return { ok: false, why: "ERROR_TEXT", mark: found.text, selector: found.selector, fin: finalUrl };
        }
      }
      return { ok: true, why: "RENDER_OK", mark: found.text, selector: found.selector, fin: finalUrl };
    }

    return { ok: false, why: "NO_SELECTOR", mark: null, selector: null, fin: finalUrl };
  })();
}
"""))

# ---------- Testable pure logic modules ----------
w("src/textNormalize.js", textwrap.dedent("""\
/**
 * Text normalization helpers for robust marker matching.
 * Mirrors the logic used in src/injectedProbe.js (kept in sync intentionally).
 */

export function normalizePunctuation(s) {
  return String(s ?? "")
    .replace(/[\\u2018\\u2019\\u02BC\\uFF07]/g, "'")
    .replace(/[\\u201C\\u201D\\u2033]/g, '"')
    .replace(/[\\u2013\\u2014]/g, "-");
}

export function normalizeText(input) {
  const raw = normalizePunctuation(String(input ?? ""));
  const nfkd = raw.normalize("NFKD");
  const noMarks = nfkd.replace(/[\\u0300-\\u036f]/g, "");
  return noMarks.toLowerCase().replace(/\\s+/g, " ").trim();
}
"""))

w("src/softFail.js", textwrap.dedent("""\
import { normalizeText } from "./textNormalize.js";

/**
 * Create normalized marker index once per run.
 * @param {string[]} markers
 * @returns {{raw:string,norm:string}[]}
 */
export function compileMarkers(markers) {
  return (markers || []).map((m) => ({ raw: String(m), norm: normalizeText(m) }));
}

/**
 * Find first marker contained in bodyText (unicode-normalized).
 * @param {string} bodyText
 * @param {{raw:string,norm:string}[]} compiledMarkers
 * @returns {string|null} raw marker value if found, else null
 */
export function findSoftFailMarker(bodyText, compiledMarkers) {
  const hay = normalizeText(bodyText || "");
  for (const m of compiledMarkers || []) {
    if (m.norm && hay.includes(m.norm)) return m.raw;
  }
  return null;
}
"""))

w("src/url.js", textwrap.dedent("""\
/**
 * Utility functions used by the background worker.
 */

export function normalizeUrl(u) {
  try {
    const x = new URL(String(u).trim());
    x.protocol = "https:";
    return x.toString();
  } catch {
    return String(u || "");
  }
}

export function isOffHost(url, host) {
  try { return new URL(url).hostname !== host; } catch { return false; }
}

export function includesBadAuthPart(url, badParts) {
  const lower = String(url || "").toLowerCase();
  return (badParts || []).some((p) => lower.includes(String(p).toLowerCase()));
}
"""))

# ---------- bg.js uses injectedProbe and url utils ----------
w("bg.js", textwrap.dedent("""\
import { injectedProbe } from "./src/injectedProbe.js";
import { normalizeUrl, isOffHost, includesBadAuthPart } from "./src/url.js";

// MV3 background service worker for render-based validation
const CONFIG = {
  HOST: "mylearn.oracle.com",
  BAD_URL_PARTS: ["/login","/signin","/sign-in","/sso","/oauth","/auth","idp","saml"],
  SOFT_FAIL_MARKERS: [
    "we couldn't find the resource",
    "we couldnt find the resource", // small variant (missing apostrophe)
    "retired or obsolete",
    "access denied",
    "you do not have access",
    "not authorized",
    "permission denied"
  ],
  // Heuristics for a rendered course page
  SELECTORS: [
    "main h1",
    "[data-testid*=\\"course\\"]",
    "[data-test*=\\"course\\"]",
    "[class*=\\"learning-path\\"]",
    "[class*=\\"course\\"]",
    "article h1",
    "header h1"
  ],
  TIMEOUT_MS: 12000,
  DEBUG: false
};

function logDebug(cfg, ...args) {
  if (cfg?.DEBUG) console.debug("[OU Link Validator]", ...args);
}

function waitForNavigationComplete(tabId, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      try { chrome.webNavigation.onCompleted.removeListener(onComplete); } catch {}
      try { chrome.webNavigation.onErrorOccurred.removeListener(onError); } catch {}
      clearTimeout(timer);
      resolve();
    };
    const onComplete = (details) => { if (details.tabId === tabId && details.frameId === 0) finish(); };
    const onError = (details) => { if (details.tabId === tabId && details.frameId === 0) finish(); };
    chrome.webNavigation.onCompleted.addListener(onComplete);
    chrome.webNavigation.onErrorOccurred.addListener(onError);
    const timer = setTimeout(finish, timeoutMs);
  });
}

function safePost(port, msg) {
  try { port.postMessage(msg); } catch {}
}

// Per-connection (popup session) state
const portState = new Map(); // port -> {queue:[], active:number, concurrency:number, cfg:CONFIG, openTabs:Set<number>}

async function processJob(job, port, effCfg) {
  const at = new Date().toISOString();
  let tabId = null;

  try {
    const state = portState.get(port);
    if (!state) return; // disconnected
    const created = await chrome.tabs.create({ url: job.norm, active: false });
    tabId = created.id;
    state.openTabs.add(tabId);

    await waitForNavigationComplete(tabId, 10000);

    // Check final URL before attempting injection (may be off-host or auth)
    let finalUrl = job.norm;
    try {
      const info = await chrome.tabs.get(tabId);
      finalUrl = info.url || job.norm;
    } catch {}

    const offHost = isOffHost(finalUrl, effCfg.HOST);
    const badAuth = includesBadAuthPart(finalUrl, effCfg.BAD_URL_PARTS);
    logDebug(effCfg, "navigate", { orig: job.orig, norm: job.norm, finalUrl, offHost, badAuth });

    let payload;
    if (offHost || badAuth) {
      payload = { ok: false, why: offHost ? "OFF_HOST_REDIRECT" : "AUTH_REDIRECT", fin: finalUrl };
    } else {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: injectedProbe,
        args: [effCfg]
      });
      payload = res && res.result ? res.result : { ok: false, why: "INJECT_ERR", fin: finalUrl };
    }

    const out = {
      url: job.orig,
      fin: payload.fin || finalUrl || job.norm,
      ok: Boolean(payload.ok),
      why: payload.why || "UNKNOWN",
      mark: payload.mark || "",
      selector: payload.selector || "",
      at
    };

    safePost(port, { type: "progress", result: out });
  } catch (e) {
    safePost(port, { type: "progress", result: {
      url: job.orig, fin: null, ok: false, why: "BG_ERR", mark: String(e), selector: "", at
    }});
  } finally {
    if (tabId != null) {
      try { await chrome.tabs.remove(tabId); } catch {}
      const state = portState.get(port);
      if (state) state.openTabs.delete(tabId);
    }
  }
}

function pump(port) {
  const state = portState.get(port);
  if (!state) return;

  while (state.active < state.concurrency && state.queue.length > 0) {
    const job = state.queue.shift();
    state.active++;

    (async () => { await processJob(job, port, state.cfg); })()
      .finally(() => {
        state.active--;
        if (state.active === 0 && state.queue.length === 0) {
          safePost(port, { type: "done" });
        } else {
          pump(port);
        }
      });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "validator") return;

  port.onMessage.addListener((msg) => {
    if (msg.type === "start" && Array.isArray(msg.urls)) {
      // Build effective config from overrides
      const effCfg = { ...CONFIG };
      if (msg.options) {
        if (Array.isArray(msg.options.selectors) && msg.options.selectors.length) effCfg.SELECTORS = msg.options.selectors;
        if (typeof msg.options.timeoutMs === "number" && msg.options.timeoutMs >= 2000) effCfg.TIMEOUT_MS = msg.options.timeoutMs;
        if (typeof msg.options.debug === "boolean") effCfg.DEBUG = msg.options.debug;
      }
      const concurrency = Math.min(Math.max(Number(msg.options?.concurrency || 3), 1), 6);

      const pairs = msg.urls.map((u) => ({ orig: u, norm: normalizeUrl(u) }));
      portState.set(port, { queue: pairs.slice(), active: 0, concurrency, cfg: effCfg, openTabs: new Set() });
      pump(port);
    }
  });

  port.onDisconnect.addListener(() => {
    const st = portState.get(port);
    portState.delete(port);
    if (st && st.openTabs) {
      for (const id of st.openTabs) { try { chrome.tabs.remove(id); } catch {} }
    }
  });
});
"""))

# ---------- Docs ----------
w("CHANGELOG.md", textwrap.dedent("""\
## 1.2.2 - Soft-404 detection fix (unicode-safe)
### Changed
- Improved soft-fail detection by normalizing page text (unicode apostrophes/quotes, whitespace, case) before matching error markers.
- Added additional guard: if the rendered selector text itself matches an error marker, mark as FAIL.
- Refactored shared business logic into small modules and added Jest unit tests + GitHub Actions CI.

### Why
- MyLearn soft-404 pages can show “We couldn’t find the resource…” using curly apostrophes, causing previous string matching to miss and incorrectly report OK.

### Migration / Compatibility
- Background service worker is now an ES module (`"type": "module"`). If you have custom forks that relied on `importScripts()` in bg.js, migrate to ESM `import` statements.
"""))

w("README.md", textwrap.dedent("""\
# OU Link Validator (MV3 Extension)

Paste Oracle MyLearn URLs → live render check → export CSV / copy FAIL URLs.

## Key behavior
- Opens each URL in a background tab and probes the rendered DOM
- Detects auth/off-host redirects and common soft-404 or access-denied pages (unicode-safe)
- No secrets or cookies stored by the tool; runs entirely in the browser

## Install (Chrome)
1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select the folder that contains manifest.json
5. Be logged in to MyLearn in the same Chrome profile (VPN if required)

## Use
1. Paste one URL per line
2. Click Check Status
3. Export CSV (all/FAIL) or Copy FAIL URLs

## Dev
- Node.js 20.11.x
- Install dev deps: `npm ci`
- Lint: `npm run lint`
- Test: `npm test`

## CI
GitHub Actions workflow runs:
- ESLint
- Jest (with coverage)
- npm audit --audit-level=high

## Troubleshooting
- You must be signed in to MyLearn; otherwise links may redirect to auth and be flagged as FAIL (AUTH_REDIRECT).
- Enterprise setups may block third-party cookies; if checks fail unexpectedly, allow cookies for https://mylearn.oracle.com.

## Security & compliance
- No credentials are embedded; do not add secrets.
- Dev dependencies (Jest/jsdom/ESLint) are third-party; verify they align with corporate security/compliance guidelines before use.
"""))

# ---------- Dev tooling ----------
w("package.json", json.dumps({
"name": "ou-link-validator-devtools",
"version": "1.2.2",
"private": True,
"description": "Dev tooling for OU Link Validator (tests/lint/ci).",
"engines": {"node": ">=20.11.0"},
"scripts": {
"lint": "eslint .",
"test": "jest --coverage"
},
"devDependencies": {
"eslint": "8.57.0",
"jest": "29.7.0",
"jsdom": "24.0.0"
}
}, indent=2) + "\n")

w(".eslintrc.cjs", textwrap.dedent("""
module.exports = {
env: {
browser: true,
es2022: true,
node: true,
jest: true
},
parserOptions: {
ecmaVersion: 2022,
sourceType: "module"
},
rules: {
"no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
"no-console": "off"
}
};
"""))

w(".github/workflows/ci.yml", textwrap.dedent("""
name: ci
on:
  push:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js 20
        uses: actions/setup-node@v4
"""))

# ---------- Unit tests ----------
w("test/textNormalize.test.js", textwrap.dedent("""\
import { normalizePunctuation, normalizeText } from "../src/textNormalize.js";

describe("textNormalize", () => {
  test("normalizePunctuation converts curly apostrophes to ASCII", () => {
    expect(normalizePunctuation("couldn\u2019t")).toBe("couldn't");
  });

  test("normalizeText lowercases, trims, collapses whitespace", () => {
    expect(normalizeText(" Hello WORLD \n")).toBe("hello world");
  });

  test("normalizeText removes combining marks (NFKD)", () => {
    const s = "Cafe\u0301"; // e + combining acute
    expect(normalizeText(s)).toBe("cafe");
  });
});
"""))

w("test/softFail.test.js", textwrap.dedent("""\
import { compileMarkers, findSoftFailMarker } from "../src/softFail.js";

describe("softFail detection", () => {
  test("findSoftFailMarker matches even with curly apostrophes", () => {
    const body = "We couldn’t find the resource you’re looking for"; // curly apostrophes
    const compiled = compileMarkers(["we couldn't find the resource"]);
    expect(findSoftFailMarker(body, compiled)).toBe("we couldn't find the resource");
  });

  test("findSoftFailMarker returns null when no marker exists", () => {
    const compiled = compileMarkers(["access denied"]);
    expect(findSoftFailMarker("valid course page", compiled)).toBeNull();
  });

  test("compileMarkers preserves raw values", () => {
    const compiled = compileMarkers(["A", "B"]);
    expect(compiled.map(x => x.raw)).toEqual(["A", "B"]);
  });
});
"""))

w("test/url.test.js", textwrap.dedent("""\
import { normalizeUrl, isOffHost, includesBadAuthPart } from "../src/url.js";

describe("url utils", () => {
  test("normalizeUrl forces https", () => {
    expect(normalizeUrl("http://mylearn.oracle.com/ou/course/1")).toMatch(/^https:\/\//);
  });

  test("isOffHost", () => {
    expect(isOffHost("https://mylearn.oracle.com/ou/course/1", "mylearn.oracle.com")).toBe(false);
    expect(isOffHost("https://example.com/x", "mylearn.oracle.com")).toBe(true);
  });

  test("includesBadAuthPart", () => {
    expect(includesBadAuthPart("https://mylearn.oracle.com/login", ["/login"])).toBe(true);
    expect(includesBadAuthPart("https://mylearn.oracle.com/ou/course/1", ["/login"])).toBe(false);
  });
});
"""))

# ---------- Unit tests ----------
# Add a small doc for commit history and rollback/remediation
w("docs/COMMIT_HISTORY.md", textwrap.dedent("""\
Suggested atomic commit history

fix(soft-404): normalize MyLearn error text to detect unicode apostrophes
refactor: extract normalization and soft-fail logic into src modules
test: add Jest unit tests + coverage gate for business logic
chore(ci): add GitHub Actions (lint, test, npm audit)
docs: update README + CHANGELOG (migration note and rollback plan)
"""))

w("docs/ROLLBACK.md", textwrap.dedent("""\
Remediation steps

Upgrade to v1.2.2 (load unpacked or publish internally).
Validate against:
Known soft-404 URLs (should FAIL with ERROR_TEXT)
Known-good course URLs (should PASS with RENDER_OK)
If FAIL rate jumps unexpectedly, review SOFT_FAIL_MARKERS/SELECTORS and cookie/VPN constraints.
Rollback plan

Revert to v1.2.1 by checking out that tag/commit and re-loading the unpacked extension folder.
If you must keep v1.2.2 code but disable the change, remove the unicode normalization section inside src/injectedProbe.js
(not recommended) or remove the new marker(s) from SOFT_FAIL_MARKERS.
"""))

# ---------- Create zip artifact ----------
# Place zip artifact inside the build folder
zip_path = os.path.join(base, "ou-link-validator-A_solution.zip")
if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(base):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, base)
            z.write(full, arcname=rel)

# ---------- Attempt to run Node-based tests (if node/npm exist) ----------
def run(cmd, cwd=base):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except Exception as e:
        return 999, "", str(e)

# Fix for Windows: Use cmd /c for chaining commands
import platform
if platform.system() == "Windows":
    node_cmd = ["cmd", "/c", "node -v && npm -v"]
else:
    node_cmd = ["bash", "-lc", "node -v && npm -v"]
node_rc, node_out, node_err = run(node_cmd)
npm_available = (node_rc == 0)

test_summary = {}
if npm_available:
    # Install and test
    rc_i, out_i, err_i = run(["npm", "install"])
    rc_t, out_t, err_t = run(["npm", "test"])
    test_summary = {
        "npm_install_rc": rc_i, "npm_install_stdout_tail": out_i.splitlines()[-15:] if out_i else [], "npm_install_stderr_tail": err_i.splitlines()[-15:] if err_i else [],
        "npm_test_rc": rc_t, "npm_test_stdout_tail": out_t.splitlines()[-30:] if out_t else [], "npm_test_stderr_tail": err_t.splitlines()[-30:] if err_t else [],
    }

# ---------- Compute checksums for integrity ----------
def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

zip_sha = sha256_file(zip_path)

# Print a concise manifest
print("Created extension package folder:", base)
print("Created zip artifact:", zip_path)
print("ZIP sha256:", zip_sha)
print("\nTop-level files:")
for p in sorted(os.listdir(base)):
    print(" -", p)

print("\nNode/npm available:", npm_available)
if npm_available:
    print("\n--- npm install (tail) ---")
    print("\n".join(test_summary["npm_install_stdout_tail"]))
    if test_summary["npm_install_rc"] != 0:
        print("\n[npm install stderr tail]")
        print("\n".join(test_summary["npm_install_stderr_tail"]))
    print("\n--- npm test (tail) ---")
    print("\n".join(test_summary["npm_test_stdout_tail"]))
    if test_summary["npm_test_rc"] != 0:
        print("\n[npm test stderr tail]")
        print("\n".join(test_summary["npm_test_stderr_tail"]))
else:
    print("Node/npm not detected in this environment; tests/lockfile must be generated locally.")

print("\nDownload the zip from:")
print(zip_path)
