# PawClinics Dashboard — Current Progress

Last updated: 2026-05-11

## Project Summary

PawClinics is the clinic staff portal for Paw Buddy/PawPal.

Stack:
- React 19 + TypeScript + Vite
- React Router
- CSS Modules / SCSS Modules
- Bootstrap CSS + Bootstrap Icons
- Custom `fetch` API client

Backend scope:
- This app uses only `/clinic/api/*`
- Do not call `/admin/api/*` from this portal
- Do not use `adminToken`

Dev/prod backend:
- Vite proxy: `/clinic/api` -> `https://backend-production-12d0.up.railway.app`
- Vercel rewrite: `/clinic/api/:path*` -> Railway clinic API

## API Groups

| Group | Base path | Used here? | Notes |
|---|---:|---:|---|
| Mobile API | `/api/*` | No | Mobile app only |
| Admin Dashboard API | `/admin/api/*` | No | Used by `D:\Paw Buddy\pawProject` only |
| Clinic Dashboard API | `/clinic/api/*` | Yes | This app's API scope |
| Public/Test/Dev | mixed | No | Not part of portal UI |

## Implemented Routes

| Route | Status | Component |
|---|---:|---|
| `/` | Done | Auth-aware redirect |
| `/login` | Done | `Login` |
| `/dashboard` | Done | `ClinicDashboard` |
| `/branches` | Done | `BranchesList` |
| `/branches/create` | Done | `CreateBranch` |
| `/branches/:branchId` | Done | `EditBranch` |
| `/staff` | Done | `StaffList` |
| `/staff/create` | Done | `CreateStaff` |
| `/staff/:staffId` | Done | `EditStaff` |
| `/settings` | Done | `ClinicSettings` |
| `*` | Done | Not found page |

## Completed Features

### Setup

Status: Done

- Vite + React + TypeScript app is configured.
- Bootstrap and Bootstrap Icons are imported globally.
- SCSS module styling is used for pages/layout.
- Production build passes.

Verification:

```bash
npm run build
```

### Shared Styling

Status: Done

Files:
- `src/styles/variables.css`
- `src/styles/global.css`
- `src/styles/transitions.css`

Design tokens include:
- primary blue `#0D9AFF`
- dark sidebar/nav `#1A1D2E`
- light app background `#F5F5F5`
- shared spacing, radius, shadow, transition, and z-index variables

Note:
- Many SCSS modules still hardcode colors instead of using CSS variables.

### Shared Components

Status: Done

Files:
- `Button`
- `Input`
- `Modal`
- `DataTable`
- `PawLoader`
- `Skeleton`
- `PageHeaderSkeleton`
- `TablePageSkeleton`

Notes:
- `PawLoader` has a custom animated paw SVG.
- `DataTable` is reused by branches and staff.
- `DataTable` accepts a `loading` prop but does not currently render a special loading state from that prop.

### Authentication

Status: Done

Files:
- `src/services/clinic/clinicApi.ts`
- `src/services/clinic/clinicAuthService.ts`
- `src/context/ClinicAuthContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`

API:

```txt
POST /clinic/api/auth/login
```

Stored session keys:
- `clinicStaffToken`
- `clinicStaff`
- `portalClinicId`
- `portalBranchId`

Behavior:
- Root route redirects to `/dashboard` or `/login`.
- Protected routes show `PawLoader` while auth state hydrates.
- API wrapper clears session and redirects to `/login` on `401`.

### Layout

Status: Done

Files:
- `src/components/layout/ClinicLayout/ClinicLayout.tsx`
- `src/components/layout/ClinicSidebar/ClinicSidebar.tsx`

Navigation:
- Dashboard
- Branches
- Staff
- Settings

Behavior:
- Fixed dark sidebar on desktop.
- Overlay sidebar on smaller viewports.
- Staff profile card and logout button in sidebar.

### Dashboard

Status: Done

File:
- `src/pages/Dashboard/ClinicDashboard.tsx`

APIs:

```txt
GET /clinic/api/clinics/:clinicId
GET /clinic/api/clinics/:clinicId/branches
GET /clinic/api/clinic-staff?page=1&limit=5
```

Shows:
- Greeting
- Clinic name
- Branch count
- Staff count
- Current branch label
- Quick action cards
- Recent staff

### Clinic Settings

Status: Done

File:
- `src/pages/Settings/ClinicSettings.tsx`

APIs:

```txt
GET /clinic/api/clinics/:clinicId
PUT /clinic/api/clinics/:clinicId
```

Editable fields:
- `title`
- `titleInArabic`
- `description`
- `logoUrl`
- `coverUrl`
- `email`
- `website`

Admin-only fields intentionally excluded:
- license
- approval fields
- `isActive`

### Branches

Status: Done

Files:
- `src/services/clinic/clinicBranchesService.ts`
- `src/pages/Branches/BranchesList.tsx`
- `src/pages/Branches/BranchForm.tsx`
- `src/pages/Branches/CreateBranch.tsx`
- `src/pages/Branches/EditBranch.tsx`

APIs:

```txt
GET  /clinic/api/clinics/:clinicId/branches
GET  /clinic/api/clinics/:clinicId/branches/:branchId
POST /clinic/api/clinics/:clinicId/branches
PUT  /clinic/api/clinics/:clinicId/branches/:branchId
```

Implemented:
- Paginated branch list
- Create branch
- Edit branch
- Working hours editor
- Tags editor
- Manual `serviceIds` field
- Logo preview
- Branch table safely renders `tags` and `serviceIds` whether backend returns strings, numbers, or objects

Important limitation:
- The clinic portal does not currently have a service catalog endpoint.
- Services can be submitted as `serviceIds`, but the app cannot fetch/select them yet.
- The current service field is a manual workaround.

### Staff List

Status: Done

Files:
- `src/services/clinic/clinicStaffService.ts`
- `src/services/clinic/clinicStaffRolesService.ts`
- `src/pages/Staff/StaffList.tsx`
- `src/pages/Staff/Staff.module.scss`

APIs:

```txt
GET /clinic/api/clinic-staff?page=1&limit=10&search=&clinicBranchId=
GET /clinic/api/clinic-staff-roles
GET /clinic/api/clinics/:clinicId/branches
```

Implemented:
- Paginated staff table
- Search
- Branch filter using only visible clinic branches
- Create Staff button
- Edit action
- Role label fallback from separately loaded roles
- Loading, empty, and error states

Table columns:
- Name
- Email
- Role
- Assigned branches
- Years of experience
- Joined date
- Actions

### Staff Create/Edit

Status: Done

Files:
- `src/pages/Staff/StaffForm.tsx`
- `src/pages/Staff/CreateStaff.tsx`
- `src/pages/Staff/EditStaff.tsx`

APIs:

```txt
GET  /clinic/api/clinic-staff/:staffId
POST /clinic/api/clinic-staff
PUT  /clinic/api/clinic-staff/:staffId
GET  /clinic/api/clinic-staff-roles
GET  /clinic/api/clinics/:clinicId/branches
```

Create fields:
- `firstName`
- `lastName`
- `bio`
- `email`
- `password`
- `gender`
- `clinicBranchId`
- optional `roleId`

Update fields:
- `firstName`
- `lastName`
- `bio`
- `email`
- optional `password`
- `birthDate`
- `gender`
- `yearsOfExperience`
- `joinedAt`
- `roleId`

Behavior:
- Password required on create.
- Password optional on edit.
- Branch dropdown on create only uses branches returned by clinic branches API.
- Role dropdown uses clinic staff roles API.

### Staff Branch Assignments

Status: Done

File:
- `src/pages/Staff/StaffAssignments.tsx`

API:

```txt
PUT /clinic/api/clinic-staff/:staffId/assignments
```

Payload:

```json
{
  "clinicBranchIds": [1, 2, 3]
}
```

Implemented:
- Checkbox list of visible branches on edit staff page.
- Existing assignments are preselected from `staff.branches`, with `clinicBranchId` fallback.
- Save sends the full selected branch list.
- Shows save loading, success, error, and empty states.

Important limitation:
- The clinic portal branch list returns only branches visible/assignable to the logged-in staff member.
- If admin dashboard has more clinic branches, the clinic portal cannot show them unless backend exposes an assignable/all-branches endpoint for authorized clinic users.

## Backend Gaps / Recommended API Additions

### 1. Clinic-safe service catalog endpoint

Needed to replace the manual Service IDs field with a real picker.

Suggested:

```txt
GET /clinic/api/clinic-services
```

or, for clinic-owned services:

```txt
GET /clinic/api/clinics/:clinicId/services
```

### 2. Clinic-owned services

If each clinic owner should manage their own services, backend needs clinic-scoped CRUD:

```txt
GET  /clinic/api/clinics/:clinicId/services
POST /clinic/api/clinics/:clinicId/services
PUT  /clinic/api/clinics/:clinicId/services/:serviceId
```

Possible hybrid model:
- global services from admin
- custom services per clinic

### 3. Assignable branches endpoint

Needed if clinic managers should assign staff to branches beyond their own currently assigned branch.

Suggested:

```txt
GET /clinic/api/clinics/:clinicId/assignable-branches
```

### 4. Permissions in auth/user response

The UI should hide actions based on permissions, but it needs reliable permission data on the logged-in staff role.

Needed examples:
- `clinics.update`
- `clinic-branches.create`
- `clinic-branches.update`
- `clinic-staff.create`
- `clinic-staff.update`
- `clinic-staff.assignments`

### 5. File upload support

Current clinic/branch media fields use raw URLs.

Suggested:

```txt
POST /clinic/api/files
```

or signed upload flow.

### 6. Staff deactivate / status management

No clinic portal delete/deactivate endpoint currently exists.

Suggested if needed:

```txt
PATCH /clinic/api/clinic-staff/:staffId/status
```

## Frontend Gaps / Suggested Improvements

1. Replace manual Service IDs with real multi-select after backend exposes services.
2. Add permission-based UI hiding/disabled states.
3. Add retry buttons on load failures.
4. Improve branch form validation:
   - time ranges
   - required address/phone if business rules need them
   - service ID validation
5. Add better success feedback/toasts.
6. Add staff avatar/image support if backend supports it.
7. Update README from default Vite template to real project docs.
8. Consider normalizing API response shapes at the service layer.

## Notes From Admin Dashboard Comparison

Admin dashboard repo:

```txt
D:\Paw Buddy\pawProject
```

Findings:
- Admin dashboard has global clinic service management at `/admin/api/clinic-services`.
- Admin dashboard creates clinic staff with a single `clinicBranchId`.
- Admin service already has `updateClinicStaffAssignments(id, clinicBranchIds)`.
- Multi-branch staff assignment support exists in the API, but admin frontend may need UI work to use it fully.

This clinic portal must not use admin endpoints.

## Current Build Status

Status: Passing

Command:

```bash
npm run build
```

Last verified after:
- Staff list/create/edit
- Staff branch assignments
- Branch tag/service rendering fix

