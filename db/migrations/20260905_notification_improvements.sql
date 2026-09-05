-- 通知摘要与详情页已读状态改进
-- 先创建新函数，保留旧 get_notifications 供前端迁移期间回退。

CREATE OR REPLACE FUNCTION public.get_notifications_v2()
 RETURNS TABLE(
   id uuid,
   from_user_id uuid,
   from_username text,
   page text,
   excerpt text,
   read boolean,
   created_at timestamp with time zone,
   comment_id uuid,
   type text,
   target_title text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      n.*,
      CASE
        WHEN n.page LIKE 'forum/post?id=%' THEN 'forum'
        WHEN n.page LIKE 'forum/%' THEN 'forum'
        WHEN n.page LIKE 'plaza/post?slug=%' THEN 'plaza'
        WHEN n.page LIKE 'plaza/%' THEN 'plaza'
        WHEN n.page LIKE 'wishes/%' THEN 'wish'
        ELSE NULL
      END AS target_kind,
      CASE
        WHEN n.page LIKE 'forum/post?id=%' THEN substring(n.page FROM position('=' IN n.page) + 1)
        WHEN n.page LIKE 'forum/%' THEN substring(n.page FROM 7)
        WHEN n.page LIKE 'plaza/post?slug=%' THEN substring(n.page FROM position('=' IN n.page) + 1)
        WHEN n.page LIKE 'plaza/%' THEN substring(n.page FROM 7)
        WHEN n.page LIKE 'wishes/%' THEN substring(n.page FROM 8)
        ELSE NULL
      END AS target_key
    FROM public.notifications n
    WHERE n.user_id = auth.uid()
    ORDER BY n.created_at DESC
    LIMIT 50
  )
  SELECT
    s.id,
    s.from_user_id,
    u.username,
    s.page,
    s.excerpt,
    s.read,
    s.created_at,
    s.comment_id,
    s.type,
    COALESCE(
      fp.title,
      pa.title,
      CASE
        WHEN w.id IS NULL THEN NULL
        ELSE COALESCE(NULLIF(trim(w.title), ''), '许愿 #' || lpad(w.request_number::text, 4, '0'))
      END
    ) AS target_title
  FROM scoped s
  LEFT JOIN public.wiki_users u ON u.id = s.from_user_id
  LEFT JOIN public.forum_posts fp
    ON fp.id = CASE
      WHEN s.target_kind = 'forum'
        AND s.target_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN s.target_key::uuid
    END
  LEFT JOIN public.plaza_articles pa
    ON s.target_kind = 'plaza' AND pa.slug = s.target_key
  LEFT JOIN public.wishes w
    ON w.id = CASE
      WHEN s.target_kind = 'wish'
        AND s.target_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN s.target_key::uuid
    END
  ORDER BY s.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_notifications_v2() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notifications_read_for_page(p_page text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_page text := trim(p_page);
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF v_page IS NULL OR v_page = '' THEN RETURN false; END IF;

  UPDATE public.notifications n
  SET read = true
  WHERE n.user_id = auth.uid()
    AND n.read = false
    AND (
      n.page = v_page
      OR (
        v_page LIKE 'forum/%'
        AND n.page = 'forum/post?id=' || substring(v_page FROM 7)
      )
      OR (
        v_page LIKE 'plaza/%'
        AND n.page = 'plaza/post?slug=' || substring(v_page FROM 7)
      )
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read_for_page(text) TO authenticated;
