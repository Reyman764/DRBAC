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

const INITIAL_FORM = { title: '', description: '', assigned_to: '', status: 'pending' };

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className="pill" style={{ '--pill-color': meta.color }}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

function Avatar({ name, email, size = 34 }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase();
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials}</div>;
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

export default function AdminDashboard({ onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(activeSession);
      if (!activeSession) {
        setLoading(false);
        return;
      }

      const [taskResult, memberResult] = await Promise.all([
        supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)').eq('created_by', activeSession.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'member').order('full_name'),
      ]);
      if (!mounted) return;
      setTasks(taskResult.data ?? []);
      setMembers(memberResult.data ?? []);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleCreate = useCallback(async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      showToast('error', 'Task title is required.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.from('tasks').insert([{
      title: form.title.trim(),
      description: form.description.trim() || null,
      created_by: session.user.id,
      assigned_to: form.assigned_to || null,
      status: form.status,
    }]).select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)').single();
    setSubmitting(false);
    if (error) {
      showToast('error', error.message);
      return;
    }
    setTasks((prev) => [data, ...prev]);
    setForm(INITIAL_FORM);
    setShowForm(false);
    showToast('success', 'Task created.');
  }, [form, session, showToast]);

  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    setUpdating(taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setUpdating(null);
    if (error) {
      showToast('error', error.message);
      return;
    }
    setTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, status: newStatus } : task));
  }, [showToast]);

  const handleDelete = useCallback(async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      showToast('error', error.message);
      return;
    }
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    showToast('success', 'Task deleted.');
  }, [showToast]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
  }), [tasks]);

  const filtered = useMemo(() => (
    filterStatus === 'all' ? tasks : tasks.filter((task) => task.status === filterStatus)
  ), [tasks, filterStatus]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

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
        {toast && <motion.div className="toast" initial={{ opacity: 0, y: -10, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0 }}>{toast.text}</motion.div>}
      </AnimatePresence>

      <main className="page">
        <div className="topbar">
          <div className="brand-mark">
            <span className="brand-badge">K</span>
            <span>KaryaSync</span>
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>New task</button>
            <button className="btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <section className="hero-panel">
          <div className="hero-panel-header">
            <div>
              <p className="eyebrow">Admin task manager</p>
              <h1 className="title">Command your team workload.</h1>
              <p className="subtitle">{stats.total} tasks created, {completionRate}% completed across your assigned workstream.</p>
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="stat-label">Completion rate</div>
              <div className="stat-value" style={{ color: 'var(--gold-2)' }}>{completionRate}%</div>
              <div className="progress" style={{ marginTop: 14 }}>
                <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard label="Total" value={stats.total} note="Created tasks" color="var(--text)" delay={0} />
            <StatCard label="Pending" value={stats.pending} note="Awaiting start" color="var(--amber)" delay={1} />
            <StatCard label="Active" value={stats.inProgress} note="In progress" color="var(--blue)" delay={2} />
            <StatCard label="Done" value={stats.completed} note="Completed" color="var(--green)" delay={3} />
            <StatCard label="Cancelled" value={stats.cancelled} note="Closed out" color="var(--red)" delay={4} />
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Tasks</h2>
              <div className="segmented">
                {[['all', 'All'], ...STATUS_OPTIONS.map((status) => [status, STATUS_META[status].label])].map(([value, label]) => (
                  <button key={value} className={`segment ${filterStatus === value ? 'active' : ''}`} onClick={() => setFilterStatus(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="list">
              {filtered.length === 0 && (
                <div className="empty">
                  <h3 className="panel-title">No tasks in this view</h3>
                  <p className="subtitle" style={{ margin: '8px auto 18px' }}>Create a task or choose a different filter.</p>
                  <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create task</button>
                </div>
              )}
              {filtered.map((task) => (
                <motion.div className="row" key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div>
                    <div className="row-title">{task.title}</div>
                    <div className="row-subtitle">
                      {task.description || 'No description'} | Created {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="row-actions">
                    {task.assignee ? (
                      <div className="toolbar">
                        <Avatar name={task.assignee.full_name} email={task.assignee.email} />
                        <span className="row-subtitle">{task.assignee.full_name || task.assignee.email}</span>
                      </div>
                    ) : <span className="row-subtitle">Unassigned</span>}
                    <StatusPill status={task.status} />
                    <select className="select" style={{ width: 138 }} value={task.status} onChange={(event) => handleStatusUpdate(task.id, event.target.value)} disabled={updating === task.id}>
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
                    </select>
                    <button className="btn btn-danger" onClick={() => handleDelete(task.id)}>Delete</button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showForm && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setShowForm(false)}>
            <motion.div className="modal" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <h2 className="panel-title">Create task</h2>
                <button className="btn" onClick={() => setShowForm(false)}>Close</button>
              </div>
              <form className="modal-body form-grid" onSubmit={handleCreate}>
                <div>
                  <label className="label">Task title</label>
                  <input className="field" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Update onboarding flow" />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="textarea" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional task details" />
                </div>
                <div>
                  <label className="label">Assign to</label>
                  <select className="select" value={form.assigned_to} onChange={(event) => setForm((prev) => ({ ...prev, assigned_to: event.target.value }))}>
                    <option value="">Unassigned</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.full_name ? `${member.full_name} (${member.email})` : member.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <div className="segmented">
                    {STATUS_OPTIONS.map((status) => (
                      <button type="button" key={status} className={`segment ${form.status === status ? 'active' : ''}`} onClick={() => setForm((prev) => ({ ...prev, status }))}>
                        {STATUS_META[status].label}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Creating' : 'Create task'}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
