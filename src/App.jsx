import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './lib/supabaseClient';
import { useRole } from './hooks/useRole';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import AdminDashboard from './components/AdminDashboard';
import MemberDashboard from './components/MemberDashboard';

function LoadingScreen() {
  return (
    <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="loader" style={{ margin: '0 auto 18px' }} />
        <div className="brand-mark" style={{ justifyContent: 'center' }}>
          <span className="brand-badge">K</span>
          <span>KaryaSync</span>
        </div>
        <p className="subtitle" style={{ marginTop: 10 }}>Preparing your workspace</p>
      </div>
    </div>
  );
}

function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === 'signup') setSuccess('Account created. Check your email to confirm access.');
  };

  return (
    <main className="auth-wrap">
      <section className="auth-story">
        <div className="brand-mark">
          <span className="brand-badge">K</span>
          <span>KaryaSync</span>
        </div>

        <div>
          <p className="eyebrow">Role-based operations suite</p>
          <h1 className="title" style={{ maxWidth: 760 }}>Coordinate work with premium control and clear accountability.</h1>
          <p className="subtitle">
            A focused task command center for super admins, admins, and members. Built for assignment clarity,
            progress tracking, and secure access.
          </p>
        </div>

        <div className="metric-strip">
          <div className="metric">
            <div className="stat-label">Access</div>
            <div className="stat-note">Dynamic role routing</div>
          </div>
          <div className="metric">
            <div className="stat-label">Workflows</div>
            <div className="stat-note">Admin to member tasks</div>
          </div>
          <div className="metric">
            <div className="stat-label">Security</div>
            <div className="stat-note">Supabase protected</div>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <motion.div
          className="auth-card-inner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div style={{ marginBottom: 26 }}>
            <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create access'}</p>
            <h2 className="panel-title" style={{ fontSize: 28, marginTop: 8 }}>
              {mode === 'login' ? 'Sign in to workspace' : 'Start a new account'}
            </h2>
            <p className="subtitle" style={{ fontSize: 14 }}>Use your approved workspace email.</p>
          </div>

          <div className="segmented" style={{ marginBottom: 22 }}>
            <button className={`segment ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(null); setSuccess(null); }}>
              Log in
            </button>
            <button className={`segment ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}>
              Sign up
            </button>
          </div>

          <AnimatePresence mode="wait">
            {error && <motion.div className="toast" initial={{ opacity: 0, y: -8, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0 }}>{error}</motion.div>}
            {success && <motion.div className="toast" initial={{ opacity: 0, y: -8, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0 }}>{success}</motion.div>}
          </AnimatePresence>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label className="label">Email</label>
              <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Authenticating' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const { role, isLoading: roleLoading } = useRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => setSession(activeSession));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, activeSession) => setSession(activeSession));
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined || (session && roleLoading)) return <LoadingScreen />;
  if (!session) return <AuthForm />;

  return (
    <AnimatePresence mode="wait">
      {role === 'super_admin' && (
        <motion.div key="super-admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <SuperAdminDashboard onSignOut={handleSignOut} />
        </motion.div>
      )}
      {role === 'admin' && (
        <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <AdminDashboard onSignOut={handleSignOut} />
        </motion.div>
      )}
      {role === 'member' && (
        <motion.div key="member" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <MemberDashboard onSignOut={handleSignOut} />
        </motion.div>
      )}
      {!role && !roleLoading && (
        <div className="app-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="panel" style={{ maxWidth: 460, padding: 24, textAlign: 'center' }}>
            <h2 className="panel-title">Role not assigned</h2>
            <p className="subtitle">Please contact your administrator to assign your workspace role.</p>
            <button className="btn" onClick={handleSignOut} style={{ marginTop: 18 }}>Sign out</button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
