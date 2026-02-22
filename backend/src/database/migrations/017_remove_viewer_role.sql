-- Migration 017: Remove viewer role from app_role enum
-- This migration removes the 'viewer' role option from the system

-- First, update any existing users with viewer role to md (supervisor)
UPDATE users 
SET role = 'md' 
WHERE role = 'viewer';

-- Now we need to recreate the enum without 'viewer'
-- PostgreSQL doesn't allow direct modification of enums, so we need to:
-- 1. Drop the default constraint (it references the old enum)
-- 2. Create a new enum
-- 3. Change the column type
-- 4. Drop the old enum
-- 5. Rename the new enum
-- 6. Re-add default constraint with new enum

-- Drop the default constraint first
ALTER TABLE users 
  ALTER COLUMN role DROP DEFAULT;

-- Create new enum without viewer
CREATE TYPE app_role_new AS ENUM ('boss', 'admin', 'qs', 'md');

-- Change the column to use the new enum
ALTER TABLE users 
  ALTER COLUMN role TYPE app_role_new 
  USING role::text::app_role_new;

-- Drop the old enum
DROP TYPE app_role;

-- Rename the new enum to the original name
ALTER TYPE app_role_new RENAME TO app_role;

-- Set new default to 'md' (most restricted non-admin role)
ALTER TABLE users 
  ALTER COLUMN role SET DEFAULT 'md';
