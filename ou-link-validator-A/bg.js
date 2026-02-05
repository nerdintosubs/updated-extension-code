import { injectedProbe } from "./src/injectedProbe.js";
import { normalizeUrl, isOffHost, includesBadAuthPart } from "./src/url.js";

// MV3 background service worker for render-based validation
const CONFIG = {
  HOST: "mylearn.oracle.com",
  BAD_URL_PARTS: ["/login", "/signin", "/sign-in", "/sso", "/oauth", "/auth", "idp", "saml"],
  SOFT_FAIL_MARKERS: [
    // MyLearn soft-404 / empty-state messages (short + full phrases)
    "we couldn't find the resource",
    "we couldn't find the resource you're looking for",
    "we couldnt find the resource", // small variant (missing apostrophe)
    "retired or obsolete",
    "the course you're looking for may already be retired or obsolete",
    "access denied",
    "you do not have access",
    "not authorized",
    "permission denied"
  ],
  // Strong indicators that actual course/learning content is present.
  STRONG_SELECTORS: [
    // Data/test attributes commonly used in MyLearn UI components
    '[data-testid*="course"]',
    '[data-testid*="learning"]',
    '[data-testid*="module"]',
    '[data-testid*="lesson"]',
    '[data-test*="course"]',
    '[data-test*="learning"]',
    '[data-test*="module"]',
    '[data-test*="lesson"]',

    // Lists and items
    '[class*="course-card"]',
    '[class*="course-list"]',
    '[class*="course-item"]',
    '[class*="learning-path"]',
    '[class*="module"]',
    '[class*="lesson"]',
    '[class*="content-item"]',
    '[class*="curriculum"]',
    '[class*="outline"]',

    // Roles/labels
    '[role="list"] [class*="course"]',
    '[aria-label*="course" i]',
    '[aria-label*="learning" i]'
  ],
  // Expanded selectors for better course page detection (Oracle MyLearn)
  // Matches various course/learning path/content page patterns:
  // - Main content h1/h2/h3 headings
  // - Data-testid/data-test attributes for courses/learning-paths
  // - Class-based selectors for course containers
  // - Role-based selectors for accessibility
  // - Breadcrumb/meta/card patterns
  SELECTORS: [
    // Primary: main content headings
    "main h1",
    "main h2",
    "main h3",
    "[role=\"main\"] h1",
    "[role=\"main\"] h2",

    // Course-specific data attributes
    "[data-testid*=\"course\"]",
    "[data-testid*=\"learning\"]",
    "[data-testid*=\"path\"]",
    "[data-test*=\"course\"]",
    "[data-test*=\"learning\"]",

    // Learning path and course container classes
    "[class*=\"learning-path\"]",
    "[class*=\"course\"]",
    "[class*=\"course-card\"]",
    "[class*=\"course-content\"]",
    "[class*=\"course-title\"]",
    "[class*=\"page-title\"]",
    "[class*=\"page-heading\"]",

    // Article and semantic section headings
    "article h1",
    "article h2",
    "article h3",
    "section h1",
    "section h2",

    // Header/page structure
    "header h1",
    "header h2",
    "[class*=\"header\"] h1",
    "[class*=\"page-header\"] h1",

    // Breadcrumb/metadata patterns (course context indicators)
    "[class*=\"breadcrumb\"] a",
    "[class*=\"course-meta\"]",
    "[class*=\"course-info\"]",
    "[attr*=\"course\"]",

    // Content area selectors (fallback patterns)
    ".content h1",
    ".main-content h1",
    "[id*=\"content\"] h1",
    "[id*=\"main\"] h1",

    // Role-based content detection
    "[role=\"article\"] h1",
    "[role=\"region\"] h1"
  ],
  TIMEOUT_MS: 12000,
  DEBUG: false
};

function logDebug(cfg, ...args) {
  if (cfg?.DEBUG) console.debug("[OU Link Validator]", ...args);
}

/**
 * Wait for main-frame navigation to complete or error.
 * Robust cleanup: removes all listeners on success, error, or timeout.
 * Scope to frameId === 0 (main frame only).
 */
function waitForNavigationComplete(tabId, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;

      // Clean up all listeners - critical to prevent leaks
      try { chrome.webNavigation.onCompleted.removeListener(onComplete); } catch { }
      try { chrome.webNavigation.onErrorOccurred.removeListener(onError); } catch { }
      try { chrome.tabs.onRemoved.removeListener(onRemoved); } catch { }
      clearTimeout(timer);

      resolve();
    };

    // Main frame navigation completed successfully
    const onComplete = (details) => {
      if (details.tabId === tabId && details.frameId === 0) finish();
    };

    // Main frame navigation failed
    const onError = (details) => {
      if (details.tabId === tabId && details.frameId === 0) finish();
    };

    // Tab was closed/removed (cleanup case)
    const onRemoved = (id) => {
      if (id === tabId) finish();
    };

    chrome.webNavigation.onCompleted.addListener(onComplete);
    chrome.webNavigation.onErrorOccurred.addListener(onError);
    chrome.tabs.onRemoved.addListener(onRemoved);

    const timer = setTimeout(finish, timeoutMs);
  });
}

/**
 * Safe port message send - wrapped to prevent errors when port disconnects.
 */
function safePost(port, msg) {
  try { port.postMessage(msg); } catch { }
}

/**
 * Check for URL redirects and return appropriate error response.
 */
function checkUrlRedirects(finalUrl, config) {
  const offHost = isOffHost(finalUrl, config.HOST);
  const badAuth = includesBadAuthPart(finalUrl, config.BAD_URL_PARTS);

  if (offHost) return { ok: false, why: "OFF_HOST_REDIRECT", fin: finalUrl };
  if (badAuth) return { ok: false, why: "AUTH_REDIRECT", fin: finalUrl };
  return null;
}

/**
 * Safely remove a tab with retry logic.
 */
async function safeRemoveTab(tabId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await chrome.tabs.remove(tabId);
      return;
    } catch (error) {
      if (i === retries - 1) logDebug({ DEBUG: true }, `Failed to remove tab ${tabId} after ${retries} attempts:`, error);
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}

/**
 * Rate limiter to prevent abuse of concurrent validations.
 */
class RateLimiter {
  constructor(maxConcurrent = 6) {
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
  }

  async acquire() {
    if (this.active >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.active++;
  }

  release() {
    this.active--;
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve();
    }
  }
}

const rateLimiter = new RateLimiter();

// Per-connection (popup session) state
const portState = new Map(); // port -> {queue:[], active:number, concurrency:number, cfg:CONFIG, openTabs:Set<number>}

async function processJob(job, port, effCfg) {
  const at = new Date().toISOString();
  let tabId = null;

  try {
    // Acquire rate limiter to prevent abuse
    await rateLimiter.acquire();

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
    } catch { }

    const redirectCheck = checkUrlRedirects(finalUrl, effCfg);
    logDebug(effCfg, "navigate", { orig: job.orig, norm: job.norm, finalUrl, redirect: redirectCheck });

    let payload;
    if (redirectCheck) {
      payload = redirectCheck;
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
    safePost(port, {
      type: "progress", result: {
        url: job.orig, fin: null, ok: false, why: "BG_ERR", mark: String(e), selector: "", at
      }
    });
  } finally {
    if (tabId != null) {
      await safeRemoveTab(tabId);
      const state = portState.get(port);
      if (state) state.openTabs.delete(tabId);
    }
    // Release rate limiter
    rateLimiter.release();
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
      for (const id of st.openTabs) { try { chrome.tabs.remove(id); } catch { } }
    }
  });
});

// Provide defaults to popup (single source of truth from background)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "getDefaults") {
    sendResponse({
      selectors: CONFIG.SELECTORS,
      strongSelectors: CONFIG.STRONG_SELECTORS,
      timeoutMs: CONFIG.TIMEOUT_MS,
      concurrency: 3,
    });
  }
});
