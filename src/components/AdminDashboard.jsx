import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import {
  STATUS_OPTIONS,
  STATUS_META,
  PRIORITY_OPTIONS,
  PRIORITY_META,
  TASK_LIMITS,
} from '../constants/taskMeta';
import { displayName } from '../lib/displayName';
import { emitOpenProfile, listenOpenTask } from '../lib/appEvents';
import ToastOutlet from './ToastOutlet';
import ConfirmModal from './ConfirmModal';
import Avatar from './Avatar';
import TaskComments from './TaskComments';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'title_asc', label: 'Title A → Z' },
  { value: 'title_desc', label: 'Title Z → A' },
  { value: 'assignee', label: 'Assignee A → Z' },
  { value: 'priority', label: 'Priority' },
];

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

function TaskFormFields({ form, onChange, members }) {
  return (
    <>
      <div>
        <label className="label">Task title *</label>
        <input
          className="field"
          maxLength={TASK_LIMITS.titleMax}
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="e.g. Update onboarding flow"
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="textarea"
          maxLength={TASK_LIMITS.descriptionMax}
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Optional task details"
        />
      </div>
      <div>
        <label className="label">Due date</label>
        <input
          className="field"
          type="date"
          value={form.due_date}
          onChange={(e) => onChange('due_date', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Priority</label>
        <select className="select" value={form.priority} onChange={(e) => onChange('priority', e.target.value)}>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{PRIORITY_META[p].label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Assign to</label>
        <select
          className="select"
          value={form.assigned_to}
          onChange={(e) => onChange('assigned_to', e.target.value)}
        >
          <option value="">— Unassigned —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {displayName(m.full_name, m.email)} ({m.email})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <div className="segmented">
          {STATUS_OPTIONS.map((s) => (
            <button
              type="button"
              key={s}
              className={`segment ${form.status === s ? 'active' : ''}`}
              onClick={() => onChange('status', s)}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function isoDateToInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inputDateToUtcNoon(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T12:00:00.000Z`).toISOString();
}

const INITIAL_FORM = {
  title: '',
  description: '',
  assigned_to: '',
  status: 'pending',
  due_date: '',
  priority: 'medium',
};

export default function AdminDashboard({ onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState(INITIAL_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [commentTaskId, setCommentTaskId] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const reload = useCallback(async () => {
    const { data: { session: active } } = await supabase.auth.getSession();
    if (!active) return;
    setSession(active);
    const [taskRes, memberRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)')
        .eq('created_by', active.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'member').order('full_name'),
    ]);
    setTasks(taskRes.data ?? []);
    setMembers(memberRes.data ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await reload();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [reload]);

  useEffect(() => {
    const ch = supabase.channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [reload]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (commentTaskId) setCommentTaskId(null);
      else if (editTask) setEditTask(null);
      else if (showCreate) setShowCreate(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreate, editTask, commentTaskId]);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const openEdit = useCallback((task) => {
    setEditTask(task);
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      assigned_to: task.assigned_to ?? '',
      status: task.status,
      due_date: isoDateToInput(task.due_date),
      priority: task.priority ?? 'medium',
    });
  }, []);

  useEffect(() => listenOpenTask((id) => {
    const found = tasks.find((t) => t.id === id);
    if (found) openEdit(found);
  }), [tasks, openEdit]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const t = createForm.title.trim();
    if (!t) { showToast('error', 'Task title is required.'); return; }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title: t,
        description: createForm.description.trim() || null,
        created_by: session.user.id,
        assigned_to: createForm.assigned_to || null,
        status: createForm.status,
        due_date: inputDateToUtcNoon(createForm.due_date),
        priority: createForm.priority,
      }])
      .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)')
      .single();
    setSubmitting(false);
    if (error) {
      showToast('error', error.message);
      return;
    }
    setTasks((prev) => [data, ...prev]);
    setCreateForm(INITIAL_FORM);
    setShowCreate(false);
    showToast('success', 'Task created.');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) { showToast('error', 'Task title is required.'); return; }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        assigned_to: editForm.assigned_to || null,
        status: editForm.status,
        due_date: inputDateToUtcNoon(editForm.due_date),
        priority: editForm.priority,
      })
      .eq('id', editTask.id)
      .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)')
      .single();
    setSubmitting(false);
    if (error) { showToast('error', error.message); return; }
    setTasks((prev) => prev.map((t) => t.id === editTask.id ? data : t));
    setEditTask(null);
    showToast('success', 'Task updated.');
  };

  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    setUpdating(taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setUpdating(null);
    if (error) { showToast('error', error.message); return; }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    showToast('success', `Status → ${STATUS_META[newStatus]?.label}.`);
  }, [showToast]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const taskId = deleteId;
    const { data: deleted, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id');
    setDeleteId(null);
    if (error) { showToast('error', error.message); return; }
    if (!deleted || deleted.length === 0) {
      showToast('error', 'Delete failed: task not found or permission denied.');
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('success', 'Task deleted.');
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  }), [tasks]);

  const priorityRank = (p) => ({ urgent: 4, high: 3, medium: 2, low: 1 }[p] ?? 2);

  const displayedTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterAssignee === 'unassigned' && t.assigned_to) return false;
      if (filterAssignee !== 'all' && filterAssignee !== 'unassigned' && t.assigned_to !== filterAssignee) return false;
      if (term) {
        const hay = [
          t.title,
          t.description,
          t.assignee?.full_name,
          t.assignee?.email,
          t.priority,
        ].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'due_soon': {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return da - db;
        }
        case 'priority':
          return priorityRank(b.priority) - priorityRank(a.priority);
        case 'assignee': {
          const na = displayName(a.assignee?.full_name, a.assignee?.email, '\uffff');
          const nb = displayName(b.assignee?.full_name, b.assignee?.email, '\uffff');
          return na.localeCompare(nb);
        }
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });
  }, [tasks, filterAssignee, filterPriority, filterStatus, search, sortBy]);

  const workload = useMemo(() => (
    members.map((m) => {
      const mine = tasks.filter((t) => t.assigned_to === m.id);
      const active = mine.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
      return { member: m, total: mine.length, active };
    }).filter((w) => w.total > 0 || w.active > 0).sort((a, b) => b.active - a.active)
  ), [members, tasks]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const hasActiveFilters =
    search || filterStatus !== 'all' || filterAssignee !== 'all' || filterPriority !== 'all' || sortBy !== 'newest';

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilterStatus('all');
    setFilterAssignee('all');
    setFilterPriority('all');
    setSortBy('newest');
  }, []);

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
      <ConfirmModal
        open={Boolean(deleteId)}
        title="Delete task?"
        message="This action cannot be undone. The task and its comments will be removed permanently."
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      <main className="page">
        <div className="topbar">
          <div className="brand-mark">
            <span className="brand-badge">K</span>
            <span>KaryaSync</span>
          </div>
          <div className="toolbar">
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>New task</button>
            <button type="button" className="btn" onClick={() => emitOpenProfile()}>Profile</button>
            <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <section className="hero-panel">
          <div className="hero-panel-header">
            <div className="row-main">
              <p className="eyebrow">Admin task manager</p>
              <h1 className="title">Command your team workload.</h1>
              <p className="subtitle">
                {stats.total} tasks created, {completionRate}% completed across your assigned workstream.
              </p>
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

        {workload.length > 0 && (
          <section className="content-grid" style={{ marginTop: 18 }}>
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Member workload</h2>
                <span className="table-meta">Active vs total assigned</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {workload.map((w) => (
                  <div key={w.member.id} className="workload-chip">
                    <Avatar name={w.member.full_name} email={w.member.email} seed={w.member.id} size={28} />
                    <span>{displayName(w.member.full_name, w.member.email)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{w.active} active · {w.total} total</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="content-grid">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">
                Tasks
                {hasActiveFilters && (
                  <span className="table-meta" style={{ marginLeft: 10, fontWeight: 400 }}>
                    {displayedTasks.length} of {tasks.length}
                  </span>
                )}
              </h2>
            </div>

            <div
              className="control-bar"
              style={{ gridTemplateColumns: 'minmax(200px,1fr) repeat(4, minmax(140px,1fr)) auto' }}
            >
              <div className="control-search">
                <label className="label">Search tasks</label>
                <input
                  className="field"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title, description, assignee, priority…"
                />
              </div>

              <div className="control-group">
                <label className="label">Assignee</label>
                <select className="select" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
                  <option value="all">All assignees</option>
                  <option value="unassigned">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{displayName(m.full_name, m.email)}</option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label className="label">Priority</label>
                <select className="select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                  <option value="all">All</option>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </div>

              <div className="control-group">
                <label className="label">Sort</label>
                <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="control-action" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <label className="label">Status</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="select" style={{ width: 140 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  {hasActiveFilters && <button type="button" className="btn" onClick={resetFilters}>Reset</button>}
                </div>
              </div>
            </div>

            <div className="list">
              {displayedTasks.length === 0 && (
                <div className="empty">
                  <div className="empty-icon" aria-hidden>🗂️</div>
                  <h3 className="panel-title">
                    {hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
                  </h3>
                  <p className="subtitle" style={{ margin: '8px auto 18px' }}>
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'Create your first task to get started.'}
                  </p>
                  {hasActiveFilters
                    ? <button type="button" className="btn" onClick={resetFilters}>Clear filters</button>
                    : <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>Create task</button>
                  }
                </div>
              )}

              <AnimatePresence initial={false}>
                {displayedTasks.map((task) => (
                  <motion.div className="row" key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} layout>
                    <div className="row-main">
                      <div className="row-title">{task.title}</div>
                      <div className="row-subtitle">
                        {task.description || 'No description'}
                        {' · '}
                        Created {new Date(task.created_at).toLocaleDateString()}
                        {task.due_date && (
                          <> · Due {new Date(task.due_date).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>

                    <div className="row-actions">
                      {task.assignee ? (
                        <div className="toolbar">
                          <Avatar name={task.assignee.full_name} email={task.assignee.email} seed={task.assigned_to} />
                          <span className="row-subtitle">
                            {displayName(task.assignee.full_name, task.assignee.email)}
                          </span>
                        </div>
                      ) : (
                        <span className="row-subtitle" style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                      )}

                      <PriorityPill priority={task.priority || 'medium'} />
                      <StatusPill status={task.status} />

                      <select
                        className="select"
                        style={{ width: 138, minWidth: 0 }}
                        value={task.status}
                        disabled={updating === task.id}
                        onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                      </select>

                      <button type="button" className="btn" onClick={() => setCommentTaskId(task.id)}>Thread</button>
                      <button type="button" className="btn" onClick={() => openEdit(task)}>Edit</button>
                      <button type="button" className="btn btn-danger" onClick={() => setDeleteId(task.id)}>Delete</button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={() => setShowCreate(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="panel-head">
                <h2 className="panel-title">Create task</h2>
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>Close</button>
              </div>
              <form className="modal-body form-grid" onSubmit={handleCreate}>
                <TaskFormFields
                  form={createForm}
                  onChange={(key, val) => setCreateForm((p) => ({ ...p, [key]: val }))}
                  members={members}
                />
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create task'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTask && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={() => setEditTask(null)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Edit task</h2>
                  <p className="row-subtitle" style={{ marginTop: 2 }}>
                    Created {new Date(editTask.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button type="button" className="btn" onClick={() => setEditTask(null)}>Cancel</button>
              </div>
              <form className="modal-body form-grid" onSubmit={handleSaveEdit}>
                <TaskFormFields
                  form={editForm}
                  onChange={(key, val) => setEditForm((p) => ({ ...p, [key]: val }))}
                  members={members}
                />
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commentTaskId && (
          <motion.div
            className="modal-backdrop"
            style={{ alignItems: 'flex-start', paddingTop: '6vh' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={() => setCommentTaskId(null)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="panel-head">
                <h2 className="panel-title">Task thread</h2>
                <button type="button" className="btn" onClick={() => setCommentTaskId(null)}>Close</button>
              </div>
              <div className="modal-body">
                <TaskComments taskId={commentTaskId} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
