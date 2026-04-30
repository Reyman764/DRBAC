// src/components/SuperAdminDashboard.jsx
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const ROLES = ['member', 'admin', 'super_admin'];

const ROLE_COLORS = {
  super_admin: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  admin:       'bg-amber-500/20  text-amber-300  border border-amber-500/30',
  member:      'bg-sky-500/20    text-sky-300    border border-sky-500/30',
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const rowVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function SuperAdminDashboard() {
  const [search,   setSearch]   = useState('');
  const [results,  setResults]  = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [updating, setUpdating] = useState(null); // user id being updated
  const [updateMsg, setUpdateMsg] = useState(null);

  // ── Search users by email ──────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!search.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    setUpdateMsg(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .ilike('email', `%${search.trim()}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    setIsSearching(false);

    if (error) {
      setSearchError(error.message);
      return;
    }
    setResults(data ?? []);
  }, [search]);

  // ── Promote user to admin ──────────────────────────────────
  const handlePromoteToAdmin = useCallback(async (userId, currentRole) => {
    if (currentRole === 'admin') return; // already admin
    setUpdating(userId);
    setUpdateMsg(null);

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId);

    setUpdating(null);

    if (error) {
      setUpdateMsg({ type: 'error', text: `Update failed: ${error.message}` });
      return;
    }

    // Optimistic UI update
    setResults(prev =>
      prev.map(u => u.id === userId ? { ...u, role: 'admin' } : u)
    );
    setUpdateMsg({ type: 'success', text: 'User promoted to Admin successfully.' });
  }, []);

  // ── Change role to any value ───────────────────────────────
  const handleRoleChange = useCallback(async (userId, newRole) => {
    setUpdating(userId);
    setUpdateMsg(null);

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    setUpdating(null);

    if (error) {
      setUpdateMsg({ type: 'error', text: `Update failed: ${error.message}` });
      return;
    }

    setResults(prev =>
      prev.map(u => u.id === userId ? { ...u, role: newRole } : u)
    );
    setUpdateMsg({ type: 'success', text: `Role updated to "${newRole}".` });
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c14] text-slate-100 font-sans p-6 md:p-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚡</span>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Super Admin <span className="text-violet-400">Dashboard</span>
          </h1>
        </div>
        <p className="text-slate-400 text-sm ml-9">
          Manage user roles across KaryaSync. Changes are enforced at the database level.
        </p>
      </motion.div>

      {/* Search Form */}
      <motion.form
        onSubmit={handleSearch}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="flex gap-3 mb-6"
      >
        <input
          type="email"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email address…"
          className="
            flex-1 bg-[#161622] border border-white/10 rounded-xl
            px-4 py-3 text-sm text-slate-100 placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-violet-500/50
            transition-all duration-200
          "
        />
        <button
          type="submit"
          disabled={isSearching || !search.trim()}
          className="
            bg-violet-600 hover:bg-violet-500 disabled:opacity-40
            text-white font-medium text-sm px-6 py-3 rounded-xl
            transition-all duration-200 active:scale-95
          "
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </motion.form>

      {/* Status Messages */}
      <AnimatePresence mode="wait">
        {searchError && (
          <motion.div
            key="search-err"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-sm"
          >
            {searchError}
          </motion.div>
        )}
        {updateMsg && (
          <motion.div
            key="update-msg"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
              updateMsg.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            {updateMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Table */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl overflow-hidden border border-white/10 bg-[#111120]"
        >
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              {results.length} user{results.length !== 1 ? 's' : ''} found
            </span>
          </div>

          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-white/5"
          >
            <AnimatePresence>
              {results.map(user => (
                <motion.li
                  key={user.id}
                  variants={rowVariants}
                  layout
                  className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(user.full_name || user.email)[0].toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user.full_name || '—'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>

                  {/* Current Role Badge */}
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>
                    {user.role.replace('_', ' ')}
                  </span>

                  {/* Role Selector */}
                  <select
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    disabled={updating === user.id}
                    className="
                      bg-[#1e1e2e] border border-white/10 text-slate-300
                      text-xs rounded-lg px-3 py-2
                      focus:outline-none focus:ring-2 focus:ring-violet-500/50
                      disabled:opacity-50 cursor-pointer
                    "
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>

                  {/* Promote to Admin Button */}
                  <button
                    onClick={() => handlePromoteToAdmin(user.id, user.role)}
                    disabled={updating === user.id || user.role === 'admin'}
                    className="
                      text-xs font-medium px-4 py-2 rounded-lg
                      bg-amber-600/20 hover:bg-amber-600/40 text-amber-300
                      border border-amber-500/30 disabled:opacity-30
                      transition-all duration-200 active:scale-95 whitespace-nowrap
                    "
                  >
                    {updating === user.id ? '…' : 'Promote to Admin'}
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </motion.div>
      )}

      {results.length === 0 && !isSearching && search && !searchError && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center text-slate-500 text-sm mt-12"
        >
          No users found matching "<span className="text-slate-300">{search}</span>"
        </motion.p>
      )}
    </div>
  );
}
