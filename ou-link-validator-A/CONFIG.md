# OU Link Validator - Configuration Guide

## Expanded Selector Strategy (v1.2.2+)

The extension uses 37 CSS selectors to detect valid course page renders across different Oracle MyLearn page structures. If ANY selector matches, the page is considered successfully rendered (RENDER_OK).

### Selector Groups

#### Primary Content Headings (5 selectors)
Matches main page titles and headings:
```
main h1, main h2, main h3
[role="main"] h1, [role="main"] h2
```
**Why**: Course pages typically have semantic heading structure in main element or ARIA role.

#### Course-Specific Data Attributes (5 selectors)
Matches data attributes used by MyLearn for course/learning path elements:
```
[data-testid*="course"]
[data-testid*="learning"]
[data-testid*="path"]
[data-test*="course"]
[data-test*="learning"]
```
**Why**: Modern React/framework-based UIs use data-testid for component identification.

#### Container Classes (9 selectors)
Matches div/section classes that organize course content:
```
[class*="learning-path"]
[class*="course"]
[class*="course-card"]
[class*="course-content"]
[class*="course-title"]
[class*="page-title"]
[class*="page-heading"]
[class*="header"] h1
[class*="page-header"] h1
```
**Why**: CSS class naming is consistent across MyLearn for course containers.

#### Semantic HTML (6 selectors)
Matches structured semantic elements:
```
article h1, article h2, article h3
section h1, section h2
header h1, header h2
```
**Why**: Accessible web design uses semantic tags for course content.

#### Breadcrumb/Metadata (4 selectors)
Matches course navigation/context indicators:
```
[class*="breadcrumb"] a
[class*="course-meta"]
[class*="course-info"]
[attr*="course"]  // Custom attribute patterns
```
**Why**: Breadcrumbs and metadata confirm page context.

#### Content Area Fallbacks (5 selectors)
Matches generic content area patterns:
```
.content h1
.main-content h1
[id*="content"] h1
[id*="main"] h1
[role="article"] h1
```
**Why**: Fallback patterns for non-standard page structures.

#### Role-Based Detection (1 selector)
Matches accessibility role-based regions:
```
[role="region"] h1
```
**Why**: ARIA roles help identify page sections even with non-standard HTML.

---

## Validation Strategy (Multi-Layer Defense)

The extension validates links using THREE independent checks:

### 1. **URL Redirect Detection** (immediate)
```
OFF_HOST_REDIRECT: Final URL left mylearn.oracle.com
AUTH_REDIRECT:    Final URL contains /login, /sso, /oauth, etc.
```
Checked BEFORE injection to avoid unnecessary script execution.

### 2. **Soft-Fail Marker Detection** (text-based)
```
Error indicators in page body text:
- "we couldn't find the resource"
- "retired or obsolete"
- "access denied"
- "you do not have access"
- "not authorized"
- "permission denied"
```
Uses unicode-safe normalization (handles curly quotes, accents, whitespace).

### 3. **Selector Render Detection** (DOM-based)
Waits up to 12 seconds (default timeout) for ANY of 37 selectors to match, indicating page rendered successfully.

---

## Failure Modes Explained

### NO_SELECTOR
- **Meaning**: Page loaded, no error markers detected, but none of 37 selectors matched
- **Causes**: 
  - Page uses completely non-standard HTML not covered by selectors
  - Page content didn't finish rendering within timeout
  - JavaScript failed to execute
- **Solution**: Add custom selector matching your page structure in Settings

### ERROR_TEXT
- **Meaning**: Page contains soft-fail marker text (access denied, resource not found, etc.)
- **Causes**: 
  - Course is archived/removed
  - User lacks access permission
  - Link target was deleted
- **Action**: Link is legitimately broken; cannot be fixed

### AUTH_REDIRECT
- **Meaning**: Final URL contains auth keywords (/login, /sso, /oauth, etc.)
- **Causes**: 
  - User not logged in to MyLearn
  - VPN required but not connected
  - Session expired
- **Action**: Ensure logged in and VPN active; re-check

### OFF_HOST_REDIRECT
- **Meaning**: Final URL left mylearn.oracle.com
- **Causes**:
  - Link is external reference
  - Redirect misconfiguration
- **Action**: Verify link target or policy

### INJECT_ERR
- **Meaning**: Failed to inject validation script into page tab
- **Causes**:
  - Content Security Policy (CSP) blocks scripts
  - Tab became a special page (extension page, about:blank, etc.)
- **Action**: Usually transient; re-check link

### RENDER_OK
- **Meaning**: At least one selector matched after waiting for page render
- **Causes**: Page successfully loaded with expected structure
- **Action**: Link is valid ✓

---

## Custom Selectors

Users can add custom selectors in the Settings panel. Useful for:

1. **Organization-specific page structures**
   ```
   .custom-course-container h2
   ```

2. **Framework-specific data attributes**
   ```
   [data-id*="course-"]
   ```

3. **Proprietary class patterns**
   ```
   .ou-course-title
   [class^="learning"]
   ```

### Adding Custom Selectors
1. Open popup Settings (optional)
2. Edit "Selectors (one per line)" textarea
3. Enter lowercase CSS selectors
4. Run Check Status - custom selectors merged with defaults

**Note**: Custom selectors supplement (not replace) defaults.

---

## Verification Matrix

| State | Detected By | Layer |
|-------|------------|-------|
| PASS (RENDER_OK) | Selector match + no error text | Layer 3 + Layer 2 |
| FAIL (ERROR_TEXT) | Soft-fail marker in text | Layer 2 |
| FAIL (AUTH_REDIRECT) | URL keyword match | Layer 1 |
| FAIL (OFF_HOST_REDIRECT) | Hostname check | Layer 1 |
| FAIL (NO_SELECTOR) | Timeout + no selectors match | Layer 3 timeout |
| FAIL (INJECT_ERR) | Script injection failure | Layer 3 |
| FAIL (BG_ERR) | Background worker exception | Layer 0 |

---

## Configuration in Code

### Timeout
- **Default**: 12000 ms (12 seconds)
- **Min**: 2000 ms
- **Use case**: Increase if pages have slow JavaScript rendering; decrease for faster feedback

### Concurrency
- **Default**: 3 parallel checks
- **Range**: 1-6
- **Use case**: Lower for slow networks; higher for fast networks (balances tab resource usage)

### Debug Flag
Enables verbose logging in Service Worker console for troubleshooting.

---

## Performance Notes

- **Tab lifecycle**: Each URL opens a background tab, waits for navigation, injects probe, collects results, then closes tab automatically
- **Memory**: With concurrency=6, max 6 tabs open simultaneously; closes on completion or popup close
- **Network**: ~1-3 HTTP requests per link check (navigation + resources)
- **CPU**: Selector polling uses 200ms interval (20ms would be too aggressive)

---
