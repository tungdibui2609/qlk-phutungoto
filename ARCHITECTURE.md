# Multi-Tenant Architecture Documentation

This project uses a **Sub-path Strategy** to handle Multi-tenancy, separating the Platform Administration (Super Admin) from the Tenant Application (Companies).

## 1. Routing Structure

### A. Super Admin Portal (`/admin`)
- **URL**: `domain.com/admin/*`
- **Audience**: Platform Owner (Super Admin) only.
- **Purpose**: Create companies, manage subscriptions, seed data.
- **Authentication**: Strict check for `SUPER_ADMIN_EMAIL`.
- **Refresh Behavior**: Should persist on the current `/admin` page.

### B. Tenant Application (`/`)
- **URL**: `domain.com/*` (e.g., `/dashboard`, `/inventory`)
- **Audience**: Company Users (Employees, Managers).
- **Purpose**: Daily operations.
- **Context**: users belong to a `company_id`.

## 2. Middleware Logic (`src/middleware.ts`)

1.  **Session Refresh**: Calls `supabase.auth.getUser()`.
2.  **Use Subpath**:
    - `/admin/*` -> Enforce Super Admin checks.
    - `/` -> Check generic User Session.
3.  **Redirection Rules**:
    - Unauthenticated -> `/login` (or `/admin` if targeting admin).
    - Authenticated User on Login Page -> Redirect to Dashboard.

## 3. Development Notes
- **Localhost**: The sub-path strategy works seamlessly on `localhost:3000`.
- **Deployment**: No strict DNS requirement.
