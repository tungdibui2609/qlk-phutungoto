# Security Audit Report: Multi-Company Upgrade

**Date:** January 29, 2026
**Auditor:** Jules (AI Agent)
**Status:** CRITICAL VULNERABILITIES FOUND

## Executive Summary
The recent upgrade to a multi-tenant architecture has successfully isolated "Master Data" entities (Users, Products, Partners, Orders). However, **"Operational Data"** (Inventory, Audits) and **"Infrastructure Data"** (Warehouses, Locations) appear to be completely shared between companies. This represents a critical data leak where one company can view and potentially modify another company's stock and audit records.

## Detailed Findings

### 1. Critical: Missing Tenant Isolation in Inventory Core
**Severity:** 🔴 **CRITICAL**
**Affected Tables:** `lots`, `inventory_checks`, `inventory_check_items`

**Analysis:**
- These tables were **not** included in the migration `20260128100001_add_tenant_id_to_tables.sql`.
- A review of the `inventory_checks` creation script (`20240521000000...`) shows RLS policies that grant access to `authenticated` users via `using (true)`.
- No subsequent migration was found that adds `company_id` or restricts these policies.
- **Impact:** Any logged-in user from Company A can view, audit, and potentially adjust the stock (Lots) of Company B.

### 2. High: Missing Tenant Isolation in Infrastructure
**Severity:** 🟠 **HIGH**
**Affected Tables:** `branches`, `warehouses`, `zones`, `locations`

**Analysis:**
- These tables define the physical storage hierarchy.
- They lack the `company_id` column in the schema.
- While `create-company` creates a default branch, there is no enforcement preventing Company A from seeing Company B's branches.
- **Impact:** Companies expose their warehouse structure to competitors.

### 3. Medium: Outdated TypeScript Definitions
**Severity:** 🟡 **MEDIUM**
**Affected File:** `src/lib/database.types.ts`

**Analysis:**
- The generated Types file is out of sync with the database migrations.
- Example: `inbound_orders` has `company_id` in the database (added via migration), but the Type definition lacks this field.
- **Impact:** Developers may unknowingly write insecure code or rely on "any" casting because the types do not reflect the actual schema constraints.

### 4. Info: Hardcoded Super Admin & Recursion Fixes
**Severity:** 🔵 **INFO**
**Analysis:**
- The Super Admin email (`tungdibui2609@gmail.com`) is hardcoded in multiple SQL files and Middleware. This makes transferring ownership or changing admins difficult and error-prone.
- The "Emergency Recursion Fix" (`20260129150000...`) uses `SECURITY DEFINER` functions to bypass RLS loops. While necessary, this adds complexity and a potential point of failure if the function logic is flawed.

## Recommendations

1.  **Immediate Remediation (Stop the Bleeding):**
    - Create a new migration to add `company_id` to `lots`, `inventory_checks`, `inventory_check_items`, `branches`, `zones`, `locations`.
    - Apply `RESTRICTIVE` RLS policies to these tables similar to `enforce_strict_isolation.sql`.
    - Backfill existing data to a default company or specific companies if traceability exists (e.g., via `created_by` user).

2.  **Process Improvement:**
    - Regenerate `database.types.ts` immediately after every migration.
    - Implement a centralized "Tenant Policy" function in Postgres to avoid hardcoding the email address in 15+ places.
