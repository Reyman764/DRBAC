# ⚡ KaryaSync — v2 Premium UI

A production-ready Dynamic Role-Based Access Control (DRBAC) task management app with a fully redesigned premium UI.

---

## ✨ What's New in v2

### 🔴 Super Admin Dashboard
- **No more manual email search** — all users are loaded automatically on page load
- Full user table with **expandable rows** showing each user's assigned tasks
- **Inline role management** — dropdown to change any user's role instantly
- **Per-user task stats** — Assigned / Done / Active count badges per user
- **Completion progress bar** per user
- **Platform-wide breakdown** — stacked progress bar for Pending / Active / Done / Cancelled
- **"All Tasks" tab** — see every task with creator → assignee info
- Global stat cards: Total Users, Admins, Members, Total Tasks, Completed, Completion %

### 🟡 Admin Dashboard (fully rebuilt)
- **Full task list** — see all tasks you've created with live status
- **Status filter tabs** — click a stat card to filter by status
- **"+ New Task" modal** — premium slide-in form, no page navigation
- **Inline status updates** — dropdown to change any task's status without reload
- **Delete tasks** directly from the list
- **Animated progress bar** across all your tasks
- **Completion rate** shown in the header

### 🟢 Member Dashboard (fully rebuilt)
- **Tasks list** — see all tasks assigned to you (was completely empty before)
- **Tap to expand** any task to see description + update status
- **Personal progress bar** with % completion
- **Filter by status** — click stat cards or filter buttons
- **Status update buttons** — directly update from Pending → In Progress → Completed
- Personalized greeting using your profile name

### 🎨 Design System
- **Fonts**: Syne (headings) + Outfit (body) via Google Fonts
- **Colors**: Deep dark `#07070f` base, glass surfaces, role-coded accent colors
- **Animations**: Framer Motion stagger reveals, animated progress bars, expand/collapse
- **Ambient glows** and depth effects per role

---

## 🚀 Setup (same as v1)

### Step 1 — Supabase Project
Create a project at [supabase.com](https://supabase.com).

### Step 2 — Run Schema
Paste `supabase/schema.sql` into the **SQL Editor** and run it.

### Step 3 — Environment Variables
```bash
cp .env.example .env
```
Fill in:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4 — Install & Run
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

### Step 5 — Bootstrap Super Admin
After signing up, run in Supabase SQL Editor:
```sql
UPDATE public.profiles SET role = 'super_admin' WHERE id = 'your-uuid';
```

### Step 6 — Disable Email Confirmation (dev only)
Supabase → Authentication → Providers → Email → toggle off **"Confirm email"**

---

## 🔒 Security
All data access is enforced by PostgreSQL Row Level Security — not just UI logic. See `supabase/schema.sql` for full policy details.

---

## 📦 Build
```bash
npm run build
```
Deploy `dist/` to Vercel, Netlify, or Cloudflare Pages. Set env vars in your host's dashboard.
