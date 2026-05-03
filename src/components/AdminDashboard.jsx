// src/components/AdminDashboard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_META = {
  pending:     { label: 'Pending',     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
  in_progress: { label: 'In Progress', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)' },
  completed:   { label: 'Completed',   color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  cancelled:   { label: 'Cancelled',   color: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.3)' },
};

const INITIAL_FORM = { title: '', description: '', assigned_to: '', status: 'pending' };

function StatusPill({ status, small }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 99, padding: small ? '2px 8px' : '4px 12px', fontSize: small ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, boxShadow: `0 0 5px ${m.color}`, display: 'inline-block' }} />
      {m.label}
    </span>
  );
}

function Avatar({ name, email, size = 28 }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase();
  const hue = [...(email || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: `hsl(${hue},50%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif' }}>
      {initials}
    </div>
  );
}

export default function AdminDashboard({ onSignOut }) {
  const [tasks,      setTasks]      = useState([]);
  const [members,    setMembers]    = useState([]);
  const [session,    setSession]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updating,   setUpdating]   = useState(null);
  const [toast,      setToast]      = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(INITIAL_FORM);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      if (!s) { setLoading(false); return; }
      const [tRes, mRes] = await Promise.all([
        supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)').eq('created_by', s.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'member').order('full_name'),
      ]);
      if (!mounted) return;
      setTasks(tRes.data ?? []);
      setMembers(mRes.data ?? []);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((type, text) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 3000);
  }, []);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('error', 'Task title is required.'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from('tasks').insert([{
      title: form.title.trim(),
      description: form.description.trim() || null,
      created_by: session.user.id,
      assigned_to: form.assigned_to || null,
      status: form.status,
    }]).select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)').single();
    setSubmitting(false);
    if (error) { showToast('error', error.message); return; }
    setTasks(prev => [data, ...prev]);
    setForm(INITIAL_FORM);
    setShowForm(false);
    showToast('success', 'Task created!');
  }, [form, session, showToast]);

  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    setUpdating(taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setUpdating(null);
    if (error) { showToast('error', error.message); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }, [showToast]);

  const handleDelete = useCallback(async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { showToast('error', error.message); return; }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    showToast('success', 'Task deleted.');
  }, [showToast]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
  }), [tasks]);

  const filtered = useMemo(() =>
    filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus)
  , [tasks, filterStatus]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '2px solid rgba(251,191,36,0.15)', borderTop: '2px solid #fbbf24', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6e6e9a', fontSize: 13 }}>Loading…</p>
    </div>
  );

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ position: 'fixed', top: -200, right: '20%', width: 500, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16, x: '-50%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 20, left: '50%', zIndex: 9999, background: toast.type === 'success' ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)', border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(251,113,133,0.35)'}`, color: toast.type === 'success' ? '#34d399' : '#fb7185', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(20px)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' ? '✓ ' : '✕ '}{toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 10px #fbbf24', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin · Task Manager</span>
            </div>
            <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: '#f1f0ff', lineHeight: 1.1 }}>My Dashboard</h1>
            <p style={{ color: '#6e6e9a', fontSize: 13, marginTop: 6 }}>{stats.total} tasks created · {completionRate}% completed</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <motion.button onClick={() => setShowForm(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              style={{ background: '#fbbf24', color: '#000', border: 'none', borderRadius: 11, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: 6 }}>
              + New Task
            </motion.button>
            <button onClick={onSignOut}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6e6e9a', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>
              Sign out
            </button>
          </div>
        </motion.div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
          {[['Total', stats.total, '#f1f0ff', '📋'], ['Pending', stats.pending, '#fbbf24', '⏳'], ['Active', stats.inProgress, '#818cf8', '⚡'], ['Done', stats.completed, '#34d399', '✅'], ['Cancelled', stats.cancelled, '#fb7185', '❌']].map(([l, v, c, icon], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ background: 'rgba(14,14,28,0.95)', border: `1px solid ${filterStatus === (l.toLowerCase().replace(' ','_')) ? c + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '16px 18px', cursor: l !== 'Total' ? 'pointer' : 'default', transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}
              onClick={() => l !== 'Total' && setFilterStatus(filterStatus === l.toLowerCase().replace(' ','_') ? 'all' : l.toLowerCase().replace(' ','_'))}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 60, height: 60, borderRadius: '50%', background: c, opacity: 0.08, filter: 'blur(18px)' }} />
              <div style={{ fontSize: 16, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Syne', color: c, lineHeight: 1, marginBottom: 4 }}>{v}</div>
              <div style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        {stats.total > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#f1f0ff' }}>Task Progress</span>
              <span style={{ fontSize: 13, color: '#34d399', fontWeight: 700 }}>{completionRate}% complete</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
              {[['#fbbf24', stats.pending], ['#818cf8', stats.inProgress], ['#34d399', stats.completed], ['#fb7185', stats.cancelled]].map(([c, v], i) => (
                <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${(v / stats.total) * 100}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                  style={{ height: '100%', background: c }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['all', 'All Tasks'], ...STATUS_OPTIONS.map(s => [s, STATUS_META[s].label])].map(([val, label]) => {
            const m = STATUS_META[val];
            const isActive = filterStatus === val;
            return (
              <button key={val} onClick={() => setFilterStatus(val)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${isActive && m ? m.border : 'rgba(255,255,255,0.07)'}`, background: isActive && m ? m.bg : (isActive ? 'rgba(124,92,252,0.1)' : 'transparent'), color: isActive && m ? m.color : (isActive ? '#a78bfa' : '#6e6e9a'), fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Outfit' }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6e6e9a' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#4a4a6a', marginBottom: 8 }}>No tasks here yet</div>
              <button onClick={() => setShowForm(true)} style={{ background: '#fbbf24', color: '#000', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                Create your first task
              </button>
            </div>
          )}
          {filtered.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              style={{ background: 'rgba(14,14,28,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f0ff', marginBottom: 3 }}>{task.title}</div>
                {task.description && <div style={{ fontSize: 12, color: '#6e6e9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{task.description}</div>}
              </div>
              {/* Assignee */}
              {task.assignee ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar name={task.assignee?.full_name} email={task.assignee?.email} />
                  <span style={{ fontSize: 12, color: '#8080a0' }}>{task.assignee?.full_name || task.assignee?.email}</span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: '#4a4a6a', fontStyle: 'italic' }}>Unassigned</span>
              )}
              <StatusPill status={task.status} small />
              {/* Status changer */}
              <select value={task.status} onChange={e => handleStatusUpdate(task.id, e.target.value)} disabled={updating === task.id}
                style={{ background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0c0', borderRadius: 8, padding: '5px 8px', fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit', opacity: updating === task.id ? 0.5 : 1 }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              {/* Delete */}
              <button onClick={() => handleDelete(task.id)}
                style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)', color: '#fb7185', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.target.style.background = 'rgba(251,113,133,0.18)'; }} onMouseLeave={e => { e.target.style.background = 'rgba(251,113,133,0.08)'; }}>
                Delete
              </button>
              <span style={{ fontSize: 11, color: '#4a4a6a' }}>{new Date(task.created_at).toLocaleDateString()}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, width: '100%', maxWidth: 520, background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px 32px', fontFamily: 'Outfit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: '#f1f0ff' }}>New Task</h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#6e6e9a', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Task Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Update landing page copy"
                    style={{ width: '100%', background: '#07070f', border: '1px solid rgba(255,255,255,0.09)', color: '#f1f0ff', borderRadius: 10, padding: '11px 14px', fontSize: 13, outline: 'none', fontFamily: 'Outfit' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Optional details…"
                    style={{ width: '100%', background: '#07070f', border: '1px solid rgba(255,255,255,0.09)', color: '#f1f0ff', borderRadius: 10, padding: '11px 14px', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'Outfit' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Assign To</label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                    style={{ width: '100%', background: '#07070f', border: '1px solid rgba(255,255,255,0.09)', color: '#f1f0ff', borderRadius: 10, padding: '11px 14px', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'Outfit' }}>
                    <option value="">— Unassigned —</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name ? `${m.full_name} (${m.email})` : m.email}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6e6e9a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Status</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {STATUS_OPTIONS.map(s => {
                      const m = STATUS_META[s];
                      const active = form.status === s;
                      return (
                        <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                          style={{ padding: '9px 12px', borderRadius: 9, border: `1px solid ${active ? m.border : 'rgba(255,255,255,0.07)'}`, background: active ? m.bg : 'transparent', color: active ? m.color : '#6e6e9a', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Outfit' }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  style={{ background: '#fbbf24', color: '#000', border: 'none', borderRadius: 11, padding: '13px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Syne', marginTop: 4, opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {submitting ? (<><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Creating…</>) : '+ Create Task'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
