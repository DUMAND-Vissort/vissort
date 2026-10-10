-- Migration: 2026-10-10
-- Roles (pending/patient/doctor/clinic_admin/admin), updated_at trigger, ping anon-insert closed.
-- Applied via Supabase SQL Editor on 2026-10-10.

-- ============================================================
-- 1. Extend role constraint
-- ============================================================
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('pending', 'user', 'patient', 'doctor', 'clinic_admin', 'admin'));

-- ============================================================
-- 2. Default role = 'pending'
-- ============================================================
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'pending';

-- ============================================================
-- 3. Migrate 'user' -> 'patient'
-- ============================================================
UPDATE public.profiles
  SET role = 'patient'
  WHERE role = 'user';

-- ============================================================
-- 4. Drop 'user' from constraint (after migration)
-- ============================================================
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('pending', 'patient', 'doctor', 'clinic_admin', 'admin'));

-- ============================================================
-- 5. Auto-update updated_at on profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. Close ping anon INSERT (DoS vector)
-- ============================================================
DROP POLICY IF EXISTS ping_insert_anon ON ping;
