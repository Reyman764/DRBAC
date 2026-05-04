# KaryaSync — Dynamic Role-Based Access Control Task Manager

A task and user management platform with **Supabase Auth**, **Row Level Security (RLS)**, and **three role-specific dashboards** (Super Admin, Admin, Member). Built with **React 18**, **Vite 5**, **Framer Motion**, and **Tailwind** (utility layer + a custom CSS design system).

---

## What’s in the box

| Area | Description |
|------|-------------|
| **Auth** | Email/password sign-in; session drives which dashboard loads |
| **Roles** | `super_admin`, `admin`, `member` — resolved from `profiles.role` |
| **Tasks** | Title, description, status, assignee, optional **due date**, **priority** (`low` / `medium` / `high` / `urgent`) |
| **Comments** | `task_comments` with thread UI; author label stored for readable threads under RLS |
| **Super Admin** | All users & tasks, CSV export, bulk role changes, role **audit log** tab, realtime refresh |
| **Admin** | Own tasks CRUD, member assignment, workload summary, task thread modal, filters & sort |
| **Member** | Assigned tasks, full-page task detail with thread, status controls, notification-style active count |
| **Profile** | Settings modal to set **full name** (stored as `NULL` when empty, not `''`) |
| **Command palette** | `Ctrl/⌘ + K` — quick open profile + search tasks by role |

---

## Fixes & improvements (recent)

These address production and mobile issues and tighten security at the database layer.

### Critical

- **`window.confirm()` removed** — Deletes use a **`ConfirmModal`** so confirmation works on iOS (native `confirm` is unreliable there).
- **`useRole` refetch guard** — Ignores `TOKEN_REFRESHED` so the profile role is not re-fetched every token refresh (~hourly); refetch only on meaningful auth events.
- **Toast positioning** — Toasts render inside a **fixed flex anchor** so Framer Motion does not fight `%`-based centering on narrow viewports.
- **Error boundaries** — Each role dashboard is wrapped in **`ErrorBoundary`** so one render error does not white-screen the whole app; user can retry.
- **`full_name` semantics** — Signup trigger stores **`NULL`** for missing/blank names (not empty string), matching JS fallbacks like `displayName()` and avoiding “Unnamed” traps.
- **Schema / app alignment** — App expects `tasks.priority`, `tasks.due_date`, comments, and audit tables; run migrations (see below) or you’ll see errors such as `column tasks.priority does not exist` (connection is fine; schema is behind).

### Responsive & UX

- Auth layout: single column at **≤1024px**; story + card no longer fight for width on phones.
- Rows: **`row-actions`** wrap; main column **`min-width: 0`** to reduce overflow.
- Detail drawer: **`100%`-based slide**, width clamped (`min(440px, 100vw - 48px)`), sticky header with safe-area padding, **Escape** closes (Super Admin).
- Super Admin: **separate search state** for Users vs Tasks tabs; improved empty states; row hover transitions.
- Avatars: **stable per-user hue** from id/seed (`Avatar` + `avatarHue.js`).
- **⌘K / Ctrl+K** command palette with **custom events** to open task drawers or profile from any screen.

### Database & security

- **`SET search_path = public`** on **`SECURITY DEFINER`** functions (`get_my_role`, `handle_new_user`, `handle_updated_at`, role audit logger, comment author display filler) to reduce search-path injection risk.
- **Admin task assignment** — RLS **`WITH CHECK`** uses **`profile_is_assignable_member`**: `assigned_to` must be **`NULL`** or a profile with role **`member`** (not arbitrary users).
- **Constraints** — Sane limits on title/description/comment length; `task_priority` enum; optional `due_date`.
- **Role audit** — `profile_role_audit` + trigger on `profiles.role` updates (actor = `auth.uid()` when available).

### Features added in this generation

- Due dates and priority (UI + DB).
- Profile settings (name).
- Task comment threads + denormalized **`author_display_name`** for members who cannot read all profiles.
- Supabase **Realtime** subscriptions on dashboards for `profiles` / `tasks` (and audit inserts for Super Admin).
- Super Admin **CSV export**, **bulk role apply**, **audit** tab.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 18, Framer Motion |
| Styling | `index.css` (design tokens) + Tailwind |
| Data | Supabase JS v2 (Auth, Postgres, RLS) |
| Build | Vite 5 |

**Fonts** (see `index.css`): **Plus Jakarta Sans** (body), **Space Grotesk** (display/brand).

---

## Getting started

```bash
npm install
```

Create `.env` (or `.env.local`) with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

```bash
npm run dev
```

---

## Supabase database setup

**New project:** run the full script in **`supabase/schema.sql`** (SQL Editor).

**Existing database** (older KaryaSync schema without `priority` / comments / audit): run **`supabase/migrations/upgrade_existing_v1_to_v2.sql`** once, then reload the app.

After migration, in **Database → Replication**, add tables to **`supabase_realtime`** as needed (e.g. `tasks`, `profiles`, `profile_role_audit`) so live subscriptions work.

---

## Project structure

```
src/
├── App.jsx                     # Auth, role routing, palette, profile modal, error boundaries
├── index.css                   # Layout, components, responsive rules
├── main.jsx
├── constants/taskMeta.js       # Status / priority meta + length limits
├── lib/
│   ├── supabaseClient.js
│   ├── displayName.js
│   ├── avatarHue.js
│   └── appEvents.js            # ⌘K / profile / task open events
├── hooks/useRole.js
└── components/
    ├── SuperAdminDashboard.jsx
    ├── AdminDashboard.jsx
    ├── MemberDashboard.jsx
    ├── ConfirmModal.jsx
    ├── ErrorBoundary.jsx
    ├── ToastOutlet.jsx
    ├── ProfileSettings.jsx
    ├── CommandPalette.jsx
    ├── TaskComments.jsx
    ├── Avatar.jsx
    └── AdminTaskCreator.jsx    # standalone legacy form (not mounted in App)
```

---

## Role capabilities (summary)

| Role | Capabilities |
|------|----------------|
| **Super Admin** | All profiles & tasks; change roles (single + bulk); audit read; CSV; comments where policy allows |
| **Admin** | CRUD tasks they created; assign only **members**; workload view; threads on own tasks |
| **Member** | Read/update assigned tasks; thread; profile name |

Exact rules live in **`supabase/schema.sql`** (RLS policies).

---

## Future evolution (planned directions)

Ideas that fit naturally on top of the current architecture — pick by priority.

1. **Product & UX** — Email/notifications for new assignments & due dates; in-app notification center replacing the numeric badge-only hint; richer empty states & onboarding checklist for new workspaces.
2. **Tasks** — Attachments (Supabase Storage), subtasks, recurring tasks, @mentions in comments, optional **soft delete** / archive instead of hard delete.
3. **Org model** — Workspaces / teams, invites, custom roles or permission presets beyond the three enums.
4. **Observability** — Structured error reporting (e.g. Sentry), analytics on task throughput, SLAs by priority.
5. **Security & compliance** — Optional MFA enforced in Supabase; IP allowlisting; periodic RLS/policy review automation; tighter column-level restrictions if profiles gain more PII.
6. **Realtime** — Presence (“who’s online”), collaborative cursors optional, conflict handling if two admins edit one task.
7. **CLI / API** — Supabase Edge Functions for webhooks (Slack/Jira); read-only reporting API keys for BI tools.

---

## License

MIT
