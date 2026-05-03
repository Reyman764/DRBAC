import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_META = {
  pending:     { label: 'Pending',     color: 'var(--amber)' },
  in_progress: { label: 'In progress', color: 'var(--blue)'  },
  completed:   { label: 'Completed',   color: 'var(--green)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--red)'   },
};

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first'   },
  { value: 'oldest',     label: 'Oldest first'   },
  { value: 'title_asc',  label: 'Title A → Z'    },
  { value: 'title_desc', label: 'Title Z → A'    },
  { value: 'assignee',   label: 'Assignee A → Z' },
];

const INITIAL_FORM = { title: '', description: '', assigned_to: '', status: 'pending' };

/* ── Small reusable components ─────────────────────────────────────────────── */

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
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials}
    </div>
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

/* ── TaskFormFields — shared by Create and Edit modals ─────────────────────── */

function TaskFormFields({ form, onChange, members }) {
  return (
    <>
      <div>
        <label className="label">Task title *</label>
        <input
          className="field"
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="e.g. Update onboarding flow"
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="textarea"
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Optional task details"
        />
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
              {m.full_name ? `${m.full_name} (${m.email})` : m.email}
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

/* ── Main component ─────────────────────────────────────────────────────────── */

export default function AdminDashboard({ onSignOut }) {
  const [tasks,      setTasks]      = useState([]);
  const [members,    setMembers]    = useState([]);
  const [session,    setSession]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updating,   setUpdating]   = useState(null);
  const [toast,      setToast]      = useState(null);

  /* modal state */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [editTask,   setEditTask]   = useState(null);
  const [editForm,   setEditForm]   = useState(INITIAL_FORM);

  /* search / filter / sort */
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [sortBy,         setSortBy]         = useState('newest');

  /* Escape key closes whichever modal is open */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (editTask)       setEditTask(null);
      else if (showCreate) setShowCreate(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreate, editTask]);

  /* initial data load */
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { session: active } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(active);
      if (!active) { setLoading(false); return; }

      const [taskRes, memberRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)')
          .eq('created_by', active.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'member')
          .order('full_name'),
      ]);
      if (!mounted) return;
      setTasks(taskRes.data ?? []);
      setMembers(memberRes.data ?? []);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── CREATE ── */
  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) { showToast('error', 'Task title is required.'); return; }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title:       createForm.title.trim(),
        description: createForm.description.trim() || null,
        created_by:  session.user.id,
        assigned_to: createForm.assigned_to || null,
        status:      createForm.status,
      }])
      .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)')
      .single();
    setSubmitting(false);
    if (error) { showToast('error', error.message); return; }
    setTasks((prev) => [data, ...prev]);
    setCreateForm(INITIAL_FORM);
    setShowCreate(false);
    showToast('success', 'Task created.');
  }, [createForm, session, showToast]);

  /* ── OPEN EDIT ── */
  const openEdit = useCallback((task) => {
    setEditTask(task);
    setEditForm({
      title:       task.title,
      description: task.description ?? '',
      assigned_to: task.assigned_to ?? '',
      status:      task.status,
    });
  }, []);

  /* ── SAVE EDIT ── */
  const handleSaveEdit = useCallback(async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) { showToast('error', 'Task title is required.'); return; }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title:       editForm.title.trim(),
        description: editForm.description.trim() || null,
        assigned_to: editForm.assigned_to || null,
        status:      editForm.status,
      })
      .eq('id', editTask.id)
      .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email)')
      .single();
    setSubmitting(false);
    if (error) { showToast('error', error.message); return; }
    setTasks((prev) => prev.map((t) => t.id === editTask.id ? data : t));
    setEditTask(null);
    showToast('success', 'Task updated.');
  }, [editForm, editTask, showToast]);

  /* ── QUICK STATUS UPDATE (row dropdown) ── */
  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    setUpdating(taskId);
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
    setUpdating(null);
    if (error) { showToast('error', error.message); return; }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    showToast('success', `Status → ${STATUS_META[newStatus]?.label}.`);
  }, [showToast]);

  /* ── DELETE ── */
  const handleDelete = useCallback(async (taskId) => {
    if (!window.confirm('Delete this task? This action cannot be undone.')) return;
    const { data: deleted, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .select('id');
    if (error) { showToast('error', error.message); return; }
    if (!deleted || deleted.length === 0) {
      showToast('error', 'Delete failed: task not found or permission denied.');
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('success', 'Task deleted.');
  }, [showToast]);

  /* ── STATS ── */
  const stats = useMemo(() => ({
    total:      tasks.length,
    pending:    tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed:  tasks.filter((t) => t.status === 'completed').length,
    cancelled:  tasks.filter((t) => t.status === 'cancelled').length,
  }), [tasks]);

  /* ── SEARCH + FILTER + SORT PIPELINE ── */
  const displayedTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = tasks.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterAssignee === 'unassigned' && t.assigned_to) return false;
      if (filterAssignee !== 'all' && filterAssignee !== 'unassigned' && t.assigned_to !== filterAssignee) return false;
      if (term) {
        const hay = [t.title, t.description, t.assignee?.full_name, t.assignee?.email]
          .join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':     return new Date(a.created_at) - new Date(b.created_at);
        case 'title_asc':  return a.title.localeCompare(b.title);
        case 'title_desc': return b.title.localeCompare(a.title);
        case 'assignee': {
          const na = a.assignee?.full_name || a.assignee?.email || '\uffff';
          const nb = b.assignee?.full_name || b.assignee?.email || '\uffff';
          return na.localeCompare(nb);
        }
        default: return new Date(b.created_at) - new Date(a.created_at);
      }
    });
  }, [tasks, filterStatus, filterAssignee, search, sortBy]);

  const completionRate = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  const hasActiveFilters =
    search || filterStatus !== 'all' || filterAssignee !== 'all' || sortBy !== 'newest';

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilterStatus('all');
    setFilterAssignee('all');
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
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast toast-${toast.type}`}
            initial={{ opacity: 0, y: -10, x: '-50%' }}
            animate={{ opacity: 1, y: 0,   x: '-50%' }}
            exit={{ opacity: 0 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="page">
        {/* topbar */}
        <div className="topbar">
          <div className="brand-mark">
            <span className="brand-badge">K</span>
            <span>KaryaSync</span>
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>New task</button>
            <button className="btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        {/* hero */}
        <section className="hero-panel">
          <div className="hero-panel-header">
            <div>
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
            <StatCard label="Total"     value={stats.total}      note="Created tasks"  color="var(--text)"  delay={0} />
            <StatCard label="Pending"   value={stats.pending}    note="Awaiting start" color="var(--amber)" delay={1} />
            <StatCard label="Active"    value={stats.inProgress} note="In progress"    color="var(--blue)"  delay={2} />
            <StatCard label="Done"      value={stats.completed}  note="Completed"      color="var(--green)" delay={3} />
            <StatCard label="Cancelled" value={stats.cancelled}  note="Closed out"     color="var(--red)"   delay={4} />
          </div>
        </section>

        {/* task panel */}
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

            {/* ── Search / filter / sort bar ── */}
            <div
              className="control-bar"
              style={{ gridTemplateColumns: 'minmax(200px,1fr) minmax(160px,210px) minmax(160px,200px) auto' }}
            >
              <div className="control-search">
                <label className="label">Search tasks</label>
                <input
                  className="field"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title, description, or assignee…"
                />
              </div>

              <div className="control-group">
                <label className="label">Assignee</label>
                <select
                  className="select"
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                >
                  <option value="all">All assignees</option>
                  <option value="unassigned">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label className="label">Sort</label>
                <select
                  className="select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="control-action" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <label className="label">Status</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="select"
                    style={{ width: 140 }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                  {hasActiveFilters && (
                    <button className="btn" onClick={resetFilters}>Reset</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Task list ── */}
            <div className="list">
              {displayedTasks.length === 0 && (
                <div className="empty">
                  <h3 className="panel-title">
                    {hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
                  </h3>
                  <p className="subtitle" style={{ margin: '8px auto 18px' }}>
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'Create your first task to get started.'}
                  </p>
                  {hasActiveFilters
                    ? <button className="btn" onClick={resetFilters}>Clear filters</button>
                    : <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create task</button>
                  }
                </div>
              )}

              <AnimatePresence initial={false}>
                {displayedTasks.map((task) => (
                  <motion.div
                    className="row"
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    layout
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="row-title">{task.title}</div>
                      <div className="row-subtitle">
                        {task.description || 'No description'}&nbsp;·&nbsp;
                        Created {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="row-actions">
                      {task.assignee ? (
                        <div className="toolbar">
                          <Avatar name={task.assignee.full_name} email={task.assignee.email} />
                          <span className="row-subtitle">
                            {task.assignee.full_name || task.assignee.email}
                          </span>
                        </div>
                      ) : (
                        <span className="row-subtitle" style={{ color: 'var(--text-muted)' }}>
                          Unassigned
                        </span>
                      )}

                      <StatusPill status={task.status} />

                      <select
                        className="select"
                        style={{ width: 138 }}
                        value={task.status}
                        disabled={updating === task.id}
                        onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>

                      <button className="btn" onClick={() => openEdit(task)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(task.id)}>Delete</button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      {/* ══ CREATE MODAL ══ */}
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
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: 18, scale: 0.98 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="panel-head">
                <h2 className="panel-title">Create task</h2>
                <button className="btn" onClick={() => setShowCreate(false)}>Close</button>
              </div>
              <form className="modal-body form-grid" onSubmit={handleCreate}>
                <TaskFormFields
                  form={createForm}
                  onChange={(key, val) => setCreateForm((p) => ({ ...p, [key]: val }))}
                  members={members}
                />
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create task'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ EDIT MODAL ══ */}
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
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: 18, scale: 0.98 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Edit task</h2>
                  <p className="row-subtitle" style={{ marginTop: 2 }}>
                    Created {new Date(editTask.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button className="btn" onClick={() => setEditTask(null)}>Cancel</button>
              </div>
              <form className="modal-body form-grid" onSubmit={handleSaveEdit}>
                <TaskFormFields
                  form={editForm}
                  onChange={(key, val) => setEditForm((p) => ({ ...p, [key]: val }))}
                  members={members}
                />
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
