// src/App.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabaseClient';
import { useRole } from './hooks/useRole';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import AdminDashboard from './components/AdminDashboard';
import MemberDashboard from './components/MemberDashboard';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>
      <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(124,92,252,0.1)', borderTop: '2px solid #7c5cfc', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 8, border: '2px solid rgba(124,92,252,0.05)', borderBottom: '2px solid rgba(124,92,252,0.4)', borderRadius: '50%', animation: 'spin 1.4s linear infinite reverse' }} />
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#f1f0ff' }}>Karya<span style={{ color: '#7c5cfc' }}>Sync</span></div>
      <p style={{ fontFamily: 'Outfit, sans-serif', color: '#6e6e9a', fontSize: 13 }}>Loading your workspace…</p>
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    let result;
    if (mode === 'signup') {
      result = await supabase.auth.signUp({ email, password });
      if (!result.error) setSuccess('Check your email to confirm your account!');
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    setLoading(false);
    if (result.error) setError(result.error.message);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Outfit, sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c5cfc', boxShadow: '0 0 16px #7c5cfc' }} />
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 900, color: '#f1f0ff', margin: 0 }}>
              Karya<span style={{ color: '#7c5cfc' }}>Sync</span>
            </h1>
          </div>
          <p style={{ color: '#6e6e9a', fontSize: 13, margin: 0 }}>Role-based task management</p>
        </div>

        <div style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 28px', backdropFilter: 'blur(20px)' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#07070f', borderRadius: 12, padding: 4, gap: 4, marginBottom: 24 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s', background: mode === m ? '#7c5cfc' : 'transparent', color: mode === m ? '#fff' : '#6e6e9a', fontFamily: 'Outfit' }}>
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.25)', color: '#fb7185', borderRadius: 10, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div key="suc" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', borderRadius: 10, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required
              style={{ background: '#07070f', border: '1px solid rgba(255,255,255,0.09)', color: '#f1f0ff', borderRadius: 11, padding: '12px 16px', fontSize: 13, outline: 'none', fontFamily: 'Outfit', width: '100%' }}
              onFocus={e => e.target.style.borderColor = 'rgba(124,92,252,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required
              style={{ background: '#07070f', border: '1px solid rgba(255,255,255,0.09)', color: '#f1f0ff', borderRadius: 11, padding: '12px 16px', fontSize: 13, outline: 'none', fontFamily: 'Outfit', width: '100%' }}
              onFocus={e => e.target.style.borderColor = 'rgba(124,92,252,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'} />
            <button type="submit" disabled={loading}
              style={{ background: '#7c5cfc', color: '#fff', border: 'none', borderRadius: 11, padding: '13px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Syne, sans-serif', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              {loading ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Loading…</> : (mode === 'login' ? 'Log In' : 'Create Account')}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const { role, isLoading: roleLoading } = useRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  if (session === undefined || (session && roleLoading)) return <LoadingScreen />;
  if (!session) return <AuthForm />;

  return (
    <AnimatePresence mode="wait">
      {role === 'super_admin' && (
        <motion.div key="sa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <SuperAdminDashboard onSignOut={handleSignOut} />
        </motion.div>
      )}
      {role === 'admin' && (
        <motion.div key="ad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <AdminDashboard onSignOut={handleSignOut} />
        </motion.div>
      )}
      {role === 'member' && (
        <motion.div key="mb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <MemberDashboard onSignOut={handleSignOut} />
        </motion.div>
      )}
      {!role && !roleLoading && (
        <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, fontFamily: 'Outfit', color: '#6e6e9a', fontSize: 14 }}>
          <span>Could not determine role.</span>
          <button onClick={handleSignOut} style={{ color: '#7c5cfc', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>Sign out</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
