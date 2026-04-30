// src/App.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabaseClient';
import { useRole } from './hooks/useRole';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import AdminTaskCreator from './components/AdminTaskCreator';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading KaryaSync…</p>
      </motion.div>
    </div>
  );
}

function AuthForm() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState('login'); // 'login' | 'signup'
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

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
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tight mb-1">
            Karya<span className="text-violet-400">Sync</span>
          </h1>
          <p className="text-slate-400 text-sm">Role-based task management</p>
        </div>

        <div className="bg-[#111120] border border-white/10 rounded-2xl p-7 space-y-5">
          <div className="flex rounded-xl bg-[#0c0c14] p-1 gap-1">
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p key="suc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address" required
              className="w-full bg-[#0c0c14] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required
              className="w-full bg-[#0c0c14] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            <button
              type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              {loading ? '…' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function MemberView({ onSignOut }) {
  return (
    <div className="min-h-screen bg-[#0c0c14] text-slate-100 p-6 md:p-10">
      <div className="max-w-xl mx-auto text-center mt-20">
        <span className="text-5xl mb-6 block">👤</span>
        <h2 className="text-2xl font-bold text-white mb-3">Member Dashboard</h2>
        <p className="text-slate-400 text-sm mb-8">
          You can view and update tasks assigned to you. Contact an Admin to get tasks assigned.
        </p>
        <button onClick={onSignOut} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [session,     setSession]     = useState(undefined); // undefined = loading
  const { role, isLoading: roleLoading } = useRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Loading
  if (session === undefined || (session && roleLoading)) return <LoadingScreen />;

  // Not authenticated
  if (!session) return <AuthForm />;

  // Authenticated — render by role
  return (
    <AnimatePresence mode="wait">
      {role === 'super_admin' && (
        <motion.div key="super-admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="absolute top-4 right-4 z-50">
            <button onClick={handleSignOut} className="text-xs text-slate-500 hover:text-slate-300 transition-colors bg-[#111120] border border-white/10 px-3 py-1.5 rounded-lg">
              Sign out
            </button>
          </div>
          <SuperAdminDashboard />
        </motion.div>
      )}
      {role === 'admin' && (
        <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="absolute top-4 right-4 z-50">
            <button onClick={handleSignOut} className="text-xs text-slate-500 hover:text-slate-300 transition-colors bg-[#111120] border border-white/10 px-3 py-1.5 rounded-lg">
              Sign out
            </button>
          </div>
          <AdminTaskCreator />
        </motion.div>
      )}
      {role === 'member' && (
        <motion.div key="member" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <MemberView onSignOut={handleSignOut} />
        </motion.div>
      )}
      {!role && !roleLoading && (
        <motion.div key="no-role" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="min-h-screen bg-[#0c0c14] flex items-center justify-center text-slate-400 text-sm">
          Unable to determine role. <button onClick={handleSignOut} className="ml-2 underline">Sign out</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
