# ⚡ KaryaSync

A production-ready, Dynamic Role-Based Access Control (DRBAC) task management application built with React (Vite) + Supabase. Security is enforced at the **database level** using PostgreSQL Row Level Security — not just hidden in the UI.

---

## 🏗️ Architecture Overview

```
karya-sync/
├── supabase/
│   └── schema.sql              # Full DB schema + RLS policies (run in Supabase)
├── src/
│   ├── lib/
│   │   └── supabaseClient.js   # Supabase client singleton
│   ├── hooks/
│   │   └── useRole.js          # Custom hook: fetches current user's role
│   ├── components/
│   │   ├── SuperAdminDashboard.jsx  # User management (search + role updates)
│   │   └── AdminTaskCreator.jsx     # Task creation form with member dropdown
│   ├── App.jsx                 # Root: auth + role-based view rendering
│   ├── main.jsx                # React entry point
│   └── index.css               # Tailwind directives
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── .env.example                # Template for environment variables
└── .gitignore
```

---

## 🔐 Role Capabilities

| Action                          | super_admin | admin | member |
|---------------------------------|:-----------:|:-----:|:------:|
| Read ALL profiles               | ✅          | ❌    | ❌     |
| Update ANY profile's role       | ✅          | ❌    | ❌     |
| Read own profile                | ✅          | ✅    | ✅     |
| Read all member profiles        | ✅          | ✅    | ❌     |
| INSERT tasks                    | ✅          | ✅    | ❌     |
| SELECT/UPDATE own created tasks | ✅          | ✅    | ❌     |
| SELECT/UPDATE assigned tasks    | ✅          | ❌    | ✅     |
| Full task privileges            | ✅          | ❌    | ❌     |

---

## 🚀 Setup Instructions

### Step 1 — Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **"New Project"**.
3. Choose your organization, name your project (e.g. `karya-sync`), set a strong database password, and select a region close to you.
4. Wait ~2 minutes for the project to provision.

---

### Step 2 — Run the Database Schema

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar.
2. Click **"New Query"**.
3. Open the file `supabase/schema.sql` from this project.
4. Copy its **entire contents** and paste into the SQL Editor.
5. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. You should see `Success. No rows returned` — this is correct.

> ⚠️ **Important:** Run the entire file at once. Do not split it into parts, as the triggers and policies depend on the tables being created first.

---

### Step 3 — Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings → API** (left sidebar).
2. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — the long `eyJ...` string under "Project API Keys"

---

### Step 4 — Configure Environment Variables

1. In the project root, duplicate `.env.example` and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your values:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
   ```
3. Save the file.

> ⚠️ **Never commit `.env` to Git.** It's already in `.gitignore`.

---

### Step 5 — Install Dependencies & Run

```bash
# Install all packages
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Step 6 — Create Your First Super Admin

After signing up through the app, you need to manually promote one user to `super_admin`. This is a one-time bootstrap step:

1. Sign up via the app login form.
2. Go to Supabase dashboard → **Table Editor → profiles**.
3. Find your user row and copy the `id` (UUID).
4. Go to **SQL Editor** and run:
   ```sql
   UPDATE public.profiles
   SET role = 'super_admin'
   WHERE id = 'paste-your-uuid-here';
   ```
5. Refresh the app — you'll now see the Super Admin Dashboard.

---

## 🛠️ Tech Stack

| Layer      | Technology                            |
|------------|---------------------------------------|
| Frontend   | React 18 + Vite                       |
| Styling    | Tailwind CSS v3                       |
| Animation  | Framer Motion v11                     |
| Backend    | Supabase (PostgreSQL + Auth)          |
| Security   | PostgreSQL Row Level Security (RLS)   |
| Auth       | Supabase Auth (email/password)        |

---

## 🔒 Security Notes

- **RLS is always on.** Even if someone bypasses the UI, they cannot read or write data they are not authorized for — the database rejects the query.
- The `get_my_role()` helper function uses `SECURITY DEFINER` to safely read the current user's role without triggering recursive RLS checks.
- The `handle_new_user()` trigger uses `SECURITY DEFINER` to write to `profiles` from the auth context — this is intentional and safe.
- The anon key in the frontend is safe to expose. It has no special privileges beyond what RLS allows.
- **Never expose your Supabase `service_role` key** in the frontend. It bypasses RLS entirely.

---

## 📦 Building for Production

```bash
npm run build
```

Output is in the `dist/` folder. Deploy it to any static host:
- [Vercel](https://vercel.com) — connect your repo, set env vars in dashboard
- [Netlify](https://netlify.com) — drag-drop `dist/` or connect repo
- [Cloudflare Pages](https://pages.cloudflare.com) — fast global CDN

> Remember to set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on your hosting platform.

---

## 🧩 Component Reference

### `useRole.js`
Fetches the current user's role from the `profiles` table. Subscribes to auth state changes so it automatically updates on login/logout.

```js
const { role, isLoading, error } = useRole();
// role: 'super_admin' | 'admin' | 'member' | null
```

### `SuperAdminDashboard.jsx`
- Search users by email (partial match, case-insensitive)
- View current role as a color-coded badge
- Change role via a dropdown (all three roles)
- Quick "Promote to Admin" button for one-click admin promotion

### `AdminTaskCreator.jsx`
- Create tasks with title, description, status
- Dropdown auto-fetches only `member` role users (enforced by RLS)
- Status selection via toggle buttons
- Full loading and error state handling

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank screen / env error | Check `.env` has both variables set and restart `npm run dev` |
| `relation "profiles" does not exist` | Re-run `schema.sql` in Supabase SQL Editor |
| Member dropdown is empty | No users with role `member` exist yet — sign up more users |
| Cannot update roles | Ensure you are logged in as `super_admin` |
| Auth email not arriving | Check Supabase → Auth → Email settings; for dev, disable email confirmation |

### Disable Email Confirmation (for local development)

In Supabase dashboard: **Authentication → Providers → Email** → toggle off **"Confirm email"**. This lets you log in immediately after signing up without needing to confirm the email.

---

## 📄 License

MIT — free to use and modify.
