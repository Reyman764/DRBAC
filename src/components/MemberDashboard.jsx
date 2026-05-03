// src/components/MemberDashboard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_META = {
  pending:     { label: 'Pending',     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  icon: '⏳' },
  in_progress: { label: 'In Progress', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', icon: '⚡' },
  completed:   { label: 'Completed',   color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  icon: '✅' },
  cancelled:   { label: 'Cancelled',   color: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.3)', icon: '❌' },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, boxShadow: `0 0 5px ${m.color}`, display: 'inline-block' }} />
      {m.label}
    </span>
  );
}

function Avatar({ name, email, size = 36 }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase();
  const hue = [...(email || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: `hsl(${hue},50%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif' }}>
      {initials}
    </div>
  );
}

export default function MemberDashboard({ onSignOut }) {
  const [tasks,    setTasks]    = useState([]);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [activeTask, setActiveTask] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) { setLoading(false); return; }
      const [tRes, pRes] = await Promise.all([
        supabase.from('tasks').select('*, creator:profiles!tasks_created_by_fkey(full_name, email)').eq('assigned_to', session.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      ]);
      if (!mounted) return;
      setTasks(tRes.data ?? []);
      setProfile(pRes.data);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((type, text) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 3000);
  }, []);

  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    setUpdating(taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setUpdating(null);
    if (error) { showToast('error', error.message); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setActiveTask(prev => prev?.id === taskId ? { ...prev, status: newStatus } : prev);
    showToast('success', `Marked as ${STATUS_META[newStatus]?.label}`);
  }, [showToast]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
  }), [tasks]);

  const filtered = useMemo(() =>
    filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  , [tasks, filter]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '2px solid rgba(52,211,153,0.15)', borderTop: '2px solid #34d399', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6e6e9a', fontSize: 13 }}>Loading your workspace…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ position: 'fixed', top: -200, left: '50%', width: 500, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16, x: '-50%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 20, left: '50%', zIndex: 9999, background: toast.type === 'success' ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)', border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(251,113,133,0.35)'}`, color: toast.type === 'success' ? '#34d399' : '#fb7185', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(20px)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' ? '✓ ' : '✕ '}{toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {profile && <Avatar name={profile.full_name} email={profile.email} size={52} />}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
                <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Member · My Tasks</span>
              </div>
              <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, color: '#f1f0ff', lineHeight: 1.1 }}>
                {profile?.full_name ? `Hey, ${profile.full_name.split(' ')[0]} 👋` : 'My Workspace'}
              </h1>
              <p style={{ color: '#6e6e9a', fontSize: 13, marginTop: 4 }}>{stats.total} tasks assigned · {completionRate}% done</p>
            </div>
          </div>
          <button onClick={onSignOut}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6e6e9a', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>
            Sign out
          </button>
        </motion.div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[['Pending', stats.pending, '#fbbf24', '⏳'], ['In Progress', stats.inProgress, '#818cf8', '⚡'], ['Completed', stats.completed, '#34d399', '✅'], ['Cancelled', stats.cancelled, '#fb7185', '❌']].map(([l, v, c, icon], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              onClick={() => setFilter(filter === l.toLowerCase().replace(' ', '_') ? 'all' : l.toLowerCase().replace(' ', '_'))}
              style={{ background: 'rgba(14,14,28,0.95)', border: `1px solid ${filter === l.toLowerCase().replace(' ', '_') ? c + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '18px 18px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 60, height: 60, borderRadius: '50%', background: c, opacity: 0.08, filter: 'blur(18px)' }} />
              <div style={{ fontSize: 18, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Syne', color: c, lineHeight: 1, marginBottom: 4 }}>{v}</div>
              <div style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
            </motion.div>
          ))}
        </div>

        {/* Progress */}
        {stats.total > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#f1f0ff' }}>Your Progress</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne', color: completionRate === 100 ? '#34d399' : '#f1f0ff' }}>{completionRate}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} transition={{ delay: 0.4, duration: 0.9, ease: 'easeOut' }}
                style={{ height: '100%', background: `linear-gradient(90deg, #34d399, #10b981)`, borderRadius: 99 }} />
            </div>
            {completionRate === 100 && stats.total > 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 13, color: '#34d399', marginTop: 10, fontWeight: 600 }}>
                🎉 All tasks complete! Great work.
              </motion.p>
            )}
          </motion.div>
        )}

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['all', 'All Tasks'], ...STATUS_OPTIONS.map(s => [s, STATUS_META[s].label])].map(([val, label]) => {
            const m = STATUS_META[val];
            const isActive = filter === val;
            return (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${isActive && m ? m.border : (isActive ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.07)')}`, background: isActive && m ? m.bg : (isActive ? 'rgba(52,211,153,0.1)' : 'transparent'), color: isActive && m ? m.color : (isActive ? '#34d399' : '#6e6e9a'), fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Outfit' }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '70px 20px', color: '#6e6e9a' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#4a4a6a', marginBottom: 8, fontFamily: 'Syne' }}>
                {filter === 'all' ? 'No tasks assigned yet' : `No ${STATUS_META[filter]?.label} tasks`}
              </div>
              <div style={{ fontSize: 13, color: '#6e6e9a' }}>
                {filter === 'all' ? 'Contact an admin to get tasks assigned to you.' : 'Try a different filter.'}
              </div>
            </motion.div>
          )}
          {filtered.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              style={{ background: 'rgba(14,14,28,0.95)', border: `1px solid ${activeTask?.id === task.id ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap' }}
                onClick={() => setActiveTask(activeTask?.id === task.id ? null : task)}>
                {/* Status indicator bar */}
                <div style={{ width: 3, height: 40, borderRadius: 99, background: STATUS_META[task.status]?.color || '#fbbf24', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f0ff', marginBottom: 3 }}>{task.title}</div>
                  {task.creator && <div style={{ fontSize: 11, color: '#6e6e9a' }}>Assigned by {task.creator.full_name || task.creator.email}</div>}
                </div>
                <StatusPill status={task.status} />
                <span style={{ fontSize: 11, color: '#4a4a6a' }}>{new Date(task.created_at).toLocaleDateString()}</span>
                <motion.span animate={{ rotate: activeTask?.id === task.id ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ color: '#6e6e9a', fontSize: 10, userSelect: 'none', display: 'inline-block' }}>▼</motion.span>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {activeTask?.id === task.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px 20px 36px' }}>
                      {task.description && (
                        <p style={{ fontSize: 13, color: '#8080a0', marginBottom: 16, lineHeight: 1.6 }}>{task.description}</p>
                      )}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Update Status</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {STATUS_OPTIONS.map(s => {
                            const m = STATUS_META[s];
                            const isActive = task.status === s;
                            return (
                              <button key={s} onClick={() => handleStatusUpdate(task.id, s)} disabled={updating === task.id || isActive}
                                style={{ padding: '8px 16px', borderRadius: 9, border: `1px solid ${isActive ? m.border : 'rgba(255,255,255,0.07)'}`, background: isActive ? m.bg : 'transparent', color: isActive ? m.color : '#6e6e9a', fontSize: 12, fontWeight: 600, cursor: isActive ? 'default' : 'pointer', transition: 'all 0.15s', fontFamily: 'Outfit', opacity: updating === task.id ? 0.6 : 1 }}>
                                {isActive && updating !== task.id ? `${m.icon} ` : ''}{m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
