# PawClinics — Remaining Fixes

Picks up from the session on 2026-06-21. Items below were identified in `SECURITY_PERFORMANCE_REPORT.md`
but not yet implemented.

## Already Done (do not re-implement)

| ID | Fix |
|----|-----|
| S-4 | `console.error` in clinicApi guarded behind `import.meta.env.DEV` |
| S-5 | Login rate limiting — 5 failures → 30 s cooldown with live countdown |
| S-6 | Content Security Policy `<meta>` tag added to `index.html` |
| S-10 | `autoComplete="current-password"` already present on password field |
| P-1 | `React.lazy()` + `<Suspense>` code splitting on all 16 page routes |
| P-2 | Selective Bootstrap SCSS imports — removed ~44 KB of unused component CSS |
| P-5 | Notification polling `loadNotifications` wrapped in `useCallback` |
| P-7 | 3 separate sidebar `useEffect`s merged into one (fetch + title + favicon) |
| Bonus | `PawLoader` overlay now uses `createPortal` → always centered on viewport |
| Bonus | `PawLoader` overlay uses `backdrop-filter: blur(6px)` instead of solid white |

---

## Remaining Security Fixes

### 🔴 S-1 + S-2 + S-3 — Auth token & permissions stored in localStorage (Critical triad)

**The problem (all three are the same root cause):**

- `clinicAuthService.ts` stores the JWT in `localStorage.clinicStaffToken` — any XSS on the page can steal it.
- The full `ClinicStaff` object (role, all permission slugs, email) is stored in `localStorage.clinicStaff`.
- `ClinicAuthContext.tsx` reads permissions from that localStorage JSON — a user can open DevTools, edit the JSON to add `"isOwner": true`, and unlock restricted UI sections without making any API calls.

**What needs to happen on the backend first:**

The backend needs to expose a `GET /clinic/api/me` (or `/clinic/api/auth/me`) endpoint that:
- Reads the Bearer token from the `Authorization` header.
- Returns the authenticated staff object (same shape as what `login` returns in `staff`).
- Returns 401 if the token is invalid/expired.

Once that endpoint exists, the frontend fix is:

**Frontend fix — `src/context/ClinicAuthContext.tsx`:**

```tsx
// On mount, instead of trusting localStorage for the staff object:
useEffect(() => {
  const stored = clinicAuthService.getStoredAuth();
  if (!stored) { setIsLoading(false); return; }

  // Validate token + get fresh staff object from server
  clinicApi.get<ApiResponse<ClinicStaff>>('/auth/me')
    .then((res) => {
      setAuth({ ...stored, staff: res.data }); // use server-provided staff, not localStorage
    })
    .catch(() => {
      clinicAuthService.logout(); // token rejected — clear session
    })
    .finally(() => setIsLoading(false));
}, []);
```

**Frontend fix — `src/services/clinic/clinicAuthService.ts`:**

Store only the token + IDs in localStorage, NOT the full staff object:
```ts
localStorage.setItem(TOKEN_KEY,     token);
localStorage.setItem(CLINIC_ID_KEY, clinicId);
localStorage.setItem(BRANCH_ID_KEY, branchId);
// Remove: localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
```

The staff object then comes only from the `/me` call on app load — never from localStorage. This eliminates both the exfiltration risk (S-2) and the client-side permission tampering risk (S-3).

**Note:** Moving the token to an httpOnly cookie (ideal for S-1) requires the backend to set `Set-Cookie` on login response. Coordinate with backend team. If not feasible, S-2/S-3 can be fixed independently without touching token storage.

---

### 🟠 S-7 — Pusher channel authorization missing

**File:** `src/hooks/useClinicPusher.ts`

**The problem:** The Pusher app key is in the bundle (unavoidable by design), but if the app is using public channels, anyone with the key can subscribe and receive all events.

**Fix:** Use private or presence channels which require server-side authorization.

In `useClinicPusher.ts`, when creating the Pusher instance, add the auth endpoint:
```ts
const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  authEndpoint: '/clinic/api/pusher/auth', // backend must implement this
  auth: {
    headers: { Authorization: `Bearer ${token}` },
  },
});
```

Then change channel subscriptions from:
```ts
pusher.subscribe(`clinic-${clinicId}`)       // public channel
```
to:
```ts
pusher.subscribe(`private-clinic-${clinicId}`) // private channel — requires auth
```

The backend `/pusher/auth` endpoint validates the token and authorizes the subscription. Without this, any third party can subscribe to your clinic's real-time events.

---

### 🟡 S-8 — HSTS header not enforced

**Not a code change — deployment configuration.**

Ensure the production server (Railway, Nginx, or CDN) sends:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This forces browsers to always use HTTPS for your domain after the first visit, preventing protocol downgrade attacks. Add it to your Railway service's response headers or the reverse proxy config.

---

### 🟡 S-9 — Notification content must stay plain text

**File:** `src/components/layout/ClinicSidebar/ClinicSidebar.tsx:247–248`

```tsx
<div className={styles.notifTitle}>{n.title}</div>
<div className={styles.notifBody}>{n.body}</div>
```

React auto-escapes these — safe as-is. The risk is a future developer changing these to `dangerouslySetInnerHTML`. No code change needed now, but:

**Action:** Add a comment above those lines:
```tsx
{/* Plain text only — do NOT change to dangerouslySetInnerHTML */}
<div className={styles.notifTitle}>{n.title}</div>
<div className={styles.notifBody}>{n.body}</div>
```

And add a backend contract test ensuring `title` and `body` fields are always stripped of HTML before being stored.

---

## Remaining Performance Fixes

### 🟠 P-3 + P-4 — No API caching (re-fetches on every navigation)

**The problem:**
- Every page navigation re-fetches the same clinic info, branches list, staff roles, etc.
- `ClinicSidebar` fetches the clinic profile on every mobile open/close (unmount/remount cycle).

**Recommended approach — install React Query (TanStack Query):**

```bash
npm install @tanstack/react-query
```

**`src/main.tsx`:**
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } }, // data fresh for 30 s
});

// Wrap <App /> in <QueryClientProvider client={queryClient}>
```

**Usage example — replace the clinic profile fetch in `ClinicSidebar.tsx`:**
```tsx
import { useQuery } from '@tanstack/react-query';

const { data: clinic } = useQuery({
  queryKey: ['clinicProfile', clinicId],
  queryFn: () => clinicProfileService.get(clinicId!),
  enabled: !!clinicId,
  staleTime: 60_000,
});
```

The same `queryKey` across all components means the clinic profile is fetched once and shared — even when the sidebar remounts on mobile. Apply the same pattern to branches, staff roles, and any other near-static data.

**If React Query is too heavy:** A lightweight alternative is in `SECURITY_PERFORMANCE_REPORT.md` under P-3 — a simple `Map`-based in-memory cache with a 30 s TTL.

---

### 🟠 P-6 — DataTable: no row virtualization

**File:** `src/components/common/DataTable/DataTable.tsx`

**Current state:** All rows render to DOM simultaneously. Fine at `limit=10`, but if a "show all" mode or a higher page size is ever added, scrolling will degrade.

**Fix (only needed if limits increase):**
```bash
npm install @tanstack/react-virtual
```

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 56, // estimated row height in px
});
```

**Hold off on this until page sizes exceed ~50 rows.**

---

### 🟡 P-8 — No React.memo on repeated components

**Files:** `src/components/common/DataTable/DataTable.tsx`, `src/pages/Dashboard/ClinicDashboard.tsx`

Row renderers and stat cards re-render when the parent re-renders (e.g., on search input change), even if their own props haven't changed.

**Fix — wrap stable presentational components:**
```tsx
// In ClinicDashboard.tsx — extract stat card to its own memoized component
const StatCard = React.memo(function StatCard({
  icon, background, color, value, label, error,
}: StatCardProps) {
  return ( /* existing JSX */ );
});
```

```tsx
// In DataTable.tsx — memoize the row renderer if passed as a prop
// Callers should also wrap their column render functions in useCallback
```

---

### 🟡 P-9 — Duplicated search/debounced search state in AppointmentsList

**File:** `src/pages/Appointments/AppointmentsList.tsx:69–85`

Two state items (`search` + `debouncedSearch`) exist for one logical value. Every keystroke triggers two `setState` calls.

**Fix — use a single ref + debounced state:**
```tsx
import { useDeferredValue } from 'react';

const [search, setSearch] = useState('');
const debouncedSearch = useDeferredValue(search); // React 18 built-in, no extra state
```

`useDeferredValue` defers the re-render triggered by `debouncedSearch` to low priority, achieving the same effect as manual debouncing with zero extra state.

---

### 🟡 P-10 — Shared loading state blocks fast dashboard sections

**File:** `src/pages/Dashboard/ClinicDashboard.tsx — load()`

A single `loading` boolean covers all 4 parallel fetches (clinic info, branches, staff, appointments). The skeleton persists until the slowest fetch resolves.

**Fix — per-section loading states:**
```tsx
const [loadingStats, setLoadingStats]       = useState(true);
const [loadingBookings, setLoadingBookings] = useState(true);

// In load():
Promise.all([clinicPromise, branchesPromise, staffPromise]).then(() => {
  setLoadingStats(false);
});
appointmentsPromise.then(() => {
  setLoadingBookings(false);
});
```

Stat cards (clinic, branches, staff) appear as soon as their 3 fetches resolve, while the bookings list shows its own inline skeleton independently.

---

## Implementation Order for Next Session

1. **S-1 + S-2 + S-3** — Coordinate with backend on `/me` endpoint, then update `ClinicAuthContext` + `clinicAuthService`
2. **P-3 + P-4** — Install React Query, add `QueryClientProvider`, migrate sidebar + dashboard fetches
3. **P-10** — Split loading state in dashboard (quick, 30 min)
4. **P-8** — React.memo on StatCard and DataTable rows (quick, 1 hour)
5. **S-7** — Pusher private channels (requires backend `/pusher/auth` endpoint)
6. **P-9** — Replace debounce state with `useDeferredValue` (quick, 15 min)
7. **S-8** — HSTS header (deployment config, no code change)
8. **S-9** — Add plain-text comment to notification rendering (5 min)
9. **P-6** — Row virtualization (defer until page sizes grow)

---

## Backend Collaboration Required

The following fixes are **blocked on backend changes** and cannot be implemented on the frontend alone.
Share this section with the backend team.

---

### 1. `GET /clinic/api/auth/me` — Required for S-1, S-2, S-3

**Why it's needed:**
Currently the frontend stores the full staff object (role, permissions, email) in `localStorage` and
trusts it for all permission checks. A user can edit this in DevTools to escalate their own privileges in the UI.
The JWT is also in `localStorage`, making it readable by any JavaScript on the page (XSS risk).

**What the endpoint must do:**
- Accept `Authorization: Bearer <token>` header
- Return the authenticated staff object in the same shape as the login response `data.staff`
- Return `401` if the token is missing, expired, or invalid

**Expected response shape (must match existing `ClinicStaff` type):**
```json
{
  "data": {
    "id": 1,
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@clinic.com",
    "isOwner": false,
    "role": { "id": 2, "name": "Manager", "slug": "manager" },
    "permissions": [
      { "id": 1, "name": "View Appointments", "slug": "appointments.read" }
    ],
    "branches": [
      { "id": 10, "clinicId": 5 }
    ]
  }
}
```

**Frontend work unblocked once this exists:**
- Stop persisting staff object in `localStorage`
- Refetch live staff from `/me` on every app load to validate session and get real permissions
- Eliminates S-1 (partial), S-2, and S-3 entirely

---

### 2. `POST /clinic/api/pusher/auth` — Required for S-7

**Why it's needed:**
Pusher is currently using public channels (`clinic-{id}`), meaning anyone who knows the channel name
can subscribe and receive real-time clinic events (new bookings, notifications, etc.) without authenticating.

**What the endpoint must do:**
- Accept `Authorization: Bearer <token>` header (to verify the requesting user)
- Accept a Pusher auth request body: `{ socket_id, channel_name }`
- Validate that the authenticated staff member belongs to the clinic referenced in `channel_name`
- Call the Pusher server SDK to generate a signed auth response and return it

**Example using the Pusher Node.js SDK:**
```ts
import Pusher from 'pusher';

const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
});

// POST /clinic/api/pusher/auth
app.post('/clinic/api/pusher/auth', authenticate, (req, res) => {
  const { socket_id, channel_name } = req.body;
  // Validate staff has access to this channel's clinic
  const auth = pusherServer.authorizeChannel(socket_id, channel_name);
  res.json(auth);
});
```

**Frontend work unblocked once this exists:**
- Switch channel subscriptions from `clinic-{id}` → `private-clinic-{id}`
- Add `authEndpoint` + `auth.headers` to the Pusher client constructor in `useClinicPusher.ts`

---

### 3. HSTS Header — Required for S-8

**Why it's needed:**
Without a `Strict-Transport-Security` header, browsers may attempt plain HTTP connections on first visit,
leaving users exposed to protocol downgrade attacks.

**What needs to be configured (Railway / reverse proxy / CDN):**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This is a **deployment configuration change only** — no frontend or backend application code needs to change.
Add it to the Railway service's custom response headers, or to the Nginx/Caddy config if a reverse proxy is in use.
