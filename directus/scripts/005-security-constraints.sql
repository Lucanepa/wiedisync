-- Security constraints added 2026-04-04

-- 1. Enforce valid role values on members table
-- members.role is a JSONB array like ["user"] or ["user","vb_admin"]
-- This prevents privilege escalation via direct SQL updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'members_role_values_valid'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT members_role_values_valid
      CHECK (role::jsonb <@ '["user","admin","superuser","vb_admin","bb_admin","vorstand","website_admin"]'::jsonb);
  END IF;
END $$;

-- 2. Unique partial index on slot_claims to prevent race-condition double claims
-- Replaces the trigger-level EXISTS check with a DB-enforced constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_claims_active_unique
  ON slot_claims (hall_slot, date) WHERE status = 'active';
