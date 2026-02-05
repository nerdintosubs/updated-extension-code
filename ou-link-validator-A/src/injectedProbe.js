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
    const esc = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp((cfg.BAD_URL_PARTS || []).map(esc).join("|"), "i");
  })();

  // Normalize unicode punctuation + text for matching (shared logic)
  function normalizePunctuation(s) {
    return String(s || "")
      .replace(/[\u2018\u2019\u02BC\uFF07]/g, "'")  // apostrophes
      .replace(/[\u201C\u201D\u2033]/g, '"')        // quotes
      .replace(/[\u2013\u2014]/g, "-");              // dashes
  }
  function normalizeText(input) {
    const raw = normalizePunctuation(String(input || ""));
    const nfkd = raw.normalize("NFKD");
    const noMarks = nfkd.replace(/[\u0300-\u036f]/g, "");
    return noMarks.toLowerCase().replace(/\s+/g, " ").trim();
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

  // Attempt to read visible text from same-origin iframes (if any).
  function readSameOriginIframesTextSafe() {
    const chunks = [];
    const iframes = Array.from(document.querySelectorAll("iframe"));
    for (const f of iframes) {
      try {
        const doc = f.contentDocument || f.contentWindow?.document;
        if (doc && doc.body) {
          chunks.push(String(doc.body.innerText || ""));
        }
      } catch { /* cross-origin; ignore */ }
    }
    return chunks.join("\n\n");
  }

  // Heuristic: a short grace period before declaring PASS when we first see
  // strong course selectors. This avoids premature PASS while the shell loads
  // and a later soft-fail message appears (common in SPAs).
  const passGraceMs = (() => {
    const t = Number(cfg.TIMEOUT_MS || 12000);
    // 20% of timeout, clamped to [1000, 3000]
    return Math.max(1000, Math.min(3000, Math.floor(t * 0.2)));
  })();
  let strongSeenAt = null;

  // Poll for both error text and selector presence for the full timeout window.
  return (async () => {
    const start = Date.now();
    const pollIntervalMs = 200;
    let sawFallback = false; // saw generic structural selector(s)

    while (true) {
      // 1) Check for soft-fail text anywhere in body or same-origin iframes
      const bodyText = document.body ? (document.body.innerText || "") : "";
      const framesText = readSameOriginIframesTextSafe();
      const combinedText = bodyText + (framesText ? ("\n\n" + framesText) : "");
      const err = findSoftFailMarkerInText(bodyText);
      if (err) {
        return { ok: false, why: "ERROR_TEXT", mark: err, selector: null, fin: finalUrl };
      }
      // Also check within iframes
      const errFrame = framesText ? findSoftFailMarkerInText(combinedText) : null;
      if (errFrame) {
        return { ok: false, why: "ERROR_TEXT", mark: errFrame, selector: null, fin: finalUrl };
      }

      // 1b) Targeted check within main content container for localized or
      // structured messages that might not hit body immediately.
      const mainEl = document.querySelector('main, [role="main"], #main, .main-content');
      if (mainEl) {
        const mainText = String(mainEl.innerText || "");
        const mErr = findSoftFailMarkerInText(mainText);
        if (mErr) {
          return { ok: false, why: "ERROR_TEXT", mark: mErr, selector: "main|[role=main]", fin: finalUrl };
        }
        // Heuristic for common CTAs on error pages (e.g., "Go home")
        const goCtas = Array.from(mainEl.querySelectorAll('a,button'))
          .map(el => normalizeText(el.textContent || ""))
          .filter(t => t.length)
          .some(t => t.includes("go home"));
        if (goCtas) {
          // Only treat as error if no strong content is present below.
          // Acts as an additional hint that we're on an error/empty state page.
          sawFallback = true;
        }
      }

      // 2) Prefer strong signals of actual course content first
      const strong = querySelectors(cfg.STRONG_SELECTORS || []);
      if (strong) {
        const selTextNorm = normalizeText(strong.text || "");
        for (const m of markers) {
          if (m.norm && selTextNorm.includes(m.norm)) {
            return { ok: false, why: "ERROR_TEXT", mark: strong.text, selector: strong.selector, fin: finalUrl };
          }
        }
        // Defer PASS briefly to avoid premature success before error renders.
        if (strongSeenAt == null) {
          strongSeenAt = Date.now();
        }
        if (Date.now() - strongSeenAt >= passGraceMs) {
          return { ok: true, why: "HAS_COURSE_ELEMENTS", mark: strong.text, selector: strong.selector, fin: finalUrl };
        }
        // Not enough time elapsed; continue polling
      }

      // 3) Check fallback structural selectors; record that the page rendered structurally
      const fallback = querySelectors(cfg.SELECTORS || []);
      if (fallback) {
        sawFallback = true;
        const selTextNorm = normalizeText(fallback.text || "");
        for (const m of markers) {
          if (m.norm && selTextNorm.includes(m.norm)) {
            return { ok: false, why: "ERROR_TEXT", mark: fallback.text, selector: fallback.selector, fin: finalUrl };
          }
        }
        // Do not return PASS yet; wait for strong evidence of course content.
      }

      // Timeout check
      if (Date.now() - start > (cfg.TIMEOUT_MS || 12000)) {
        if (sawFallback) {
          return { ok: false, why: "NO_COURSE_CONTENT", mark: null, selector: null, fin: finalUrl };
        }
        return { ok: false, why: "NO_SELECTOR", mark: null, selector: null, fin: finalUrl };
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  })();
}
