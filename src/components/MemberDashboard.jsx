import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { STATUS_META, STATUS_OPTIONS, PRIORITY_META } from '../constants/taskMeta';
import { displayName } from '../lib/displayName';
import { listenOpenTask, listenProfileUpdated, emitOpenProfile } from '../lib/appEvents';
import ToastOutlet from './ToastOutlet';
import Avatar from './Avatar';
import TaskComments from './TaskComments';

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className="pill" style={{ '--pill-color': meta.color }}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

function PriorityPill({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className="pill" style={{ '--pill-color': meta.color }}>
      <span className="dot" />
      {meta.label}
    </span>
  );
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
  const [sheetTask, setSheetTask] = useState(null);
  const [, setBump] = useState(0);

  const reload = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const [taskResult, profileResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, creator:profiles!tasks_created_by_fkey(full_name, email)')
        .eq('assigned_to', session.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    ]);
    setTasks(taskResult.data ?? []);
    setProfile(profileResult.data);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) {
        setLoading(false);
        return;
      }
      await reload();
      if (!mounted) return;
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [reload]);

  useEffect(() => listenProfileUpdated(() => { reload(); setBump((x) => x + 1); }), [reload]);

  useEffect(() => listenOpenTask((taskId) => {
    const t = tasks.find((x) => x.id === taskId);
    if (t) setSheetTask(t);
  }), [tasks]);

  useEffect(() => {
    if (!sheetTask) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSheetTask(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetTask]);

  useEffect(() => {
    const channel = supabase.channel('member-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { reload(); })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

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
    setSheetTask((prev) => prev?.id === taskId ? { ...prev, status: newStatus } : prev);
    showToast('success', `Marked as ${STATUS_META[newStatus]?.label}.`);
  }, [showToast]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
    attention: tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length,
  }), [tasks]);

  const filtered = useMemo(() => (
    filter === 'all' ? tasks : tasks.filter((task) => task.status === filter)
  ), [tasks, filter]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const firstName = profile ? displayName(profile.full_name, profile.email, 'Workspace').split(/\s+/)[0] : 'Workspace';

  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ToastOutlet toast={toast} />

      <main className="page">
        <div className="topbar">
          <div className="brand-mark">
            <span className="brand-badge">K</span>
            <span>KaryaSync</span>
          </div>
          <div className="toolbar">
            {stats.attention > 0 && (
              <span className="notif-dot" title="Active tasks">{stats.attention}</span>
            )}
            <button type="button" className="btn" onClick={() => emitOpenProfile()}>Profile</button>
            <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <section className="hero-panel">
          <div className="hero-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {profile && <Avatar name={profile.full_name} email={profile.email} seed={profile.id} />}
              <div className="row-main">
                <p className="eyebrow">Member workspace</p>
                <h1 className="title">{firstName}&apos;s task board</h1>
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
                  <button type="button" key={value} className={`segment ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="list">
              {filtered.length === 0 && (
                <div className="empty">
                  <div className="empty-icon" aria-hidden>📋</div>
                  <h3 className="panel-title">{filter === 'all' ? 'No tasks assigned yet' : 'No tasks match this filter'}</h3>
                  <p className="subtitle" style={{ margin: '8px auto 0' }}>{filter === 'all' ? 'Your admin-assigned work will appear here.' : 'Choose another status to keep scanning.'}</p>
                </div>
              )}

              {filtered.map((task) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="row" style={{ cursor: 'pointer' }} onClick={() => setSheetTask(task)}>
                    <div className="row-main">
                      <div className="row-title">{task.title}</div>
                      <div className="row-subtitle">
                        Assigned by {displayName(task.creator?.full_name, task.creator?.email, 'Admin')}
                        {task.due_date ? ` · Due ${new Date(task.due_date).toLocaleDateString()}` : ''}
                        {' · '}
                        {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="row-actions">
                      <PriorityPill priority={task.priority || 'medium'} />
                      <StatusPill status={task.status} />
                      <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setSheetTask(task); }}>Open</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {sheetTask && (
          <motion.div
            className="task-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="topbar" style={{ margin: 0, padding: '18px 22px', borderBottom: '1px solid var(--line)', maxWidth: 1180, width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
              <button type="button" className="btn" onClick={() => setSheetTask(null)}>← Back</button>
              <div className="toolbar">
                <StatusPill status={sheetTask.status} />
                <PriorityPill priority={sheetTask.priority || 'medium'} />
              </div>
            </div>
            <div style={{ width: 'min(720px, 100% - 32px)', margin: '0 auto', padding: '24px 16px 48px' }}>
              <p className="eyebrow">Task detail</p>
              <h1 className="title" style={{ fontSize: 'clamp(24px, 5vw, 36px)' }}>{sheetTask.title}</h1>
              <p className="subtitle">
                From {displayName(sheetTask.creator?.full_name, sheetTask.creator?.email, 'Admin')}
                {sheetTask.due_date && (
                  <> · Due {new Date(sheetTask.due_date).toLocaleString()}</>
                )}
              </p>
              <p className="drawer-description" style={{ marginTop: 20 }}>{sheetTask.description || 'No description was added for this task.'}</p>

              <div style={{ marginTop: 24 }} className="segmented">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    type="button"
                    key={status}
                    className={`segment ${sheetTask.status === status ? 'active' : ''}`}
                    onClick={() => handleStatusUpdate(sheetTask.id, status)}
                    disabled={updating === sheetTask.id || sheetTask.status === status}
                  >
                    {STATUS_META[status].label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 28 }}>
                <TaskComments taskId={sheetTask.id} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
