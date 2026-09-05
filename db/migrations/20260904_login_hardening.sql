CREATE TABLE IF NOT EXISTS public.wiki_login_attempts (
  login_key text NOT NULL,
  failed_count integer DEFAULT 0 NOT NULL,
  window_started_at timestamp with time zone DEFAULT now() NOT NULL,
  blocked_until timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT wiki_login_attempts_failed_count_check CHECK ((failed_count >= 0)),
  CONSTRAINT wiki_login_attempts_pkey PRIMARY KEY (login_key)
);

CREATE INDEX IF NOT EXISTS idx_wiki_login_attempts_updated_at
  ON public.wiki_login_attempts USING btree (updated_at);

ALTER TABLE public.wiki_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wiki_login_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.change_username(p_student_id text, p_password text, p_new_username text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_current TEXT;
  v_user_id uuid;
BEGIN
  IF p_new_username IS NULL OR length(trim(p_new_username)) = 0 THEN
    RAISE EXCEPTION '用户名不能为空';
  END IF;
  IF length(p_new_username) > 20 THEN
    RAISE EXCEPTION '用户名不能超过20个字符';
  END IF;
  IF trim(p_new_username) = '匿名' THEN
    RAISE EXCEPTION '用户名不能为"匿名"';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '请先登录';
  END IF;

  SELECT id, password_hash INTO v_user_id, v_current
  FROM wiki_users
  WHERE wiki_users.student_id = p_student_id
    AND wiki_users.id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION '账号不存在'; END IF;

  IF v_current IS NOT NULL THEN
    IF encode(digest(p_password, 'sha256'), 'hex') <> v_current THEN
      RAISE EXCEPTION '密码错误';
    END IF;
  ELSE
    IF p_password <> p_student_id THEN
      RAISE EXCEPTION '学号验证未通过';
    END IF;
  END IF;

  BEGIN
    UPDATE wiki_users
    SET username = trim(p_new_username), updated_at = now()
    WHERE wiki_users.student_id = p_student_id
      AND wiki_users.id = auth.uid();
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '该用户名已被使用';
  END;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('username', trim(p_new_username)),
      updated_at = now()
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user()
 RETURNS TABLE(id uuid, username text, name text, student_id text, role text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, username, name, student_id, role
  FROM wiki_users
  WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.verify_password(p_student_id text, p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_current TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;

  SELECT password_hash INTO v_current
  FROM wiki_users
  WHERE id = auth.uid() AND student_id = p_student_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_current IS NULL THEN
    RETURN p_password = p_student_id;
  END IF;
  RETURN encode(digest(p_password, 'sha256'), 'hex') = v_current;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_password(p_student_id text, p_old_password text, p_new_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_current TEXT;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;

  SELECT password_hash INTO v_current
  FROM wiki_users
  WHERE wiki_users.student_id = p_student_id
    AND wiki_users.id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION '只能修改自己的密码'; END IF;

  IF v_current IS NOT NULL THEN
    IF encode(digest(p_old_password, 'sha256'), 'hex') <> v_current THEN
      RAISE EXCEPTION '当前密码错误';
    END IF;
  ELSE
    IF p_old_password <> p_student_id THEN
      RAISE EXCEPTION '学号验证未通过';
    END IF;
  END IF;

  UPDATE wiki_users
  SET password_hash = encode(digest(p_new_password, 'sha256'), 'hex'),
      updated_at = now()
  WHERE wiki_users.student_id = p_student_id
    AND wiki_users.id = v_uid;

  RETURN TRUE;
END;
$function$;

DROP FUNCTION IF EXISTS public.login(text, text, text);
CREATE FUNCTION public.login(p_name_or_username text, p_password text, p_client_ip text DEFAULT NULL::text)
 RETURNS TABLE(
   id uuid,
   name text,
   username text,
   student_id text,
   has_password boolean,
   banned_until timestamp with time zone,
   role text,
   login_status text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rec wiki_users%ROWTYPE;
  v_client_ip inet;
  v_valid_password boolean := false;
BEGIN
  BEGIN
    IF NULLIF(btrim(p_client_ip), '') IS NOT NULL THEN
      v_client_ip := btrim(p_client_ip)::inet;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_client_ip := NULL;
  END;

  IF EXISTS (SELECT 1 FROM wiki_ip_allowlist) AND v_client_ip IS NULL THEN
    RETURN QUERY
    SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::boolean,
           NULL::timestamptz, NULL::text, 'ip_required'::text;
    RETURN;
  END IF;

  SELECT * INTO v_rec
  FROM wiki_users wu
  WHERE wu.name = p_name_or_username OR wu.username = p_name_or_username
  LIMIT 1;

  IF FOUND THEN
    IF v_rec.banned_until IS NOT NULL AND v_rec.banned_until > now() THEN
      RETURN QUERY
      SELECT v_rec.id, v_rec.name, v_rec.username,
             v_rec.student_id, NULL::boolean, v_rec.banned_until,
             v_rec.role, 'banned'::text;
      RETURN;
    END IF;

    IF v_client_ip IS NOT NULL AND EXISTS (
      SELECT 1 FROM wiki_ip_allowlist WHERE ip = v_client_ip
    ) AND NOT EXISTS (
      SELECT 1 FROM wiki_ip_allowlist
      WHERE ip = v_client_ip AND user_id = v_rec.id
    ) THEN
      RETURN;
    END IF;

    IF v_rec.password_hash IS NOT NULL THEN
      v_valid_password := encode(extensions.digest(p_password, 'sha256'), 'hex') = v_rec.password_hash;
    ELSE
      v_valid_password := p_password = v_rec.student_id;
    END IF;
  END IF;

  IF v_valid_password THEN
    RETURN QUERY
    SELECT v_rec.id, v_rec.name, v_rec.username,
           v_rec.student_id, (v_rec.password_hash IS NOT NULL), NULL::timestamptz,
           v_rec.role, 'success'::text;
    RETURN;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.change_username(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_username(text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_password(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_password(text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.login(text, text, text) TO PUBLIC;

COMMENT ON FUNCTION public.get_current_user() IS '获取当前认证用户的账号信息';
COMMENT ON FUNCTION public.login(text, text, text) IS '登录验证（返回用户信息和登录状态）';
COMMENT ON FUNCTION public.set_password(text, text, text) IS '修改当前认证用户的密码';
COMMENT ON FUNCTION public.verify_password(text, text) IS '验证当前认证用户的密码';
