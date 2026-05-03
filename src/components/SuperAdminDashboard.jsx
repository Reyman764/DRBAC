import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const ROLES = ['member', 'admin', 'super_admin'];
const ROLE_META = {
  super_admin: { label: 'Super Admin', color: 'var(--gold-2)' },
  admin: { label: 'Admin', color: 'var(--amber)' },
  member: { label: 'Member', color: 'var(--green)' },
};
const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--amber)' },
  in_progress: { label: 'In progress', color: 'var(--blue)' },
  completed: { label: 'Completed', color: 'var(--green)' },
  cancelled: { label: 'Cancelled', color: 'var(--red)' },
};

const USER_SORTS = {
  created_desc: { label: 'Newest users', field: 'created_at', direction: 'desc' },
  created_asc: { label: 'Oldest users', field: 'created_at', direction: 'asc' },
  name_asc: { label: 'Name A-Z', field: 'name', direction: 'asc' },
  name_desc: { label: 'Name Z-A', field: 'name', direction: 'desc' },
  role_asc: { label: 'Role A-Z', field: 'role', direction: 'asc' },
  assigned_desc: { label: 'Most assigned', field: 'assigned', direction: 'desc' },
  completion_desc: { label: 'Best completion', field: 'completion', direction: 'desc' },
};

const TASK_SORTS = {
  created_desc: { label: 'Newest tasks', field: 'created_at', direction: 'desc' },
  created_asc: { label: 'Oldest tasks', field: 'created_at', direction: 'asc' },
  title_asc: { label: 'Title A-Z', field: 'title', direction: 'asc' },
  title_desc: { label: 'Title Z-A', field: 'title', direction: 'desc' },
  status_asc: { label: 'Status A-Z', field: 'status', direction: 'asc' },
  assignee_asc: { label: 'Assignee A-Z', field: 'assignee', direction: 'asc' },
};

function normalize(value) {
  return String(value || '').toLowerCase();
}

function compareValues(a, b, direction = 'asc') {
  const modifier = direction === 'asc' ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * modifier;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }) * modifier;
}

function Avatar({ name, email, size = 38 }) {
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

function Pill({ label, color }) {
  return (
    <span className="pill" style={{ '--pill-color': color }}>
      <span className="dot" />
      {label}
    </span>
  );
}

export default function SuperAdminDashboard({ onSignOut }) {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [workloadFilter, setWorkloadFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [userSort, setUserSort] = useState('created_desc');
  const [taskSort, setTaskSort] = useState('created_desc');
  const [expandedId, setExpandedId] = useState(null);
  const [tab, setTab] = useState('users');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [profileResult, taskResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('id, title, description, status, created_at, created_by, assigned_to').order('created_at', { ascending: false }),
      ]);
      if (!mounted) return;
      if (profileResult.error || taskResult.error) {
        setError((profileResult.error || taskResult.error).message);
      } else {
        setUsers(profileResult.data ?? []);
        setTasks(taskResult.data ?? []);
      }
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
    if (error) {
      showToast('error', error.message);
      return;
    }
    setUsers((prev) => prev.map((user) => user.id === userId ? { ...user, role: newRole } : user));
    showToast('success', `Role updated to ${ROLE_META[newRole]?.label}.`);
  }, [showToast]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((user) => user.role === 'admin').length;
    const members = users.filter((user) => user.role === 'member').length;
    const superAdmins = users.filter((user) => user.role === 'super_admin').length;
    const totalTasks = tasks.length;
    const pending = tasks.filter((task) => task.status === 'pending').length;
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const cancelled = tasks.filter((task) => task.status === 'cancelled').length;
    return { total, admins, members, superAdmins, totalTasks, pending, inProgress, completed, cancelled };
  }, [users, tasks]);

  const getUserTaskStats = useCallback((userId) => {
    const assigned = tasks.filter((task) => task.assigned_to === userId);
    return {
      assigned: assigned.length,
      completed: assigned.filter((task) => task.status === 'completed').length,
      inProgress: assigned.filter((task) => task.status === 'in_progress').length,
      pending: assigned.filter((task) => task.status === 'pending').length,
      list: assigned,
    };
  }, [tasks]);

  const userRows = useMemo(() => users.map((user) => {
    const taskStats = getUserTaskStats(user.id);
    const completion = taskStats.assigned > 0 ? Math.round((taskStats.completed / taskStats.assigned) * 100) : 0;
    const active = taskStats.inProgress + taskStats.pending;
    return {
      ...user,
      taskStats,
      completion,
      active,
      searchText: normalize(`${user.full_name} ${user.email} ${user.role} ${taskStats.list.map((task) => task.title).join(' ')}`),
    };
  }), [getUserTaskStats, users]);

  const filteredUsers = useMemo(() => {
    const term = normalize(search.trim());
    const config = USER_SORTS[userSort] || USER_SORTS.created_desc;
    return userRows
      .filter((user) => roleFilter === 'all' || user.role === roleFilter)
      .filter((user) => {
        if (workloadFilter === 'all') return true;
        if (workloadFilter === 'no_tasks') return user.taskStats.assigned === 0;
        if (workloadFilter === 'has_tasks') return user.taskStats.assigned > 0;
        if (workloadFilter === 'active_work') return user.active > 0;
        if (workloadFilter === 'complete') return user.taskStats.assigned > 0 && user.completion === 100;
        return true;
      })
      .filter((user) => !term || user.searchText.includes(term))
      .sort((a, b) => {
        const values = {
          created_at: [new Date(a.created_at || 0).getTime(), new Date(b.created_at || 0).getTime()],
          name: [a.full_name || a.email, b.full_name || b.email],
          role: [ROLE_META[a.role]?.label || a.role, ROLE_META[b.role]?.label || b.role],
          assigned: [a.taskStats.assigned, b.taskStats.assigned],
          completion: [a.completion, b.completion],
        };
        return compareValues(values[config.field]?.[0], values[config.field]?.[1], config.direction);
      });
  }, [roleFilter, search, userRows, userSort, workloadFilter]);

  const enrichedTasks = useMemo(() => tasks.map((task) => {
    const assignee = users.find((user) => user.id === task.assigned_to);
    const creator = users.find((user) => user.id === task.created_by);
    return {
      ...task,
      assigneeName: assignee?.full_name || assignee?.email || 'Unassigned',
      creatorName: creator?.full_name || creator?.email || 'Unknown',
      searchText: normalize(`${task.title} ${task.description} ${task.status} ${assignee?.full_name} ${assignee?.email} ${creator?.full_name} ${creator?.email}`),
    };
  }), [tasks, users]);

  const filteredTasks = useMemo(() => {
    const term = normalize(search.trim());
    const config = TASK_SORTS[taskSort] || TASK_SORTS.created_desc;
    return enrichedTasks
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => {
        if (assignmentFilter === 'all') return true;
        if (assignmentFilter === 'assigned') return Boolean(task.assigned_to);
        if (assignmentFilter === 'unassigned') return !task.assigned_to;
        return true;
      })
      .filter((task) => !term || task.searchText.includes(term))
      .sort((a, b) => {
        const values = {
          created_at: [new Date(a.created_at || 0).getTime(), new Date(b.created_at || 0).getTime()],
          title: [a.title, b.title],
          status: [STATUS_META[a.status]?.label || a.status, STATUS_META[b.status]?.label || b.status],
          assignee: [a.assigneeName, b.assigneeName],
        };
        return compareValues(values[config.field]?.[0], values[config.field]?.[1], config.direction);
      });
  }, [assignmentFilter, enrichedTasks, search, statusFilter, taskSort]);

  const resetControls = useCallback(() => {
    setSearch('');
    setRoleFilter('all');
    setWorkloadFilter('all');
    setStatusFilter('all');
    setAssignmentFilter('all');
    setUserSort('created_desc');
    setTaskSort('created_desc');
  }, []);

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.completed / stats.totalTasks) * 100) : 0;
  const visibleCount = tab === 'users' ? filteredUsers.length : filteredTasks.length;
  const totalCount = tab === 'users' ? users.length : enrichedTasks.length;

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
          <button className="btn" onClick={onSignOut}>Sign out</button>
        </div>

        <section className="hero-panel">
          <div className="hero-panel-header">
            <div>
              <p className="eyebrow">Super admin control center</p>
              <h1 className="title">A refined command layer for users, roles, and delivery.</h1>
              <p className="subtitle">{stats.total} users, {stats.totalTasks} tasks, and {completionRate}% platform completion.</p>
            </div>
            <div style={{ minWidth: 240 }}>
              <div className="stat-label">Platform completion</div>
              <div className="stat-value" style={{ color: 'var(--gold-2)' }}>{completionRate}%</div>
              <div className="progress" style={{ marginTop: 14 }}>
                <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <StatCard label="Total users" value={stats.total} note="All accounts" color="var(--text)" delay={0} />
            <StatCard label="Super admins" value={stats.superAdmins} note="Full control" color="var(--gold-2)" delay={1} />
            <StatCard label="Admins" value={stats.admins} note="Task creators" color="var(--amber)" delay={2} />
            <StatCard label="Members" value={stats.members} note="Task assignees" color="var(--green)" delay={3} />
            <StatCard label="Tasks" value={stats.totalTasks} note="Platform total" color="var(--blue)" delay={4} />
            <StatCard label="Completed" value={stats.completed} note="Delivered work" color="var(--green)" delay={5} />
          </div>
        </section>

        {error && (
          <div className="panel" style={{ marginTop: 18, padding: 18, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <section className="content-grid">
          <div className="panel">
            <div className="panel-head">
              <div className="segmented">
                <button className={`segment ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
                <button className={`segment ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>All tasks</button>
              </div>
              <div className="table-meta">
                Showing {visibleCount} of {totalCount}
              </div>
            </div>

            {tab === 'users' && (
              <>
                <div className="control-bar">
                  <div className="control-search">
                    <label className="label">Search users and assigned tasks</label>
                    <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, role, or task" />
                  </div>
                  <div className="control-group">
                    <label className="label">Role</label>
                    <select className="select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                      <option value="all">All roles</option>
                      {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Workload</label>
                    <select className="select" value={workloadFilter} onChange={(event) => setWorkloadFilter(event.target.value)}>
                      <option value="all">All workloads</option>
                      <option value="no_tasks">No tasks</option>
                      <option value="has_tasks">Has tasks</option>
                      <option value="active_work">Active work</option>
                      <option value="complete">100% complete</option>
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Sort</label>
                    <select className="select" value={userSort} onChange={(event) => setUserSort(event.target.value)}>
                      {Object.entries(USER_SORTS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
                    </select>
                  </div>
                  <div className="control-action">
                    <button className="btn" onClick={resetControls}>Reset</button>
                  </div>
                </div>
                <div className="list">
                  {filteredUsers.length === 0 && <div className="empty">No users match your filters.</div>}
                  {filteredUsers.map((user) => {
                    const { taskStats } = user;
                    const expanded = expandedId === user.id;
                    const pct = user.completion;
                    return (
                      <motion.div key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="row" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : user.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Avatar name={user.full_name} email={user.email} />
                            <div>
                              <div className="row-title">{user.full_name || 'Unnamed user'}</div>
                              <div className="row-subtitle">{user.email}</div>
                            </div>
                          </div>
                          <div className="row-actions">
                            <span className="row-subtitle">{taskStats.assigned} assigned | {pct}% done</span>
                            <Pill label={ROLE_META[user.role]?.label || user.role} color={ROLE_META[user.role]?.color || 'var(--text-soft)'} />
                            <select
                              className="select"
                              style={{ width: 150 }}
                              value={user.role}
                              disabled={updating === user.id}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => handleRoleChange(user.id, event.target.value)}
                            >
                              {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
                            </select>
                            <button className="btn">{expanded ? 'Hide' : 'Details'}</button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {expanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ padding: '0 20px 18px 72px' }}>
                                <div className="progress" style={{ marginBottom: 14 }}>
                                  <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
                                </div>
                                {taskStats.list.length === 0 ? (
                                  <p className="subtitle">No assigned tasks yet.</p>
                                ) : (
                                  <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                                    {taskStats.list.slice(0, 6).map((task) => (
                                      <div className="row" key={task.id} style={{ padding: '12px 14px' }}>
                                        <div>
                                          <div className="row-title">{task.title}</div>
                                          <div className="row-subtitle">{new Date(task.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <Pill label={STATUS_META[task.status]?.label || task.status} color={STATUS_META[task.status]?.color || 'var(--text-soft)'} />
                                      </div>
                                    ))}
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

            {tab === 'tasks' && (
              <>
                <div className="control-bar">
                  <div className="control-search">
                    <label className="label">Search tasks and people</label>
                    <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, description, creator, assignee, or status" />
                  </div>
                  <div className="control-group">
                    <label className="label">Status</label>
                    <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">All statuses</option>
                      {Object.entries(STATUS_META).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Assignment</label>
                    <select className="select" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}>
                      <option value="all">All tasks</option>
                      <option value="assigned">Assigned</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Sort</label>
                    <select className="select" value={taskSort} onChange={(event) => setTaskSort(event.target.value)}>
                      {Object.entries(TASK_SORTS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
                    </select>
                  </div>
                  <div className="control-action">
                    <button className="btn" onClick={resetControls}>Reset</button>
                  </div>
                </div>
                <div className="list">
                  {filteredTasks.length === 0 && <div className="empty">No tasks match your filters.</div>}
                  {filteredTasks.map((task) => (
                    <motion.div className="row" key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <div>
                        <div className="row-title">{task.title}</div>
                        <div className="row-subtitle">{task.description || 'No description'} | Created {new Date(task.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="row-actions">
                        <span className="row-subtitle">By {task.creatorName}</span>
                        <span className="row-subtitle">To {task.assigneeName}</span>
                        <Pill label={STATUS_META[task.status]?.label || task.status} color={STATUS_META[task.status]?.color || 'var(--text-soft)'} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
