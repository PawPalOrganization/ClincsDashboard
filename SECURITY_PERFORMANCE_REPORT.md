# PawClinics — Security & Performance Report

Generated: 2026-06-21

---

## 1. Test Coverage Summary

| File | Tests |
|------|-------|
| `src/utils/clinicPermissions.test.ts` | 22 tests — permission logic, RBAC, owner bypass, all 22 slugs |
| `src/services/clinic/clinicApi.test.ts` | 25 tests — HTTP methods, auth headers, 401 session expiry, error formats |
| `src/services/clinic/clinicAuthService.test.ts` | 17 tests — login persistence, logout cleanup, corrupted storage |
| `src/context/ClinicAuthContext.test.tsx` | 8 tests — hydration, login/logout state transitions, hook guard |
| **Total** | **72 tests passing** |

**Run:** `npm test` | **Watch:** `npm run test:watch` | **Coverage:** `npm run test:coverage`

---

## 2. Security Issues

### 🔴 CRITICAL

#### S-1: JWT stored in `localStorage` — XSS attack surface
**File:** `src/services/clinic/clinicApi.ts:26`, `clinicAuthService.ts:42`

```ts
localStorage.setItem(TOKEN_KEY, token); // ← readable by any JS on the page
```

Any XSS vulnerability anywhere on the page (injected ad script, third-party CDN compromise, etc.) can read `clinicStaffToken` and make authenticated API calls on behalf of the user.

**Recommendation:** Move the token to an **httpOnly cookie** set by the backend on login response. The browser sends httpOnly cookies automatically on same-origin requests but JavaScript cannot read them. Pair with `SameSite=Strict` to block CSRF.

---

#### S-2: Full staff object (including permissions) stored in `localStorage`
**File:** `clinicAuthService.ts:43`

```ts
localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
```

The entire `ClinicStaff` object — including role name, all permissions, email — is persisted in plaintext in localStorage. An XSS attack or a malicious browser extension can read and exfiltrate this.

**Recommendation:** Store only the minimum needed for display (e.g., `{ firstName, lastName }`). Re-fetch full staff profile from a `/me` endpoint on app load instead of trusting localStorage for permissions.

---

#### S-3: Permission data trusted from `localStorage` without server validation
**File:** `clinicPermissions.ts`, `ClinicAuthContext.tsx:48`

```ts
const staff = JSON.parse(staffRaw) as ClinicStaff; // from localStorage
// ... later used to gate UI and feature access
```

A user can open DevTools, edit `clinicStaff` in localStorage, add `"isOwner": true` or inject a permission slug, and unlock restricted UI sections. The *API* still validates on the server, so actual data cannot be read/written — but restricted **UI routes and features become visible**.

**Recommendation:** Always fetch the `/me` or `/profile` endpoint on app load and use only the server response for permission checks. Do not trust localStorage for authorization decisions.

---

### 🟠 HIGH

#### S-4: API errors logged to browser console in production
**File:** `clinicApi.ts:103`

```ts
console.error('[API Error]', response.status, JSON.stringify(body));
```

This logs the full API response body to the browser console in production builds. Error responses may contain internal database error messages, stack traces, or field names that help an attacker fingerprint the backend.

**Recommendation:** Remove this `console.error` or guard it behind a `import.meta.env.DEV` check.

---

#### S-5: No login rate limiting on the frontend
**File:** `src/pages/Login/Login.tsx` (login form)

The login form has no client-side throttle on submission. An attacker can programmatically call the login endpoint at full network speed. While the backend should enforce rate limits, defence-in-depth means the frontend should also slow repeated attempts.

**Recommendation:** Disable the submit button for 1–2 seconds after each failed attempt. After 5 failures, add a 30-second cooldown and optionally show a CAPTCHA.

---

#### S-6: No Content Security Policy (CSP) headers
**File:** `index.html`, `vite.config.ts`

No `Content-Security-Policy` meta tag or HTTP header is configured. Without a CSP, any injected `<script>` tag will execute.

**Recommendation:** Add a strict CSP via `vite-plugin-html` or configure headers in the deployment proxy/server:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://backend-production-12d0.up.railway.app wss://*.pusher.com https://*.pusher.com; style-src 'self' 'unsafe-inline';
```

---

#### S-7: Pusher app key exposed in client bundle
**File:** `src/hooks/useClinicPusher.ts`

The Pusher application key is embedded in the frontend JavaScript bundle. Anyone can view the minified source and extract it.

**Recommendation:** This is unavoidable for Pusher's architecture (public key is by design), but ensure:
1. Pusher **private** or **presence** channels are used (they require server-side auth via `/pusher/auth`).
2. The backend validates the authenticated user before authorizing the channel subscription.
3. Pusher **channel restrictions** are configured in the Pusher dashboard.

---

### 🟡 MEDIUM

#### S-8: No HTTPS enforcement in dev proxy
**File:** `vite.config.ts:9`

The dev proxy forwards to `https://...` (correct), but local dev runs over plain HTTP. Ensure staging/production deployments enforce HTTPS via HSTS headers.

---

#### S-9: Notification data rendered without sanitization
**File:** `ClinicSidebar.tsx` — notification title and body

```tsx
<div className={styles.notifTitle}>{n.title}</div>
<div className={styles.notifBody}>{n.body}</div>
```

React auto-escapes string values, so this is safe **as long as `n.title`/`n.body` are strings**. If the backend ever returns HTML-formatted notifications and the rendering is changed to `dangerouslySetInnerHTML`, this becomes an XSS vector.

**Recommendation:** Document that notification content must remain plain text. Add a backend contract test.

---

#### S-10: Missing `autocomplete="off"` on password field
Browsers and password managers autofill credentials on shared/public devices.

**Recommendation:** Add `autoComplete="current-password"` on the password field (which opts in to secure password-manager handling, better than `off`).

---

## 3. Performance Issues

### 🔴 CRITICAL

#### P-1: No code splitting — entire app in one bundle
**File:** `src/App.tsx` (route configuration)

All pages are imported statically. On first load the browser must download, parse, and execute the entire app — including pages the user may never visit (e.g., Settings, Branch creation forms).

**Impact:** Large Time-to-Interactive (TTI), especially on mobile/slow connections.

**Recommendation:**
```tsx
// Before
import ClinicDashboard from './pages/Dashboard/ClinicDashboard';

// After
const ClinicDashboard = lazy(() => import('./pages/Dashboard/ClinicDashboard'));
// Wrap routes in <Suspense fallback={<PageSkeleton />}>
```

Estimated bundle reduction: **40–60%** of initial chunk.

---

#### P-2: Full Bootstrap CSS loaded — ~230 KB unused
**File:** `src/styles/global.css:1`

```css
@import 'bootstrap/dist/css/bootstrap.min.css';
```

The full Bootstrap stylesheet is ~230 KB minified. The app uses very few Bootstrap utilities (mostly grid classes and alerts).

**Recommendation:** Switch to Bootstrap's Sass source and import only the modules needed:
```scss
@import 'bootstrap/scss/functions';
@import 'bootstrap/scss/variables';
@import 'bootstrap/scss/grid';
@import 'bootstrap/scss/utilities/api';
@import 'bootstrap/scss/alert';
```

Estimated CSS reduction: **~180 KB**.

---

### 🟠 HIGH

#### P-3: No API response caching — same data re-fetched on every navigation
**File:** All service files

Every page navigation triggers a fresh API call even for near-static data (clinic info, branches list, staff roles). The dashboard fetches branches and clinic info on every mount; the sidebar fetches clinic profile on every mount.

**Recommendation:** Add a lightweight in-memory cache for short-lived data:
```ts
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000; // 30 seconds

async function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data as T;
  const data = await fetcher();
  cache.set(key, { data, ts: Date.now() });
  return data;
}
```

---

#### P-4: `ClinicSidebar` fetches clinic profile on every mount
**File:** `ClinicSidebar.tsx:124`

```ts
useEffect(() => {
  clinicProfileService.get(clinicId).then(setClinic).catch(() => {});
}, [clinicId]);
```

The sidebar unmounts and remounts on mobile (when toggled), causing a new API call each time. On desktop the sidebar persists, but if clinicId changes (unlikely) it re-fetches.

**Recommendation:** Lift clinic profile into the `ClinicAuthContext` or a shared React Query / SWR cache.

---

#### P-5: Notification polling — new interval registered on every render if not memoized
**File:** `ClinicSidebar.tsx:80`

```ts
useEffect(() => {
  loadNotifications();
  const interval = setInterval(loadNotifications, 60_000);
  return () => clearInterval(interval);
}, []); // ← empty deps array is correct, but loadNotifications is recreated each render
```

`loadNotifications` is defined inside the component and recreated on every render, but because the `useEffect` dep array is `[]`, the stale closure is captured. Notifications API calls always use the initial state setters — this is safe with React's stable `setState` identity, but conceptually fragile.

**Recommendation:** Move `loadNotifications` to `useCallback` or extract it from the component body.

---

#### P-6: DataTable has no row virtualization
**File:** `src/components/common/DataTable/DataTable.tsx`

All rows are rendered to the DOM simultaneously. With `LIMIT = 10` per page this is fine, but if limits are increased or bulk views are added, DOM size will hurt scroll performance.

**Recommendation:** For paginated tables this is acceptable. If a "show all" mode is ever added, use `@tanstack/react-virtual`.

---

### 🟡 MEDIUM

#### P-7: Three separate `useEffect` hooks in sidebar for one data source
**File:** `ClinicSidebar.tsx:124–140`

```ts
useEffect(() => { fetchClinic(); }, [clinicId]);
useEffect(() => { document.title = ...; }, [clinic?.title]);
useEffect(() => { updateFavicon(); }, [clinic?.logoUrl]);
```

Three effects all driven by the same data. The second and third fire after the first resolves, causing two extra render cycles after the network response.

**Recommendation:** Combine into one effect:
```ts
useEffect(() => {
  if (!clinicId) return;
  clinicProfileService.get(clinicId).then((c) => {
    setClinic(c);
    document.title = c.title ? `${c.title} | PawPal` : 'PawPal Clinics';
  }).catch(() => {});
}, [clinicId]);
```

---

#### P-8: Missing `React.memo` on high-frequency list-item components
**File:** `DataTable.tsx`, `ClinicDashboard.tsx`

Row renderers and stat cards re-render whenever the parent re-renders (e.g., on filter input change), even if their props haven't changed.

**Recommendation:** Wrap stable presentational components in `React.memo()`:
```tsx
const StatCard = React.memo(function StatCard({ ... }) { ... });
```

---

#### P-9: `appointmentsList` search debounce is 300ms — acceptable, but filter state is duplicated
**File:** `AppointmentsList.tsx:69–85`

`search` and `debouncedSearch` are separate state items. Every keystroke triggers two state updates. This is a minor, accepted pattern but worth noting.

---

#### P-10: No loading-state coordination between parallel dashboard fetches
**File:** `ClinicDashboard.tsx — load()`

`Promise.allSettled` is used (correct), but a single `loading` state is shared across all 4 fetches. If one fetch is slow (e.g., appointments endpoint), the entire skeleton is shown until all 4 resolve.

**Recommendation:** Add per-section loading states so fast sections (branches count) display immediately while slower ones (appointments) show inline skeletons.

---

## 4. Summary Table

| ID | Severity | Category | Short Description |
|----|----------|----------|-------------------|
| S-1 | 🔴 Critical | Security | JWT in localStorage — XSS theft risk |
| S-2 | 🔴 Critical | Security | Full staff object with permissions in localStorage |
| S-3 | 🔴 Critical | Security | Permissions trusted from client-side storage |
| S-4 | 🟠 High | Security | API errors logged to console in production |
| S-5 | 🟠 High | Security | No login rate limiting |
| S-6 | 🟠 High | Security | No Content Security Policy |
| S-7 | 🟠 High | Security | Pusher key exposed (mitigate with private channels) |
| S-8 | 🟡 Medium | Security | No HTTPS enforcement check |
| S-9 | 🟡 Medium | Security | Notification HTML could become XSS vector |
| S-10 | 🟡 Medium | Security | Missing autocomplete attribute on password field |
| P-1 | 🔴 Critical | Performance | No code splitting — full app in initial bundle |
| P-2 | 🔴 Critical | Performance | Full Bootstrap CSS (230 KB) loaded unused |
| P-3 | 🟠 High | Performance | No API caching — same data re-fetched on every nav |
| P-4 | 🟠 High | Performance | Sidebar re-fetches clinic profile on every mobile toggle |
| P-5 | 🟠 High | Performance | Notification polling with stale closure risk |
| P-6 | 🟠 High | Performance | DataTable: no virtualization (acceptable at current page size) |
| P-7 | 🟡 Medium | Performance | 3 separate effects for same data source in sidebar |
| P-8 | 🟡 Medium | Performance | No React.memo on list-item components |
| P-9 | 🟡 Medium | Performance | Duplicated search/debounced state |
| P-10 | 🟡 Medium | Performance | Shared loading state blocks fast sections in dashboard |

---

## 5. Recommended Priority Order

1. **S-1 + S-2 + S-3** (Critical security triad) — Move auth to httpOnly cookies and refetch `/me` on load
2. **P-1** — Add `React.lazy()` to all page-level routes
3. **P-2** — Import only used Bootstrap modules
4. **S-4** — Remove production `console.error` in clinicApi
5. **S-6** — Add CSP headers
6. **P-3 + P-4** — Add API caching layer (React Query or SWR recommended)
7. **S-5** — Frontend login rate limiting

---

*This report was generated by static analysis and code review. Dynamic testing (penetration testing, load testing with k6/Artillery) should be performed separately for production readiness.*
