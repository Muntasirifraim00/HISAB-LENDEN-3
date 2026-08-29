CREATE OR REPLACE FUNCTION public.hb_bootstrap_exec(p_sql TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
END;
$fn$;

REVOKE ALL ON FUNCTION public.hb_bootstrap_exec(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hb_bootstrap_exec(TEXT) TO anon, authenticated;