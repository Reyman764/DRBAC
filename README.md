# KaryaSync — Dynamic Role-Based Access Control Task Manager

A premium, full-stack task management platform with dynamic role-based access control (DRBAC), built with React + Supabase.

---

## ✨ Features

- **Role-Based Dashboards** — Separate UIs for Super Admin, Admin, and Member roles
- **Real-Time RBAC** — Roles enforced at database level via Supabase RLS policies
- **Task Management** — Create, assign, track, and update tasks with status workflows
- **User Management** — Super Admins can view all users and change roles instantly
- **Live Statistics** — Animated stat cards, progress bars, and completion tracking
- **Premium UI/UX** — Glassmorphism, ambient lighting, micro-animations, and responsive design

---

## 🎨 Design System & UI Changes (v2.0)

### Typography
- **Primary Font**: `Inter` — Premium sans-serif with optical sizing and OpenType features (`cv02`, `cv03`, `cv04`, `cv11`)
- **Display Font**: `Syne` — Bold, modern display face for headings and brand elements
- **Monospace Font**: `JetBrains Mono` — For code-like elements and status badges
- Replaced `Outfit` font with `Inter` across all components for a more refined, readable look
- Increased base font size from 13px → 15px body, with proper typographic scale
- Added negative letter-spacing (`-0.01em` to `-0.03em`) for tighter, more professional headings

### Spacing & Layout
- Increased card padding from `20px` → `24-26px` for more breathing room
- Larger gaps between grid items (`12px` → `16px`)
- More generous header margins (`32px` → `40px`)
- Stat card values scaled up from `26-30px` → `30-34px`
- Filter buttons enlarged from `7px 14px` → `9px 18px` padding
- Progress bars thickened from `6px` → `8-10px` height

### Visual Effects
- **Glassmorphism Cards**: `backdrop-filter: blur(24px) saturate(180%)` with subtle borders
- **Ambient Grid**: Faint accent-colored grid pattern overlay on all dashboard backgrounds
- **Noise Texture**: Subtle SVG noise overlay for depth and texture
- **Glow Effects**: Pulsing dot indicators with multi-layered `box-shadow` glows
- **Hover Animations**: Cards lift with `translateY(-1px)` and border glow on hover
- **Gradient Buttons**: Primary actions use smooth gradients with matching glow shadows
- **Smooth Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` for premium spring-like transitions

### Color Palette
- Refined text hierarchy: `#f0eeff` primary → `#9694b8` secondary → `#5c5a7a` muted
- Softer borders: `rgba(255,255,255,0.06)` instead of harsh `0.07-0.08`
- Enhanced accent glow: `0 0 16px` + `0 0 40px` dual-layer shadows on status dots
- Card backgrounds use `rgba(13, 13, 26, 0.92)` with blur for glass effect

### Auth Screen
- Triple-ring animated loading spinner with counter-rotating rings
- Labeled form fields with uppercase tracking labels
- Gradient submit button with matching accent glow shadow
- Input fields with focus ring animation (`box-shadow` transition)
- Footer text for trust signal ("Powered by Supabase")

### Component Improvements
- All dashboards now use CSS utility classes (`glass`, `glass-hover`, `noise`, `ambient-grid`)
- Consistent design tokens across Super Admin, Admin, and Member dashboards
- Smoother `AnimatePresence` transitions with proper easing curves
- Better empty state messaging with larger icons and contextual help text

---

## 🛠 Tech Stack

| Layer       | Technology                     |
|-------------|-------------------------------|
| Frontend    | React 18, Framer Motion       |
| Styling     | CSS Design System + Tailwind  |
| Backend     | Supabase (Auth, DB, RLS)      |
| Build       | Vite 5                        |
| Fonts       | Inter, Syne, JetBrains Mono   |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your Supabase URL and anon key

# Start development server
npm run dev
```

---

## 📁 Project Structure

```
src/
├── App.jsx                    # Auth flow + role routing
├── index.css                  # Premium design system (CSS custom properties)
├── main.jsx                   # React entry point
├── lib/
│   └── supabaseClient.js      # Supabase client config
├── hooks/
│   └── useRole.js             # Role detection hook
└── components/
    ├── SuperAdminDashboard.jsx # Full user + task management
    ├── AdminDashboard.jsx      # Task CRUD + assignment
    ├── AdminTaskCreator.jsx    # Task creation form
    └── MemberDashboard.jsx     # Task viewing + status updates
```

---

## 🔐 Role Hierarchy

| Role         | Capabilities                                       |
|-------------|---------------------------------------------------|
| Super Admin | View all users/tasks, change roles, full oversight |
| Admin       | Create tasks, assign to members, manage status     |
| Member      | View assigned tasks, update own task status         |

---

## 📄 License

MIT
