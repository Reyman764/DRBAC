// src/components/SuperAdminDashboard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const ROLES = ['member', 'admin', 'super_admin'];
const ROLE_META = {
  super_admin: { label: 'Super Admin', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  admin:       { label: 'Admin',       color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  member:      { label: 'Member',      color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
};
const STATUS_META = {
  pending:     { label: 'Pending',     color: '#fbbf24' },
  in_progress: { label: 'In Progress', color: '#818cf8' },
  completed:   { label: 'Completed',   color: '#34d399' },
  cancelled:   { label: 'Cancelled',   color: '#fb7185' },
};

function Avatar({ name, email, size = 36 }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase();
  const hue = [...(email || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%',
      background: `linear-gradient(135deg, hsl(${hue},55%,35%), hsl(${hue+30},55%,25%))`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
      border: `1.5px solid hsl(${hue},50%,45%)`, fontFamily: 'Syne, sans-serif' }}>
      {initials}
    </div>
  );
}

function StatCard({ label, value, icon, color, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.08, duration: 0.4 }}
      style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: color, opacity: 0.1, filter: 'blur(25px)', pointerEvents: 'none' }} />
      <div style={{ fontSize: 20, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Syne, sans-serif', color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
    </motion.div>
  );
}

function RolePill({ role }) {
  const m = ROLE_META[role] || ROLE_META.member;
  return (
    <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {m.label}
    </span>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: m.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block', boxShadow: `0 0 6px ${m.color}80` }} />
      {m.label}
    </span>
  );
}

export default function SuperAdminDashboard({ onSignOut }) {
  const [users,      setUsers]      = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [updating,   setUpdating]   = useState(null);
  const [toast,      setToast]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [tab,        setTab]        = useState('users');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [pRes, tRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('id, title, description, status, created_at, created_by, assigned_to').order('created_at', { ascending: false }),
      ]);
      if (!mounted) return;
      if (pRes.error || tRes.error) { setError((pRes.error || tRes.error).message); }
      else { setUsers(pRes.data ?? []); setTasks(tRes.data ?? []); }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleRoleChange = useCallback(async (userId, newRole) => {
    setUpdating(userId);
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUpdating(null);
    if (error) { showToast('error', error.message); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    showToast('success', `Role updated to ${ROLE_META[newRole]?.label}`);
  }, [showToast]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const members = users.filter(u => u.role === 'member').length;
    const superAdmins = users.filter(u => u.role === 'super_admin').length;
    const totalTasks = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const cancelled = tasks.filter(t => t.status === 'cancelled').length;
    return { total, admins, members, superAdmins, totalTasks, pending, inProgress, completed, cancelled };
  }, [users, tasks]);

  const filteredUsers = useMemo(() => {
    let list = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);
    if (search.trim()) list = list.filter(u =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [users, roleFilter, search]);

  const getUserTaskStats = useCallback((uid) => {
    const assigned = tasks.filter(t => t.assigned_to === uid);
    return {
      assigned: assigned.length,
      completed: assigned.filter(t => t.status === 'completed').length,
      inProgress: assigned.filter(t => t.status === 'in_progress').length,
      pending: assigned.filter(t => t.status === 'pending').length,
    };
  }, [tasks]);

  const getUserTaskList = useCallback((uid) => tasks.filter(t => t.assigned_to === uid), [tasks]);

  // Enrich tasks with user info
  const enrichedTasks = useMemo(() => tasks.map(t => ({
    ...t,
    assigneeName: users.find(u => u.id === t.assigned_to)?.full_name || users.find(u => u.id === t.assigned_to)?.email || '—',
    creatorName: users.find(u => u.id === t.created_by)?.full_name || users.find(u => u.id === t.created_by)?.email || '—',
  })), [tasks, users]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '2px solid rgba(124,92,252,0.15)', borderTop: '2px solid #7c5cfc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6e6e9a', fontSize: 13 }}>Loading…</p>
    </div>
  );

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.completed / stats.totalTasks) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', fontFamily: 'Outfit, sans-serif' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: -200, left: '30%', width: 500, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16, x: '-50%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 20, left: '50%', zIndex: 9999, background: toast.type === 'success' ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)', border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(251,113,133,0.35)'}`, color: toast.type === 'success' ? '#34d399' : '#fb7185', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(20px)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' ? '✓ ' : '✕ '}{toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c5cfc', boxShadow: '0 0 10px #7c5cfc', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#7c5cfc', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Super Admin · Control Center</span>
            </div>
            <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: '#f1f0ff', lineHeight: 1.1 }}>KaryaSync Overview</h1>
            <p style={{ color: '#6e6e9a', fontSize: 13, marginTop: 6 }}>{users.length} users · {tasks.length} tasks total</p>
          </div>
          <button onClick={onSignOut}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6e6e9a', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>
            Sign out
          </button>
        </motion.div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="Total Users"  value={stats.total}      icon="👥" color="#a78bfa" delay={0} />
          <StatCard label="Admins"       value={stats.admins}     icon="🛡" color="#fbbf24" delay={1} />
          <StatCard label="Members"      value={stats.members}    icon="👤" color="#34d399" delay={2} />
          <StatCard label="Total Tasks"  value={stats.totalTasks} icon="📋" color="#818cf8" delay={3} />
          <StatCard label="Completed"    value={stats.completed}  icon="✅" color="#34d399" delay={4} />
          <StatCard label="Completion"   value={`${completionRate}%`} icon="📈" color="#fbbf24" delay={5} />
        </div>

        {/* Progress breakdown */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <span style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#f1f0ff' }}>Platform Task Distribution</span>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {[['Pending', '#fbbf24', stats.pending], ['Active', '#818cf8', stats.inProgress], ['Done', '#34d399', stats.completed], ['Cancelled', '#fb7185', stats.cancelled]].map(([l, c, v]) => (
                <span key={l} style={{ fontSize: 11, color: c, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l} ({v})
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
            {stats.totalTasks > 0 && [['#fbbf24', stats.pending], ['#818cf8', stats.inProgress], ['#34d399', stats.completed], ['#fb7185', stats.cancelled]].map(([color, val], i) => (
              <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${stats.totalTasks > 0 ? (val / stats.totalTasks) * 100 : 0}%` }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.7, ease: 'easeOut' }}
                style={{ height: '100%', background: color }} />
            ))}
          </div>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(14,14,28,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {[['users', '👥 Users'], ['tasks', '📋 All Tasks']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 22px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: tab === t ? '#7c5cfc' : 'transparent', color: tab === t ? '#fff' : '#6e6e9a', fontFamily: 'Outfit' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search name or email…"
                style={{ flex: 1, minWidth: 200, background: 'rgba(14,14,28,0.9)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f0ff', borderRadius: 10, padding: '9px 14px', fontSize: 13, outline: 'none', fontFamily: 'Outfit' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'super_admin', 'admin', 'member'].map(f => {
                  const m = ROLE_META[f];
                  const isActive = roleFilter === f;
                  return (
                    <button key={f} onClick={() => setRoleFilter(f)}
                      style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${isActive ? (m?.border || 'rgba(167,139,250,0.4)') : 'rgba(255,255,255,0.07)'}`, background: isActive ? (m?.bg || 'rgba(167,139,250,0.12)') : 'transparent', color: isActive ? (m?.color || '#a78bfa') : '#6e6e9a', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Outfit', textTransform: f === 'all' ? 'capitalize' : 'none' }}>
                      {f === 'all' ? 'All' : m?.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredUsers.length === 0 && <div style={{ textAlign: 'center', padding: '50px 0', color: '#6e6e9a', fontSize: 14 }}>No users match your filters.</div>}
              {filteredUsers.map((user, i) => {
                const ts = getUserTaskStats(user.id);
                const ut = getUserTaskList(user.id);
                const isExpanded = expandedId === user.id;
                const pct = ts.assigned > 0 ? Math.round((ts.completed / ts.assigned) * 100) : 0;
                return (
                  <motion.div key={user.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ background: 'rgba(14,14,28,0.95)', border: `1px solid ${isExpanded ? 'rgba(124,92,252,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    {/* Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap' }}
                      onClick={() => setExpandedId(isExpanded ? null : user.id)}>
                      <Avatar name={user.full_name} email={user.email} />
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f0ff' }}>{user.full_name || <span style={{ color: '#6e6e9a', fontStyle: 'italic' }}>No name</span>}</div>
                        <div style={{ fontSize: 12, color: '#6e6e9a', marginTop: 2 }}>{user.email}</div>
                      </div>
                      {/* Mini task stats */}
                      <div style={{ display: 'flex', gap: 20 }}>
                        {[['Assigned', ts.assigned, '#818cf8'], ['Done', ts.completed, '#34d399'], ['Active', ts.inProgress, '#fbbf24']].map(([l, v, c]) => (
                          <div key={l} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne', color: c }}>{v}</div>
                            <div style={{ fontSize: 10, color: '#6e6e9a', letterSpacing: '0.04em' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                      {/* Progress */}
                      <div style={{ width: 60, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne', color: pct === 100 ? '#34d399' : '#f1f0ff' }}>{pct}%</div>
                        <div style={{ fontSize: 10, color: '#6e6e9a' }}>Done</div>
                      </div>
                      <RolePill role={user.role} />
                      <select value={user.role} onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); handleRoleChange(user.id, e.target.value); }}
                        disabled={updating === user.id}
                        style={{ background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0c0', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit', opacity: updating === user.id ? 0.5 : 1 }}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label}</option>)}
                      </select>
                      <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ color: '#6e6e9a', fontSize: 10, userSelect: 'none', display: 'inline-block' }}>▼</motion.span>
                    </div>

                    {/* Expanded tasks */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ padding: '16px 18px' }}>
                            <div style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                              Assigned Tasks ({ut.length})
                            </div>
                            {ut.length === 0
                              ? <p style={{ fontSize: 13, color: '#6e6e9a', fontStyle: 'italic' }}>No tasks assigned yet.</p>
                              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {ut.slice(0, 6).map(t => (
                                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '9px 14px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 500, color: '#d0cff0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                    </div>
                                    <StatusPill status={t.status} />
                                    <span style={{ fontSize: 11, color: '#4a4a6a' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                                  </div>
                                ))}
                                {ut.length > 6 && <div style={{ fontSize: 12, color: '#6e6e9a', padding: '4px 2px' }}>+{ut.length - 6} more tasks</div>}
                              </div>
                            }
                            {ut.length > 0 && (
                              <div style={{ marginTop: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6e6e9a', marginBottom: 6 }}>
                                  <span>Completion rate</span>
                                  <span style={{ color: '#34d399', fontWeight: 700 }}>{pct}%</span>
                                </div>
                                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.1, duration: 0.7, ease: 'easeOut' }}
                                    style={{ height: '100%', background: 'linear-gradient(90deg, #34d399, #10b981)', borderRadius: 99 }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Tasks tab */}
        {tab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enrichedTasks.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: '#6e6e9a', fontSize: 14 }}>No tasks found.</div>}
            {enrichedTasks.map((task, i) => (
              <motion.div key={task.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f0ff', marginBottom: 3 }}>{task.title}</div>
                  {task.description && <div style={{ fontSize: 12, color: '#6e6e9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{task.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, color: '#6e6e9a' }}>
                    <span style={{ color: '#4a4a7a' }}>by </span>
                    <span style={{ color: '#a0a0c0' }}>{task.creatorName}</span>
                  </div>
                  {task.assigned_to && (
                    <div style={{ fontSize: 12, color: '#6e6e9a' }}>
                      <span style={{ color: '#4a4a7a' }}>→ </span>
                      <span style={{ color: '#a0a0c0' }}>{task.assigneeName}</span>
                    </div>
                  )}
                  <StatusPill status={task.status} />
                  <span style={{ fontSize: 11, color: '#4a4a6a' }}>{new Date(task.created_at).toLocaleDateString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
