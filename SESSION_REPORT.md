# PawClinics — Session Fix Report
**Date:** 2026-06-22  
**Prepared by:** Claude (AI pair programmer)  
**Project:** PawClinics Clinic Staff Portal (React 19 + TypeScript + Vite)

---

## Part 1 — Frontend Fixes Completed

All items below have been implemented, tested, and committed.

---

### Security Fixes

#### ✅ S-1 / S-2 / S-3 — JWT & permissions in localStorage (Partial — frontend complete, backend pending)

**What was wrong:**  
The full staff object (role, all permission slugs, `isOwner`, email) was stored in `localStorage`. Any user could open DevTools, edit the JSON, and gain admin-level UI access without touching the server.

**What changed:**  
`src/context/ClinicAuthContext.tsx` — On every app load, the frontend now calls `GET /clinic/api/auth/me` with the stored Bearer token. If the server returns the staff object, that server-provided object is used (overriding whatever is in localStorage). If the server returns 404 (endpoint not yet deployed), the app falls back to the cached localStorage value so nothing breaks today.

An `AbortController` was added to the effect so React StrictMode's double-invoke cancels the first in-flight request, preventing race conditions.

`src/services/clinic/clinicApi.ts` — The `get()` method now accepts an optional `{ signal }` parameter (passed from AbortController). Also, 404 responses are no longer logged as `[API Error]` in the browser console — 404 is an expected HTTP status, not a server bug.

**What still needs the backend:** A real `GET /clinic/api/auth/me` endpoint (see Part 2).

---

#### ✅ S-4 — API error logging exposed in production

**What was wrong:**  
`console.error('[API Error]', ...)` fired in production builds, leaking internal API error details to the browser console.

**What changed:**  
`src/services/clinic/clinicApi.ts` — The error log is now wrapped in `if (import.meta.env.DEV && response.status !== 404)`. It only runs in the local dev server and never in the production build.

---

#### ✅ S-5 — No login brute-force protection

**What was wrong:**  
The login form had no rate limiting. An attacker could script unlimited password attempts.

**What changed:**  
`src/pages/Login/Login.tsx` — After 5 consecutive failed login attempts, a 30-second cooldown is enforced in the browser. The submit button is disabled and shows a live countdown (`Try again in 27s`). The `failCount` resets on success.

---

#### ✅ S-6 — No Content Security Policy

**What was wrong:**  
No CSP header or meta tag, so injected scripts or third-party resources could run freely.

**What changed:**  
`index.html` — A `<meta http-equiv="Content-Security-Policy">` tag was added, restricting:
- Scripts to same-origin only
- Styles to same-origin + `unsafe-inline` (required for CSS-in-JS / CSS modules)
- Images to same-origin, `data:`, and `https:`
- Connections to same-origin + Railway backend + Pusher WebSocket domains
- Frames, objects, and base-URI all locked to same-origin or `none`

---

#### ✅ S-7 — Pusher public channels (real-time events unprotected)

**What was done:**  
`src/hooks/useClinicPusher.ts` — Already uses `authEndpoint: '/clinic/api/pusher/auth'` and subscribes to `private-branch-${branchId}` channels. The frontend side is complete.

**What still needs the backend:** The `/clinic/api/pusher/auth` endpoint must be implemented to validate tokens and sign channel auth responses (see Part 2).

---

#### ✅ S-9 — Notification content XSS guard (comment added)

**What was done:**  
`src/components/layout/ClinicSidebar/ClinicSidebar.tsx` — A `{/* Plain text only — do NOT change to dangerouslySetInnerHTML */}` comment was added above the notification title and body renders. React auto-escapes these, so no code change was needed — the comment prevents a future developer from accidentally introducing XSS.

---

### Performance Fixes

#### ✅ P-1 — No code splitting (all pages in one bundle)

**What was wrong:**  
All 16 page components were eagerly imported, making the initial bundle large and slow to parse.

**What changed:**  
`src/App.tsx` — All page imports were converted to `React.lazy()`. A `<Suspense fallback={<PawLoader size="large" overlay />}>` wrapper was added around the route tree so a full-screen loader appears while each page's chunk downloads.

---

#### ✅ P-2 — Full Bootstrap CSS loaded (~230 KB unused)

**What was wrong:**  
`global.css` imported `bootstrap/dist/css/bootstrap.min.css` — the complete prebuilt CSS including tables, modals, buttons, carousels, and dozens of components the app doesn't use.

**What changed:**  
`src/styles/bootstrap-custom.scss` — A selective SCSS entry that imports only what the app actually uses: reboot (normalize), containers, grid, alert, and utilities. The full import was removed from `global.css`. This saves approximately 180 KB of CSS.

---

#### ✅ P-3 / P-4 — No API caching (re-fetches on every navigation)

**What was wrong:**  
The clinic profile was fetched fresh on every sidebar mount/unmount cycle. On mobile, opening the sidebar after closing it triggered a new API call even though the data hadn't changed.

**What changed:**  
`package.json` — `@tanstack/react-query` was installed.  
`src/main.tsx` — A `QueryClient` with `staleTime: 30_000` (30 seconds) was configured and the app wrapped in `QueryClientProvider`.  
`src/components/layout/ClinicSidebar/ClinicSidebar.tsx` — The `useState + useEffect` clinic fetch was replaced with a single `useQuery` call. The same query key (`['clinicProfile', clinicId]`) is shared across all components, so the clinic profile is fetched once and served from cache for 30 seconds regardless of how many times the sidebar remounts.

---

#### ✅ P-5 — Notification polling callback recreated every render

**What was wrong:**  
`loadNotifications` was a plain function defined inside the component, so it was recreated on every render and triggered the `useEffect` polling interval to reset.

**What changed:**  
`src/components/layout/ClinicSidebar/ClinicSidebar.tsx` — `loadNotifications` is now wrapped in `useCallback` with an empty dependency array. The polling interval is stable.

---

#### ✅ P-8 — No memoization on repeated components

**What was wrong:**  
`StatCard` in the dashboard and `DataTable` re-rendered on every parent render even when their props were unchanged (e.g., typing in the search box caused all 3 stat cards to re-render).

**What changed:**  
`src/pages/Dashboard/ClinicDashboard.tsx` — `StatCard` was extracted as a standalone `React.memo` component.  
`src/components/common/DataTable/DataTable.tsx` — Wrapped in `memo`. Generic components can't be passed directly to `memo`, so the inner function was named `DataTableInner` and then re-exported as `const DataTable = memo(DataTableInner) as typeof DataTableInner`.

---

#### ✅ P-9 — Duplicated search/debounce state

**What was wrong:**  
`AppointmentsList` maintained both `search` (live) and `debouncedSearch` (delayed) as separate `useState` values, with a `useEffect` + `setTimeout` to sync them. Every keystroke fired two state updates and one effect.

**What changed:**  
`src/pages/Appointments/AppointmentsList.tsx` — Replaced with `useDeferredValue(search)`. React 18's built-in deferral marks the search-triggered re-render as low priority and batches it naturally. No extra state, no timeout, no cleanup.

---

#### ✅ P-10 — Single loading state blocks the entire dashboard

**What was wrong:**  
One `loading` boolean covered all 4 parallel fetches (clinic info, branches, staff, today's appointments). The full-page skeleton stayed visible until the slowest of the 4 resolved.

**What changed:**  
`src/pages/Dashboard/ClinicDashboard.tsx` — Split into `loadingStats` and `loadingBookings`. The stats section (clinic + branches + staff) shows as soon as those 3 fetches settle. The bookings section shows its own inline skeleton independently until the appointments fetch completes.

---

### UI / Responsiveness Fixes

#### ✅ Mobile stepper on New Appointment page

**What was wrong:**  
On screens ≤ 520 px the step labels ("Branch & Date", "Doctor & Time") wrapped onto multiple lines, compressing all 4 steps into a cramped row.

**What changed:**  
`src/pages/Appointments/CreateAppointment.tsx` — Step labels are wrapped in `<span className={styles.stepLabel}>` (hidden on mobile). A new `<div className={styles.stepperMobileLabel}>` below the stepper shows "Step 2 of 4 — Doctor & Time" in plain text.  
`src/pages/Appointments/Appointments.module.scss` — On ≤ 520 px: the stepper becomes a row of numbered circles connected by a gray horizontal track line drawn via `::before`. Only circle numbers are visible; the text subtitle appears below.

---

#### ✅ Horizontal scroll on all pages in Microsoft Edge

**What was wrong:**  
On smaller screens the entire page could be scrolled horizontally in Edge but not in Chrome.

**Root cause — two separate issues:**

1. **Windows scrollbar width.** Edge on Windows uses the classic system scrollbar (~17 px wide) that physically reduces available horizontal space. Chrome uses overlay scrollbars (0 px wide). When a page has enough vertical content to trigger a scrollbar, Edge loses 17 px of width. Content that was borderline-fitting in Chrome overflowed in Edge. Setting `overflow-x: hidden` only on `body` isn't sufficient because some browsers only honour the body-to-html transfer when `html` has its default `visible` overflow — adding an explicit rule on `html` locks it in every browser.

2. **`float: right` inside `overflow-x: auto`.** The DataTable's scroll-fade gradient indicator (`::after` pseudo-element) used `float: right` combined with `position: sticky`. Chrome defers to `position: sticky` and ignores the float. Edge processes the float first, which adds 40 px to the table's internal scroll width and lets it leak past the container boundary into the page scroll.

**What changed:**  
`src/styles/global.css` — Added `html { overflow-x: hidden }` alongside the existing `body` rule. Belt-and-suspenders: both the root element and the body are locked.  
`src/components/layout/ClinicLayout/ClinicLayout.module.scss` — Added `overflow-x: hidden` to `.layout`. A third containment layer at the app shell level; any child overflow is clipped here before it can reach the document scroll.  
`src/components/common/DataTable/DataTable.module.scss` — Changed the `::after` indicator from `position: sticky; float: right` to `position: absolute; right: 0; top: 0; bottom: 0`. An absolutely-positioned element is entirely out of flow and can never contribute to scroll width in any browser. The visual result (gradient pinned to the right edge of the table as a scroll hint) is identical.

---

### Test Coverage Added

`src/context/ClinicAuthContext.test.tsx` — Full suite: hydration from localStorage, `/auth/me` success, 404 fallback, login success/failure, logout, hook guard outside provider.  
`src/services/clinic/clinicApi.test.ts` — Tests for `get`, `post`, `put`, `patch`, `del`, 401 session clearing, error message extraction, 404 handling.  
`src/services/clinic/clinicAuthService.test.ts` — Tests for login, logout, `getStoredAuth`, token persistence.  
`src/utils/clinicPermissions.test.ts` — Permission checks for owner, role-based, missing role, null staff.  
`src/test/factories.ts` — Shared test helpers: `makeStaff()`, `makeStoredAuth()`, `mockFetchOk()`, `mockFetchError()`.

---

## Part 2 — Backend Tasks Required

The items below cannot be completed on the frontend alone. Share this section with the backend team.

---

### 🔴 CRITICAL — `GET /clinic/api/auth/me`

**Needed for:** Security fixes S-1, S-2, S-3  
**Priority:** High — without this, users can edit localStorage to fake permissions

**What it must do:**
- Read the `Authorization: Bearer <token>` header
- Verify the JWT and identify the staff member
- Return the staff object in the same shape as the login response
- Return `401` if the token is missing, expired, or invalid

**Expected response shape** (must match the existing `ClinicStaff` TypeScript type):
```json
{
  "data": {
    "id": 1,
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@clinic.com",
    "isOwner": false,
    "role": {
      "id": 2,
      "name": "Manager",
      "slug": "manager"
    },
    "permissions": [
      { "id": 1, "name": "View Appointments", "slug": "appointments.read" }
    ],
    "branches": [
      { "id": 10, "clinicId": 5 }
    ]
  }
}
```

**What happens once this is deployed:**  
The frontend already calls this endpoint on every app load. Currently it receives a 404 and falls back to localStorage (safe degradation). Once the endpoint exists and returns 200, the frontend will use the server-provided staff object for all permission checks — localStorage tampering becomes impossible.

---

### 🟠 IMPORTANT — `POST /clinic/api/pusher/auth`

**Needed for:** Security fix S-7 (real-time channel authorization)  
**Priority:** Medium — currently anyone with the Pusher app key can subscribe to clinic events

**Context:**  
The frontend is already configured for private channels (`private-branch-${branchId}`) and sends the auth request to `/clinic/api/pusher/auth`. Pusher calls this endpoint automatically when a client tries to subscribe to a private channel. Without the backend implementation, the subscription silently fails or falls back to public mode.

**What it must do:**
- Accept `Authorization: Bearer <token>` header
- Accept Pusher's auth request body: `{ socket_id, channel_name }`
- Verify that the authenticated staff member belongs to the branch/clinic referenced in `channel_name`
- Call the Pusher server SDK to generate a signed auth response and return it

**Example implementation (Node.js / NestJS):**
```typescript
import Pusher from 'pusher';

const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
});

// POST /clinic/api/pusher/auth
async pusherAuth(req: AuthenticatedRequest, res: Response) {
  const { socket_id, channel_name } = req.body;

  // Optional: verify staff has access to the clinic/branch in channel_name
  // channel_name will be "private-branch-10" — extract "10" and compare to staff.branchId

  const auth = pusherServer.authorizeChannel(socket_id, channel_name);
  res.json(auth);
}
```

---

### 🟡 CONFIGURATION — HSTS Response Header

**Needed for:** Security fix S-8  
**Priority:** Low — HTTPS is already in use; this just enforces it on repeat visits  
**No code change required — deployment configuration only**

Add the following response header to every HTTPS response from the production server (Railway, Nginx, Caddy, or CDN):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This tells browsers to always use HTTPS for this domain for the next year, preventing protocol downgrade attacks on first-time visitors.

**In Railway:** Add a custom response header in the service settings.  
**In Nginx:** Add to the `server {}` block that handles port 443.  
**In Caddy:** Add `header Strict-Transport-Security "max-age=31536000; includeSubDomains"` to the site block.

---

### 🟡 BACKEND CONTRACT — Notification content must be plain text

**Related to:** Security fix S-9  
**No endpoint change needed — data sanitization on write**

The notification `title` and `body` fields are rendered as plain text in React (auto-escaped). However, if the backend stores HTML in these fields, a developer could accidentally switch to `dangerouslySetInnerHTML` in the future and expose an XSS vector.

**Request:** Ensure the API strips or rejects HTML tags in `title` and `body` fields before storing them. A simple HTML-strip on ingest (e.g., using a library like `sanitize-html` with no allowed tags) is sufficient.

---

## Part 3 — Deferred (Not Yet Implemented)

| ID | Description | When to implement |
|----|-------------|-------------------|
| P-6 | DataTable row virtualization (`@tanstack/react-virtual`) | When page sizes exceed ~50 rows |

---

## Summary Table

| ID | Description | Status | Owner |
|----|-------------|--------|-------|
| S-1 | JWT in localStorage | ⚠️ Partial (fallback active) | Backend: deploy `/auth/me` |
| S-2 | Staff object in localStorage | ⚠️ Partial (fallback active) | Backend: deploy `/auth/me` |
| S-3 | Client-side permission tampering | ⚠️ Partial (fallback active) | Backend: deploy `/auth/me` |
| S-4 | API errors logged in production | ✅ Done | — |
| S-5 | No login brute-force protection | ✅ Done | — |
| S-6 | No Content Security Policy | ✅ Done | — |
| S-7 | Pusher public channels | ⚠️ Frontend done | Backend: deploy `/pusher/auth` |
| S-8 | No HSTS header | ⚠️ Pending | Backend/DevOps: add response header |
| S-9 | Notification XSS guard | ✅ Done | Backend: sanitize on write |
| S-10 | autocomplete on password field | ✅ Done (was already present) | — |
| P-1 | No code splitting | ✅ Done | — |
| P-2 | Full Bootstrap loaded | ✅ Done | — |
| P-3/P-4 | No API caching | ✅ Done | — |
| P-5 | Notification callback recreated | ✅ Done | — |
| P-6 | No row virtualization | ⏸️ Deferred | Frontend: when row counts grow |
| P-7 | Multiple sidebar useEffects | ✅ Done | — |
| P-8 | No React.memo on components | ✅ Done | — |
| P-9 | Duplicated debounce state | ✅ Done | — |
| P-10 | Shared loading state | ✅ Done | — |
| — | Mobile stepper collapse | ✅ Done | — |
| — | Page horizontal scroll in Edge | ✅ Done | — |
| — | Test suite (auth, API, permissions) | ✅ Done | — |
