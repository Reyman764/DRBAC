-- ============================================================
-- KaryaSync: Full Database Schema & RLS (v2)
-- Run in Supabase SQL Editor on a fresh project, or apply
-- `migrations/upgrade_existing_v1_to_v2.sql` on an older database.
-- ============================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');


--  PROFILES TABLE
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL CHECK (char_length(trim(email)) >= 3 AND char_length(email) <= 320),
  full_name   TEXT        CHECK (full_name IS NULL OR char_length(full_name) <= 120),
  role        user_role   NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT full_name_trimmed_nonempty CHECK (
    full_name IS NULL OR char_length(trim(full_name)) > 0
  )
);

CREATE INDEX idx_profiles_role ON public.profiles(role);


CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--  AUTH TRIGGER: profiles row on signup — NULL full_name when missing / blank
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := NEW.raw_user_meta_data->>'full_name';
  IF v_name IS NULL OR trim(v_name) = '' THEN
    v_name := NULL;
  ELSE
    v_name := trim(v_name);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    'member'
  );
  RETURN NEW;
END;
$$;


CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


CREATE TABLE public.tasks (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT           NOT NULL,
  description  TEXT           CHECK (description IS NULL OR char_length(description) <= 8000),
  created_by   UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to  UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       TEXT           NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date     TIMESTAMPTZ,
  priority     task_priority  NOT NULL DEFAULT 'medium',
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT task_title_trimmed CHECK (
    char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 200
  )
);


CREATE INDEX idx_tasks_created_by   ON public.tasks(created_by);
CREATE INDEX idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status       ON public.tasks(status);


CREATE TRIGGER on_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


CREATE TABLE public.task_comments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_display_name   TEXT        NOT NULL DEFAULT '',
  body                  TEXT        NOT NULL CHECK (
    char_length(trim(body)) >= 1 AND char_length(trim(body)) <= 2000
  ),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);


CREATE TRIGGER on_task_comments_updated
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


CREATE OR REPLACE FUNCTION public.task_comment_fill_author_display()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text;
  em text;
BEGIN
  SELECT p.full_name, p.email INTO fn, em
  FROM public.profiles AS p WHERE p.id = NEW.author_id;
  NEW.author_display_name := COALESCE(
    NULLIF(trim(COALESCE(fn, '')), ''),
    trim(COALESCE(em, '')),
    'Member'
  );
  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS on_task_comments_fill_display ON public.task_comments;
CREATE TRIGGER on_task_comments_fill_display
  BEFORE INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comment_fill_author_display();


CREATE OR REPLACE FUNCTION public.task_comments_preserve_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  NEW.task_id := OLD.task_id;
  NEW.author_id := OLD.author_id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;


CREATE TRIGGER task_comments_refs_immutable
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comments_preserve_refs();


CREATE TABLE public.profile_role_audit (
  id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  profile_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_role   user_role   NOT NULL,
  new_role   user_role   NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profile_role_audit_profile ON public.profile_role_audit(profile_id);


CREATE OR REPLACE FUNCTION public.log_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.profile_role_audit (profile_id, actor_id, old_role, new_role)
    VALUES (NEW.id, auth.uid(), OLD.role, NEW.role);
  END IF;
  RETURN NEW;
END;
$$;


CREATE TRIGGER on_profile_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_role_change();


ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_role_audit ENABLE ROW LEVEL SECURITY;


CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;


-- ——— Helper: assignment target must exist and be workspace member ———
CREATE OR REPLACE FUNCTION public.profile_is_assignable_member(assignee UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT assignee IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = assignee AND p.role = 'member');
$$;


-- Profiles
CREATE POLICY "super_admin_select_all_profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'super_admin');

CREATE POLICY "super_admin_update_all_profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');


CREATE POLICY "admin_select_own_profile"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin' AND id = auth.uid());

CREATE POLICY "admin_select_member_profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin' AND role = 'member');

CREATE POLICY "admin_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin' AND id = auth.uid())
  WITH CHECK (public.get_my_role() = 'admin' AND id = auth.uid() AND role = 'admin'::public.user_role);


CREATE POLICY "member_select_own_profile"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'member' AND id = auth.uid());

CREATE POLICY "member_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'member' AND id = auth.uid())
  WITH CHECK (public.get_my_role() = 'member' AND id = auth.uid() AND role = 'member'::public.user_role);


CREATE POLICY "super_admin_all_tasks"
  ON public.tasks FOR ALL
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');


CREATE POLICY "admin_insert_tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
    AND public.profile_is_assignable_member(assigned_to)
  );


CREATE POLICY "admin_select_own_tasks"
  ON public.tasks FOR SELECT
  USING (public.get_my_role() = 'admin' AND created_by = auth.uid());


CREATE POLICY "admin_update_own_tasks"
  ON public.tasks FOR UPDATE
  USING (public.get_my_role() = 'admin' AND created_by = auth.uid())
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
    AND public.profile_is_assignable_member(assigned_to)
  );


CREATE POLICY "admin_delete_own_tasks"
  ON public.tasks FOR DELETE
  USING (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
  );


CREATE POLICY "member_select_assigned_tasks"
  ON public.tasks FOR SELECT
  USING (
    public.get_my_role() = 'member'
    AND assigned_to = auth.uid()
  );


CREATE POLICY "member_update_assigned_tasks"
  ON public.tasks FOR UPDATE
  USING (
    public.get_my_role() = 'member'
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'member'
    AND assigned_to = auth.uid()
  );


-- task_comments helpers
CREATE OR REPLACE FUNCTION public.user_can_access_task_comments(p_task UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = p_task AND (
        public.get_my_role() = 'super_admin'
        OR (public.get_my_role() = 'admin' AND t.created_by = auth.uid())
        OR (public.get_my_role() = 'member' AND t.assigned_to = auth.uid())
      )
    );
$$;


CREATE POLICY "task_comments_select_visible"
  ON public.task_comments FOR SELECT
  USING (public.user_can_access_task_comments(task_id));

CREATE POLICY "task_comments_insert_visible"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.user_can_access_task_comments(task_id)
  );

CREATE POLICY "task_comments_author_update"
  ON public.task_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "task_comments_author_delete"
  ON public.task_comments FOR DELETE
  USING (author_id = auth.uid());


CREATE POLICY "audit_super_admin_read"
  ON public.profile_role_audit FOR SELECT
  USING (public.get_my_role() = 'super_admin');


GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL   ON public.profiles TO authenticated;
GRANT ALL   ON public.tasks TO authenticated;
GRANT ALL   ON public.task_comments TO authenticated;
GRANT SELECT ON public.profile_role_audit TO authenticated;
GRANT SELECT ON public.profiles TO anon;


-- ---------- Realtime (Supabase-hosted Postgres) ----------
-- Enable in Dashboard ▸ Database ▸ Replication if not already listed.
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
