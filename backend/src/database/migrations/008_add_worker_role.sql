-- Add 'worker' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'worker';

COMMENT ON TYPE app_role IS 'Application roles: boss (owner), admin, qs (quantity surveyor), md (supervisor), worker, viewer';
