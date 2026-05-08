# PawClinics Dashboard — Build Progress

> Source for reused components: `D:\Paw Buddy\pawProject`
> Stack: React 19 + TypeScript + Vite + CSS Modules + Bootstrap Icons + Axios
> Base URL: `http://localhost:8000` (dev) / `https://backend-production-12d0.up.railway.app` (prod)

---

## API SCOPE — What We Use

The backend has 4 API groups. Only one belongs to us:

| Group | Base path | Ours? |
|-------|-----------|-------|
| Mobile API | `/api/*` | ❌ Mobile app only |
| Dashboard API | `/admin/api/*` | ❌ Admin dashboard (pawProject) |
| Testing / Dev / Public | `/test/*` `/dev/*` `/public/*` | ❌ Not frontend |
| **Clinic Dashboard API** | **`/clinic/api/*`** | **✅ All of it** |

---

## CLINIC API REFERENCE

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/clinic/api/auth/login` | Login → returns `token` (JWT `clinic_staff`) + `staff` object with assigned `branches` |

Token stored as: `clinicStaffToken`
After login, read and store: `data.staff.branches[0].clinicId` and `data.staff.branches[0].id`

---

### Clinic (own clinic info)
| Method | Endpoint | Permission | Notes |
|--------|----------|------------|-------|
| GET | `/clinic/api/clinics/:clinicId` | `clinics.read` | Portal view — no license/approval/isActive |
| PUT | `/clinic/api/clinics/:clinicId` | `clinics.update` | Editable: title, titleInArabic, description, logoUrl, coverUrl, email, website |

---

### Branches
| Method | Endpoint | Permission | Notes |
|--------|----------|------------|-------|
| GET | `/clinic/api/clinics/:clinicId/branches` | `clinic-branches.read` | Only branches you are assigned to |
| GET | `/clinic/api/clinics/:clinicId/branches/:branchId` | `clinic-branches.read` | Single branch — must be assigned |
| POST | `/clinic/api/clinics/:clinicId/branches` | `clinic-branches.create` | Body: title, description, logoUrl, isMainBranch, phoneNumber, lat, lng, address, serviceIds[], tags[], workingHours[] |
| PUT | `/clinic/api/clinics/:clinicId/branches/:branchId` | `clinic-branches.update` | Same body — no isActive field |

No DELETE in clinic portal (admin-only).

---

### Clinic Staff
| Method | Endpoint | Permission | Notes |
|--------|----------|------------|-------|
| GET | `/clinic/api/clinic-staff` | `clinic-staff.read` | Filters: page, limit, search, clinicBranchId |
| GET | `/clinic/api/clinic-staff/:id` | `clinic-staff.read` | Target must share clinic with you |
| POST | `/clinic/api/clinic-staff` | `clinic-staff.create` | clinicBranchId required (your branch) |
| PUT | `/clinic/api/clinic-staff/:id` | `clinic-staff.update` | firstName, lastName, bio, email, password, gender, yearsOfExperience, joinedAt, roleId |
| PUT | `/clinic/api/clinic-staff/:id/assignments` | `clinic-staff.assignments` | Replace full branch assignment list |

No DELETE in clinic portal (admin-only).

---

### Clinic Staff Roles
| Method | Endpoint | Permission | Notes |
|--------|----------|------------|-------|
| GET | `/clinic/api/clinic-staff-roles` | `clinic-staff-roles.read` | Read-only — used for role dropdown |

---

## PAGES WE CAN BUILD (API-driven)

| Page | API Used | Notes |
|------|----------|-------|
| Login | POST `/auth/login` | Core entry point |
| Dashboard (overview) | GET clinic + GET branches + GET staff | Summary cards |
| Clinic Settings | GET + PUT `/clinics/:id` | Edit clinic profile |
| Branches | GET + POST + PUT `/branches` | Manage locations |
| Branch Detail | GET `/branches/:id` | Working hours, services, tags |
| Staff | GET + POST + PUT `/clinic-staff` | Manage team |
| Staff Detail | GET + PUT `/clinic-staff/:id` | Profile + assignments |

**Pages NOT possible yet** (no API endpoints exist): Appointments, Patients, Medical Records, Billing, Prescriptions, Reviews. These can be added later when the backend adds them.

---

## PHASE 1 — Project Setup & Dependencies

### Step 1.1 — Install dependencies
**Status:** ⬜ Not started

```bash
npm install react-router-dom axios bootstrap react-bootstrap bootstrap-icons
npm install --save-dev @types/react-router-dom
```

---

### Step 1.2 — Copy design tokens
**Status:** ⬜ Not started

Create `src/styles/` and copy from `pawProject/src/styles/`:
- `variables.css` — all CSS custom properties
- `global.css` — Bootstrap import, scrollbar, utilities
- `transitions.css` — animation keyframes

Import both in `src/main.tsx`.

---

### Step 1.3 — Configure Vite proxy + env
**Status:** ⬜ Not started

`vite.config.ts` proxy:
```ts
'/clinic/api': 'http://localhost:8000'
```

`.env`:
```
VITE_API_BASE_URL=http://localhost:8000
```

---

## PHASE 2 — Common Reusable Components

> Adapted from `pawProject/src/components/common/`. Convert `.jsx` → `.tsx`, add TypeScript props interfaces, copy CSS/SCSS files as-is.

### Step 2.1 — Button
**Status:** ⬜ Not started
- Source: `pawProject/src/components/common/Button/Button.jsx`
- Target: `src/components/common/Button/Button.tsx`
- Variants: primary / secondary / danger / outline — Sizes: small / medium / large
- Props: variant, size, fullWidth, disabled, loading, onClick, type, className, icon, children

### Step 2.2 — Input
**Status:** ⬜ Not started
- Source: `pawProject/src/components/common/Input/Input.jsx`
- Target: `src/components/common/Input/Input.tsx`
- Props: label, type, placeholder, value, onChange, error, required, disabled, icon

### Step 2.3 — Modal
**Status:** ⬜ Not started
- Source: `pawProject/src/components/common/Modal/Modal.jsx`
- Target: `src/components/common/Modal/Modal.tsx`
- Props: isOpen, onClose, title, children, footer, size (small|medium|large)

### Step 2.4 — DataTable
**Status:** ⬜ Not started
- Source: `pawProject/src/components/common/DataTable/DataTable.jsx`
- Target: `src/components/common/DataTable/DataTable.tsx`
- Props: columns, data, loading, currentPage, totalPages, totalItems, onPageChange, onEdit, onDelete, emptyMessage

### Step 2.5 — PawLoader
**Status:** ⬜ Not started
- Source: `pawProject/src/components/common/PawLoader/PawLoader.jsx`
- Target: `src/components/common/PawLoader/PawLoader.tsx`
- Props: size (small|medium|large)

### Step 2.6 — Skeleton components (3 files)
**Status:** ⬜ Not started
- Sources: `Skeleton.jsx`, `PageHeaderSkeleton.jsx`, `TablePageSkeleton.jsx`
- Targets: same names as `.tsx` in `src/components/common/Skeleton/`

---

## PHASE 3 — Authentication

### Step 3.1 — Clinic API axios instance
**Status:** ⬜ Not started
- Target: `src/services/clinicApi.ts`
- Base URL: `/clinic/api`
- Request interceptor: `Authorization: Bearer <clinicStaffToken>` from localStorage
- Response interceptor: 401 → clear storage, redirect to `/login`
- Token key: `clinicStaffToken`

### Step 3.2 — Auth service
**Status:** ⬜ Not started
- Target: `src/services/clinicAuthService.ts`
- `login({ email, password })` → POST `/clinic/api/auth/login`
- `logout()` → clear localStorage
- `getCurrentStaff()` → read `clinicStaffUser` from localStorage
- `isAuthenticated()` → checks `clinicStaffToken` existence
- `getToken()` → returns `clinicStaffToken`
- After login: save `clinicStaffToken`, `clinicStaffUser`, `clinicId`, `branchId` to localStorage

### Step 3.3 — Auth context
**Status:** ⬜ Not started
- Target: `src/context/ClinicAuthContext.tsx`
- Provides: `staffUser`, `clinicId`, `branchId`, `isAuthenticated`, `login()`, `logout()`, `loading`
- Hook: `useClinicAuth()`

### Step 3.4 — ProtectedRoute
**Status:** ⬜ Not started
- Target: `src/components/auth/ProtectedRoute.tsx`
- Reads `useClinicAuth()`, redirects to `/login` if not authenticated

---

## PHASE 4 — Layout

### Step 4.1 — ClinicSidebar
**Status:** ⬜ Not started
- Source: `pawProject/src/components/layout/AdminSidebar/AdminSidebar.jsx`
- Target: `src/components/layout/ClinicSidebar/ClinicSidebar.tsx`

Navigation items (clinic-specific):
| Icon | Label | Route |
|------|-------|-------|
| bi-grid | Dashboard | /dashboard |
| bi-building | Branches | /branches |
| bi-people | Staff | /staff |
| bi-gear | Clinic Settings | /settings |

Keep: dark theme (#1A1D2E), logo, profile section at bottom, responsive overlay behavior.

### Step 4.2 — ClinicLayout
**Status:** ⬜ Not started
- Source: `pawProject/src/components/layout/AdminLayout/AdminLayout.jsx`
- Target: `src/components/layout/ClinicLayout/ClinicLayout.tsx`
- Swap AdminSidebar → ClinicSidebar; keep responsive hamburger + overlay logic

---

## PHASE 5 — Services (API layer)

### Step 5.1 — Clinic service
**Status:** ⬜ Not started
- Target: `src/services/clinicService.ts`
- `getClinic(clinicId)` → GET `/clinic/api/clinics/:clinicId`
- `updateClinic(clinicId, data)` → PUT `/clinic/api/clinics/:clinicId`

### Step 5.2 — Branch service
**Status:** ⬜ Not started
- Target: `src/services/branchService.ts`
- `getBranches(clinicId)` → GET `/clinic/api/clinics/:clinicId/branches`
- `getBranch(clinicId, branchId)` → GET `/clinic/api/clinics/:clinicId/branches/:branchId`
- `createBranch(clinicId, data)` → POST `/clinic/api/clinics/:clinicId/branches`
- `updateBranch(clinicId, branchId, data)` → PUT `/clinic/api/clinics/:clinicId/branches/:branchId`

### Step 5.3 — Staff service
**Status:** ⬜ Not started
- Target: `src/services/staffService.ts`
- `getStaff(params)` → GET `/clinic/api/clinic-staff?page&limit&search&clinicBranchId`
- `getStaffMember(id)` → GET `/clinic/api/clinic-staff/:id`
- `createStaff(data)` → POST `/clinic/api/clinic-staff`
- `updateStaff(id, data)` → PUT `/clinic/api/clinic-staff/:id`
- `updateAssignments(id, clinicBranchIds)` → PUT `/clinic/api/clinic-staff/:id/assignments`

### Step 5.4 — Roles service
**Status:** ⬜ Not started
- Target: `src/services/rolesService.ts`
- `getRoles()` → GET `/clinic/api/clinic-staff-roles`

---

## PHASE 6 — Pages

### Step 6.1 — Login page
**Status:** ⬜ Not started
- Source: `pawProject/src/pages/Login/Login.jsx`
- Target: `src/pages/Login/Login.tsx`
- API: POST `/clinic/api/auth/login`
- Title: "Clinic Login" / Subtitle: "Sign in to the clinic staff portal"
- Same layout: left hero image + right form
- On success: save token + staff info, redirect to /dashboard

### Step 6.2 — Dashboard page
**Status:** ⬜ Not started
- Target: `src/pages/Dashboard/Dashboard.tsx`
- API: GET clinic + GET branches + GET staff (summary counts)
- Shows: clinic name/logo, branch count, staff count, assigned branches list
- Skeleton loaders while loading

### Step 6.3 — Branches page
**Status:** ⬜ Not started
- Target: `src/pages/Branches/Branches.tsx`
- API: GET branches, POST branch, PUT branch
- DataTable: Title, Phone, Address, Main Branch, Active, Actions (Edit)
- Add/Edit via Modal with full branch form (includes working hours)
- No delete action (admin-only)

### Step 6.4 — Staff page
**Status:** ⬜ Not started
- Target: `src/pages/Staff/Staff.tsx`
- API: GET staff, POST staff, PUT staff, GET roles
- DataTable: Name, Email, Role, Branch, Experience, Actions (Edit)
- Filter by branch (clinicBranchId dropdown)
- Add/Edit via Modal
- No delete action (admin-only)

### Step 6.5 — Clinic Settings page
**Status:** ⬜ Not started
- Target: `src/pages/Settings/Settings.tsx`
- API: GET clinic, PUT clinic
- Form fields: title, titleInArabic, description, email, website, logoUrl, coverUrl
- Inline save with loading state

---

## PHASE 7 — Routing

### Step 7.1 — App.tsx routing
**Status:** ⬜ Not started

```
/ → redirect to /login
/login → <Login />
/dashboard → <Protected><ClinicLayout><Dashboard /></ClinicLayout></Protected>
/branches → <Protected><ClinicLayout><Branches /></ClinicLayout></Protected>
/staff → <Protected><ClinicLayout><Staff /></ClinicLayout></Protected>
/settings → <Protected><ClinicLayout><Settings /></ClinicLayout></Protected>
* → redirect to /login
```

---

## PROGRESS SUMMARY

| Phase | Steps | Status |
|-------|-------|--------|
| Phase 1 — Setup | 3 steps | ⬜ 0/3 |
| Phase 2 — Common Components | 6 steps | ⬜ 0/6 |
| Phase 3 — Authentication | 4 steps | ⬜ 0/4 |
| Phase 4 — Layout | 2 steps | ⬜ 0/2 |
| Phase 5 — Services | 4 steps | ⬜ 0/4 |
| Phase 6 — Pages | 5 steps | ⬜ 0/5 |
| Phase 7 — Routing | 1 step | ⬜ 0/1 |
| **Total** | **25 steps** | **⬜ 0/25** |

---

## COMPONENT REUSE MAP

| Admin Source | Clinic Target | Change |
|-------------|---------------|--------|
| `Button.jsx` | `Button.tsx` | TS types only |
| `Input.jsx` | `Input.tsx` | TS types only |
| `Modal.jsx` | `Modal.tsx` | TS types only |
| `DataTable.jsx` | `DataTable.tsx` | TS types only |
| `PawLoader.jsx` | `PawLoader.tsx` | TS types only |
| `Skeleton.jsx` + variants | `Skeleton.tsx` + variants | TS types only |
| `AdminLayout.jsx` | `ClinicLayout.tsx` | Swap sidebar ref |
| `AdminSidebar.jsx` | `ClinicSidebar.tsx` | 4 nav items (clinic-specific) |
| `ProtectedRoute.jsx` | `ProtectedRoute.tsx` | Auth hook swap |
| `Login.jsx` | `Login.tsx` | Title text + auth hook |
| `adminApi.js` | `clinicApi.ts` | Base URL + token key |
| `adminAuthService.js` | `clinicAuthService.ts` | Token keys + save clinicId/branchId |
| `AdminAuthContext.jsx` | `ClinicAuthContext.tsx` | Add clinicId + branchId to state |
| `variables.css` | `variables.css` | Copy as-is |
| `global.css` | `global.css` | Copy as-is |

---

## NOTES

- **clinicId** comes from the login response: `data.staff.branches[0].clinicId` — store in context + localStorage
- **branchId** (default branch): `data.staff.branches[0].id` — store in context + localStorage  
- Clinic staff can only see/edit branches they are **assigned to**
- No delete endpoints exist in the clinic portal — all deletions are admin-only
- Working hours format: `{ dayOfWeek: 0–6, startTime: "HH:mm", endTime: "HH:mm" }`
- Permissions are role-based — UI may need to hide actions based on what the logged-in staff's role permits
