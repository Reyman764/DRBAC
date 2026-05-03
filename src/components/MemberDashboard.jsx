import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--amber)' },
  in_progress: { label: 'In progress', color: 'var(--blue)' },
  completed: { label: 'Completed', color: 'var(--green)' },
  cancelled: { label: 'Cancelled', color: 'var(--red)' },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className="pill" style={{ '--pill-color': meta.color }}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

function Avatar({ name, email, size = 54 }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase();
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.32 }}>{initials}</div>;
}

function StatCard({ label, value, note, color, delay }) {
  return (
    <motion.div className="stat-card" style={{ '--accent': color, animationDelay: `${delay * 45}ms` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </motion.div>
  );
}

export default function MemberDashboard({ onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all');
  const [activeTask, setActiveTask] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) {
        setLoading(false);
        return;
      }
      const [taskResult, profileResult] = await Promise.all([
        supabase.from('tasks').select('*, creator:profiles!tasks_created_by_fkey(full_name, email)').eq('assigned_to', session.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      ]);
      if (!mounted) return;
      setTasks(taskResult.data ?? []);
      setProfile(profileResult.data);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    setUpdating(taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setUpdating(null);
    if (error) {
      showToast('error', error.message);
      return;
    }
    setTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, status: newStatus } : task));
    setActiveTask((prev) => prev?.id === taskId ? { ...prev, status: newStatus } : prev);
    showToast('success', `Marked as ${STATUS_META[newStatus]?.label}.`);
  }, [showToast]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
  }), [tasks]);

  const filtered = useMemo(() => (
    filter === 'all' ? tasks : tasks.filter((task) => task.status === filter)
  ), [tasks, filter]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const firstName = profile?.full_name?.split(' ')[0] || 'Workspace';

  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AnimatePresence>
        {toast && <motion.div className={`toast toast-${toast.type}`} initial={{ opacity: 0, y: -10, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0 }}>{toast.text}</motion.div>}
      </AnimatePresence>

      <main className="page">
        <div className="topbar">
          <div className="brand-mark">
            <span className="brand-badge">K</span>
            <span>KaryaSync</span>
          </div>
          <button className="btn" onClick={onSignOut}>Sign out</button>
        </div>

        <section className="hero-panel">
          <div className="hero-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {profile && <Avatar name={profile.full_name} email={profile.email} />}
              <div>
                <p className="eyebrow">Member workspace</p>
                <h1 className="title">{firstName}'s task board</h1>
                <p className="subtitle">{stats.total} assigned tasks with {completionRate}% completed.</p>
              </div>
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="stat-label">Personal completion</div>
              <div className="stat-value" style={{ color: completionRate === 100 ? 'var(--green)' : 'var(--gold-2)' }}>{completionRate}%</div>
              <div className="progress" style={{ marginTop: 14 }}>
                <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard label="Pending" value={stats.pending} note="Waiting to begin" color="var(--amber)" delay={0} />
            <StatCard label="Active" value={stats.inProgress} note="In motion" color="var(--blue)" delay={1} />
            <StatCard label="Completed" value={stats.completed} note="Delivered" color="var(--green)" delay={2} />
            <StatCard label="Cancelled" value={stats.cancelled} note="Closed out" color="var(--red)" delay={3} />
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Assigned tasks</h2>
              <div className="segmented">
                {[['all', 'All'], ...STATUS_OPTIONS.map((status) => [status, STATUS_META[status].label])].map(([value, label]) => (
                  <button key={value} className={`segment ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="list">
              {filtered.length === 0 && (
                <div className="empty">
                  <h3 className="panel-title">{filter === 'all' ? 'No tasks assigned yet' : 'No tasks match this filter'}</h3>
                  <p className="subtitle" style={{ margin: '8px auto 0' }}>{filter === 'all' ? 'Your admin-assigned work will appear here.' : 'Choose another status to keep scanning.'}</p>
                </div>
              )}

              {filtered.map((task) => {
                const expanded = activeTask?.id === task.id;
                return (
                  <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="row" style={{ cursor: 'pointer' }} onClick={() => setActiveTask(expanded ? null : task)}>
                      <div>
                        <div className="row-title">{task.title}</div>
                        <div className="row-subtitle">
                          Assigned by {task.creator?.full_name || task.creator?.email || 'Admin'} | {new Date(task.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="row-actions">
                        <StatusPill status={task.status} />
                        <button className="btn">{expanded ? 'Hide details' : 'View details'}</button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ padding: '0 20px 18px 20px' }}>
                            <p className="subtitle" style={{ marginBottom: 14 }}>{task.description || 'No description was added for this task.'}</p>
                            <div className="segmented">
                              {STATUS_OPTIONS.map((status) => (
                                <button
                                  type="button"
                                  key={status}
                                  className={`segment ${task.status === status ? 'active' : ''}`}
                                  onClick={() => handleStatusUpdate(task.id, status)}
                                  disabled={updating === task.id || task.status === status}
                                >
                                  {STATUS_META[status].label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
