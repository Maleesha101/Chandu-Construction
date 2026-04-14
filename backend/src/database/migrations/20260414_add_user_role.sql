-- Migration: Add 'user' role to app_role enum
-- Created: 2026-04-14
-- Description: Adds a new 'user' role type to support basic user accounts

-- UP: Add the 'user' role to the app_role enum
ALTER TYPE app_role ADD VALUE 'user' AFTER 'worker';

-- Note: DOWN migration is complex for enums. To reverse:
-- 1. Create a new enum type without 'user'
-- 2. Alter any columns/constraints
-- 3. Drop the old type
-- 4. Rename the new type
-- 
-- Reference DOWN migration (run if needed):
/*
-- DOWN: Remove 'user' role from app_role enum
-- WARNING: Run these steps manually if rollback is needed
-- ALTER TYPE app_role RENAME TO app_role_old;
-- CREATE TYPE app_role AS ENUM ('boss', 'admin', 'qs', 'md', 'worker');
-- ALTER TABLE users ALTER COLUMN role TYPE app_role USING role::text::app_role;
-- ALTER TABLE approvals ALTER COLUMN role TYPE app_role USING role::text::app_role;
-- DROP TYPE app_role_old;
*/
