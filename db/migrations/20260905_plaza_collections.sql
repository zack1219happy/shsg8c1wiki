-- 文章集锦：按同一作者、标题开头前两个字符动态归组。
-- 集锦不保存独立内容，始终由文章现状计算，标题编辑和文章删除会自动反映。

CREATE OR REPLACE FUNCTION public.plaza_title_prefix(p_title text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT left(btrim(COALESCE(p_title, '')), 2);
$function$;

CREATE OR REPLACE FUNCTION public.plaza_longest_common_prefix(p_titles text[])
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
DECLARE
  v_prefix text := '';
  v_title text;
  v_limit integer;
  v_index integer;
BEGIN
  IF p_titles IS NULL OR cardinality(p_titles) = 0 THEN
    RETURN '';
  END IF;

  v_prefix := COALESCE(p_titles[1], '');
  FOREACH v_title IN ARRAY p_titles LOOP
    v_title := COALESCE(v_title, '');
    v_limit := LEAST(char_length(v_prefix), char_length(v_title));
    v_index := 0;

    WHILE v_index < v_limit
      AND substr(v_prefix, v_index + 1, 1) = substr(v_title, v_index + 1, 1)
    LOOP
      v_index := v_index + 1;
    END LOOP;

    v_prefix := left(v_prefix, v_index);
    EXIT WHEN v_prefix = '';
  END LOOP;

  RETURN v_prefix;
END;
$function$;

CREATE OR REPLACE FUNCTION public.plaza_trim_collection_name(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT regexp_replace(
    COALESCE(p_name, ''),
    '[[:space:][:punct:]，。！？；：、（）【】《》“”‘’…—–－·•★☆※「」『』〈〉]+$',
    ''
  );
$function$;

CREATE OR REPLACE FUNCTION public.plaza_normalize_collection_name(p_name text, p_titles text[])
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
DECLARE
  v_name text := public.plaza_trim_collection_name(p_name);
  v_tokens text[];
  v_kept_tokens text[];
  v_token text;
  v_title text;
  v_title_tokens text[];
  v_index integer;
  v_complete boolean;
BEGIN
  IF v_name = '' OR p_titles IS NULL OR cardinality(p_titles) = 0 THEN
    RETURN v_name;
  END IF;

  v_tokens := regexp_split_to_array(v_name, '[[:space:]]+');
  IF cardinality(v_tokens) <= 1 THEN
    RETURN v_name;
  END IF;

  v_kept_tokens := ARRAY[v_tokens[1]];
  FOR v_index IN 2..cardinality(v_tokens) LOOP
    v_token := v_tokens[v_index];
    v_complete := true;

    FOREACH v_title IN ARRAY p_titles LOOP
      v_title_tokens := regexp_split_to_array(btrim(COALESCE(v_title, '')), '[[:space:]]+');
      IF NOT (v_token = ANY(v_title_tokens)) THEN
        v_complete := false;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_complete THEN
      EXIT;
    END IF;

    v_kept_tokens := array_append(v_kept_tokens, v_token);
  END LOOP;

  RETURN array_to_string(v_kept_tokens, ' ');
END;
$function$;

CREATE OR REPLACE FUNCTION public.plaza_excluded_collection_names()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT ARRAY['关于']::text[];
$function$;

DROP FUNCTION IF EXISTS public.get_plaza_feed(uuid, text, integer, integer, boolean, boolean);

CREATE OR REPLACE FUNCTION public.get_plaza_feed(
  p_category_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_my boolean DEFAULT false,
  p_liked boolean DEFAULT false
)
 RETURNS TABLE(
   result_type text,
   id uuid,
   title text,
   slug text,
   category_id uuid,
   author_id uuid,
   author_username text,
   author_color text,
   is_public boolean,
   comment_count integer,
   upvote_count integer,
   downvote_count integer,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   is_awarded boolean,
   tip_count integer,
   has_js boolean,
   collection_key text,
   collection_prefix text,
   collection_title text,
   collection_article_count integer,
   collection_latest_article_title text,
   collection_latest_article_slug text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := NULLIF(btrim(p_search), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_ids AS (
    SELECT p_category_id AS id
    WHERE p_category_id IS NOT NULL
    UNION ALL
    SELECT child.id
    FROM public.plaza_categories child
    JOIN category_ids parent ON child.parent_id = parent.id
  ),
  visible_articles AS (
    SELECT
      pa.id,
      pa.title,
      pa.slug,
      pa.category_id,
      pa.author_id,
      wu.username AS author_username,
      wu.color AS author_color,
      pa.is_public,
      pa.comment_count,
      pa.upvote_count,
      pa.downvote_count,
      pa.created_at,
      pa.updated_at,
      EXISTS (
        SELECT 1
        FROM public.points_transactions pt
        WHERE pt.reason = 'plaza_article'
          AND pt.reference_id = pa.id
      ) AS is_awarded,
      pa.tip_count,
      pa.has_js,
      public.plaza_title_prefix(pa.title) AS prefix,
      (
        p_category_id IS NULL
        OR pa.category_id IN (SELECT category_ids.id FROM category_ids)
      ) AS category_match,
      EXISTS (
        SELECT 1
        FROM public.plaza_votes pv
        WHERE pv.article_id = pa.id
          AND pv.user_id = v_uid
          AND pv.vote_type = 'up'
      ) AS liked_match,
      (
        v_search IS NULL
        OR pa.title ILIKE '%' || v_search || '%'
        OR pa.content ILIKE '%' || v_search || '%'
        OR wu.username ILIKE '%' || v_search || '%'
        OR public.plaza_title_prefix(pa.title) ILIKE '%' || v_search || '%'
      ) AS search_match
    FROM public.plaza_articles pa
    JOIN public.wiki_users wu ON wu.id = pa.author_id
    WHERE (pa.is_public = true OR pa.author_id = v_uid)
      AND (COALESCE(p_my, false) = false OR pa.author_id = v_uid)
  ),
  article_groups AS (
    SELECT
      va.author_id,
      va.prefix,
      count(*)::integer AS article_count,
      public.plaza_normalize_collection_name(
        public.plaza_longest_common_prefix(array_agg(btrim(va.title) ORDER BY va.id)),
        array_agg(btrim(va.title) ORDER BY va.id)
      ) AS collection_title
    FROM visible_articles va
    WHERE length(va.prefix) = 2
    GROUP BY va.author_id, va.prefix
  ),
  ranked_articles AS (
    SELECT
      va.*,
      ag.article_count,
      ag.collection_title,
      (
        ag.article_count >= 2
        AND char_length(ag.collection_title) >= 2
        AND NOT (ag.collection_title = ANY(public.plaza_excluded_collection_names()))
      ) AS collection_valid,
      row_number() OVER (
        PARTITION BY va.author_id, va.prefix
        ORDER BY va.updated_at DESC, va.created_at DESC, va.id DESC
      ) AS latest_rank
    FROM visible_articles va
    LEFT JOIN article_groups ag
      ON ag.author_id = va.author_id
     AND ag.prefix = va.prefix
  ),
  matching_articles AS (
    SELECT ra.*
    FROM ranked_articles ra
    WHERE ra.category_match
      AND (COALESCE(p_liked, false) = false OR ra.liked_match)
      AND ra.search_match
  ),
  matching_collections AS (
    SELECT
      ma.author_id,
      ma.prefix
    FROM matching_articles ma
    WHERE ma.collection_valid
    GROUP BY ma.author_id, ma.prefix
  ),
  collection_representatives AS (
    SELECT DISTINCT ON (ra.author_id, ra.prefix)
      ra.*
    FROM ranked_articles ra
    JOIN matching_collections mc
      ON mc.author_id = ra.author_id
     AND mc.prefix = ra.prefix
    WHERE ra.category_match
      AND (COALESCE(p_liked, false) = false OR ra.liked_match)
    ORDER BY ra.author_id, ra.prefix, ra.updated_at DESC, ra.created_at DESC, ra.id DESC
  ),
  article_results AS (
    SELECT
      'article'::text AS result_type,
      ma.id,
      ma.title,
      ma.slug,
      ma.category_id,
      ma.author_id,
      ma.author_username,
      ma.author_color,
      ma.is_public,
      ma.comment_count,
      ma.upvote_count,
      ma.downvote_count,
      ma.created_at,
      ma.updated_at,
      ma.is_awarded,
      ma.tip_count,
      ma.has_js,
      CASE WHEN ma.collection_valid THEN ma.author_id::text || ':' || ma.prefix END AS collection_key,
      CASE WHEN ma.collection_valid THEN ma.prefix END AS collection_prefix,
      CASE WHEN ma.collection_valid THEN ma.collection_title END AS collection_title,
      CASE WHEN ma.collection_valid THEN ma.article_count END AS collection_article_count,
      NULL::text AS collection_latest_article_title,
      NULL::text AS collection_latest_article_slug
    FROM matching_articles ma
    WHERE v_search IS NOT NULL
       OR ma.article_count IS NULL
       OR ma.article_count = 1
       OR ma.collection_valid = false
  ),
  collection_results AS (
    SELECT
      'collection'::text AS result_type,
      NULL::uuid AS id,
      cr.prefix AS title,
      NULL::text AS slug,
      cr.category_id,
      cr.author_id,
      cr.author_username,
      cr.author_color,
      cr.is_public,
      NULL::integer AS comment_count,
      NULL::integer AS upvote_count,
      NULL::integer AS downvote_count,
      cr.created_at,
      cr.updated_at,
      NULL::boolean AS is_awarded,
      NULL::integer AS tip_count,
      NULL::boolean AS has_js,
      cr.author_id::text || ':' || cr.prefix AS collection_key,
      cr.prefix AS collection_prefix,
      cr.collection_title,
      cr.article_count AS collection_article_count,
      cr.title AS collection_latest_article_title,
      cr.slug AS collection_latest_article_slug
    FROM collection_representatives cr
  ),
  mixed_results AS (
    SELECT * FROM article_results
    UNION ALL
    SELECT * FROM collection_results
  )
  SELECT
    mr.result_type,
    mr.id,
    mr.title,
    mr.slug,
    mr.category_id,
    mr.author_id,
    mr.author_username,
    mr.author_color,
    mr.is_public,
    mr.comment_count,
    mr.upvote_count,
    mr.downvote_count,
    mr.created_at,
    mr.updated_at,
    mr.is_awarded,
    mr.tip_count,
    mr.has_js,
    mr.collection_key,
    mr.collection_prefix,
    mr.collection_title,
    mr.collection_article_count,
    mr.collection_latest_article_title,
    mr.collection_latest_article_slug
  FROM mixed_results mr
  ORDER BY mr.updated_at DESC, mr.created_at DESC, mr.result_type, COALESCE(mr.id::text, mr.collection_key)
  LIMIT v_limit
  OFFSET v_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_plaza_collection(
  p_author_id uuid,
  p_prefix text
)
 RETURNS TABLE(
   collection_key text,
   collection_title text,
   author_id uuid,
   author_username text,
   author_color text,
   article_count integer,
   id uuid,
   title text,
   slug text,
   category_id uuid,
   is_public boolean,
   comment_count integer,
   upvote_count integer,
   downvote_count integer,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   is_awarded boolean,
   tip_count integer,
   has_js boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prefix text := left(btrim(COALESCE(p_prefix, '')), 2);
BEGIN
  RETURN QUERY
  WITH visible_members AS (
    SELECT
      pa.id,
      pa.title,
      pa.slug,
      pa.category_id,
      pa.author_id,
      wu.username AS author_username,
      wu.color AS author_color,
      pa.is_public,
      pa.comment_count,
      pa.upvote_count,
      pa.downvote_count,
      pa.created_at,
      pa.updated_at,
      EXISTS (
        SELECT 1
        FROM public.points_transactions pt
        WHERE pt.reason = 'plaza_article'
          AND pt.reference_id = pa.id
      ) AS is_awarded,
      pa.tip_count,
      pa.has_js,
      count(*) OVER ()::integer AS visible_count
    FROM public.plaza_articles pa
    JOIN public.wiki_users wu ON wu.id = pa.author_id
    WHERE pa.author_id = p_author_id
      AND public.plaza_title_prefix(pa.title) = v_prefix
      AND length(v_prefix) = 2
      AND (pa.is_public = true OR pa.author_id = v_uid)
  ),
  collection_meta AS (
    SELECT
      max(vm.visible_count)::integer AS article_count,
      public.plaza_normalize_collection_name(
        public.plaza_longest_common_prefix(array_agg(btrim(vm.title) ORDER BY vm.id)),
        array_agg(btrim(vm.title) ORDER BY vm.id)
      ) AS collection_title
    FROM visible_members vm
  )
  SELECT
    p_author_id::text || ':' || v_prefix,
    cm.collection_title,
    vm.author_id,
    vm.author_username,
    vm.author_color,
    cm.article_count,
    vm.id,
    vm.title,
    vm.slug,
    vm.category_id,
    vm.is_public,
    vm.comment_count,
    vm.upvote_count,
    vm.downvote_count,
    vm.created_at,
    vm.updated_at,
    vm.is_awarded,
    vm.tip_count,
    vm.has_js
  FROM visible_members vm
  CROSS JOIN collection_meta cm
  WHERE cm.article_count >= 2
    AND char_length(cm.collection_title) >= 2
    AND NOT (cm.collection_title = ANY(public.plaza_excluded_collection_names()))
  ORDER BY vm.created_at DESC, vm.id DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_plaza_article_navigation(p_article_id uuid)
 RETURNS TABLE(
   collection_key text,
   collection_title text,
   collection_author_id uuid,
   collection_prefix text,
   collection_article_count integer,
   previous_slug text,
   previous_title text,
   next_slug text,
   next_title text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH current_article AS (
    SELECT
      pa.author_id,
      public.plaza_title_prefix(pa.title) AS prefix
    FROM public.plaza_articles pa
    WHERE pa.id = p_article_id
      AND (pa.is_public = true OR pa.author_id = v_uid)
  ),
  visible_members AS (
    SELECT
      pa.id,
      pa.title,
      pa.slug,
      pa.author_id,
      public.plaza_title_prefix(pa.title) AS prefix
    FROM public.plaza_articles pa
    JOIN current_article ca
      ON ca.author_id = pa.author_id
     AND ca.prefix = public.plaza_title_prefix(pa.title)
    WHERE (pa.is_public = true OR pa.author_id = v_uid)
  ),
  group_meta AS (
    SELECT
      vm.author_id,
      vm.prefix,
      count(*)::integer AS article_count,
      public.plaza_normalize_collection_name(
        public.plaza_longest_common_prefix(array_agg(btrim(vm.title) ORDER BY vm.id)),
        array_agg(btrim(vm.title) ORDER BY vm.id)
      ) AS collection_title
    FROM visible_members vm
    GROUP BY vm.author_id, vm.prefix
  ),
  ranked_members AS (
    SELECT
      vm.*,
      gm.article_count,
      gm.collection_title,
      lag(pa.slug) OVER (ORDER BY pa.created_at, pa.id) AS previous_slug,
      lag(pa.title) OVER (ORDER BY pa.created_at, pa.id) AS previous_title,
      lead(pa.slug) OVER (ORDER BY pa.created_at, pa.id) AS next_slug,
      lead(pa.title) OVER (ORDER BY pa.created_at, pa.id) AS next_title
    FROM visible_members vm
    JOIN group_meta gm
      ON gm.author_id = vm.author_id
     AND gm.prefix = vm.prefix
    JOIN public.plaza_articles pa ON pa.id = vm.id
  )
  SELECT
    rm.author_id::text || ':' || rm.prefix,
    rm.collection_title,
    rm.author_id,
    rm.prefix,
    rm.article_count,
    rm.previous_slug,
    rm.previous_title,
    rm.next_slug,
    rm.next_title
  FROM ranked_members rm
  WHERE rm.id = p_article_id
    AND length(rm.prefix) = 2
    AND rm.article_count >= 2
    AND char_length(rm.collection_title) >= 2
    AND NOT (rm.collection_title = ANY(public.plaza_excluded_collection_names()));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.plaza_title_prefix(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_plaza_feed(uuid, text, integer, integer, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_plaza_collection(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_plaza_article_navigation(uuid) TO anon, authenticated;
