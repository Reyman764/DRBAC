-- ============================================================
-- KaryaSync: Full Database Schema & RLS Policies
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. ENUM: user_role
-- ============================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');


-- 2. PROFILES TABLE
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  role        user_role   NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast role-based queries
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 3. AUTH TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. TASKS TABLE
-- ============================================================
CREATE TABLE public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  created_by   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_tasks_created_by   ON public.tasks(created_by);
CREATE INDEX idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status       ON public.tasks(status);

CREATE TRIGGER on_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. RLS POLICIES: PROFILES
-- ============================================================

-- Helper function: get current user's role (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- POLICY: Super Admin can read ALL profiles
CREATE POLICY "super_admin_select_all_profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- POLICY: Super Admin can update ANY profile (e.g., promote/demote roles)
CREATE POLICY "super_admin_update_all_profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- POLICY: Admin can read their own profile
CREATE POLICY "admin_select_own_profile"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    AND id = auth.uid()
  );

-- POLICY: Admin can read all profiles with 'member' role (for task assignment)
CREATE POLICY "admin_select_member_profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    AND role = 'member'
  );

-- POLICY: Member can only read their own profile
CREATE POLICY "member_select_own_profile"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'member'
    AND id = auth.uid()
  );


-- ============================================================
-- 7. RLS POLICIES: TASKS
-- ============================================================

-- POLICY: Super Admin has ALL privileges on tasks
CREATE POLICY "super_admin_all_tasks"
  ON public.tasks FOR ALL
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- POLICY: Admin can INSERT new tasks
CREATE POLICY "admin_insert_tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
  );

-- POLICY: Admin can SELECT all tasks they created
CREATE POLICY "admin_select_own_tasks"
  ON public.tasks FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
  );

-- POLICY: Admin can UPDATE tasks they created
CREATE POLICY "admin_update_own_tasks"
  ON public.tasks FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND created_by = auth.uid()
  );

-- POLICY: Member can SELECT tasks assigned to them
CREATE POLICY "member_select_assigned_tasks"
  ON public.tasks FOR SELECT
  USING (
    public.get_my_role() = 'member'
    AND assigned_to = auth.uid()
  );

-- POLICY: Member can UPDATE tasks assigned to them (e.g., update status)
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


-- ============================================================
-- 8. GRANT PERMISSIONS (allow anon/authenticated to use tables)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL   ON public.profiles TO authenticated;
GRANT ALL   ON public.tasks    TO authenticated;
GRANT SELECT ON public.profiles TO anon;


-- ============================================================
-- OPTIONAL: Seed a super_admin manually after first signup
-- Replace <your-user-uuid> with the UUID from auth.users
-- ============================================================
-- UPDATE public.profiles
-- SET role = 'super_admin'
-- WHERE id = '<your-user-uuid>';
