-- ============================================================
-- AI rate limit — скользящее окно 1 час на пользователя
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ai_window_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS ai_requests_in_window integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_ai_window
    ON public.profiles (ai_window_started_at)
    WHERE ai_window_started_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
    p_limit integer DEFAULT 20,
    p_window_seconds integer DEFAULT 3600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_window_start timestamptz;
    v_count integer;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT ai_window_started_at, ai_requests_in_window
      INTO v_window_start, v_count
      FROM public.profiles
     WHERE id = v_user_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_window_start IS NULL
       OR now() - v_window_start > make_interval(secs => p_window_seconds)
    THEN
        UPDATE public.profiles
           SET ai_window_started_at = now(),
               ai_requests_in_window = 1
         WHERE id = v_user_id;
        RETURN true;
    END IF;

    IF v_count >= p_limit THEN
        RETURN false;
    END IF;

    UPDATE public.profiles
       SET ai_requests_in_window = ai_requests_in_window + 1
     WHERE id = v_user_id;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(integer, integer) TO authenticated;