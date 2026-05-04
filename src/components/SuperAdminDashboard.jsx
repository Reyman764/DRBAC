import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { STATUS_META, PRIORITY_META } from '../constants/taskMeta';
import { displayName } from '../lib/displayName';
import { emitOpenProfile, listenOpenTask } from '../lib/appEvents';
import ToastOutlet from './ToastOutlet';
import Avatar from './Avatar';
import TaskComments from './TaskComments';

const ROLES = ['member', 'admin', 'super_admin'];
const ROLE_META = {
  super_admin: { label: 'Super Admin', color: 'var(--gold-2)' },
  admin: { label: 'Admin', color: 'var(--amber)' },
  member: { label: 'Member', color: 'var(--green)' },
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
  due_asc: { label: 'Due soon', field: 'due', direction: 'asc' },
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

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Pill({ label, color }) {
  return (
    <span className="pill" style={{ '--pill-color': color }}>
      <span className="dot" />
      {label}
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

function InfoTile({ label, value, accent }) {
  return (
    <div className="info-tile" style={{ '--accent': accent || 'var(--text)' }}>
      <div className="stat-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

export default function SuperAdminDashboard({ onSignOut }) {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchTasks, setSearchTasks] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [workloadFilter, setWorkloadFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [userSort, setUserSort] = useState('created_desc');
  const [taskSort, setTaskSort] = useState('created_desc');
  const [drawer, setDrawer] = useState(null);
  const [tab, setTab] = useState('users');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRole, setBulkRole] = useState('member');

  const load = useCallback(async () => {
    setLoading(true);
    const [profileResult, taskResult, auditResult] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('id, title, description, status, priority, due_date, created_at, created_by, assigned_to')
        .order('created_at', { ascending: false }),
      supabase
        .from('profile_role_audit')
        .select('id, profile_id, actor_id, old_role, new_role, created_at')
        .order('created_at', { ascending: false })
        .limit(250),
    ]);
    setError((profileResult.error || taskResult.error || auditResult.error)?.message ?? null);
    setUsers(profileResult.data ?? []);
    setTasks(taskResult.data ?? []);
    setAudits(auditResult.error ? [] : auditResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase.channel('sa-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_role_audit' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  useEffect(() => listenOpenTask((taskId) => {
    setTab('tasks');
    setDrawer({ type: 'task', id: taskId });
  }), []);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
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

  const handleBulkApply = async () => {
    if (selectedIds.size === 0) {
      showToast('error', 'Select at least one user.');
      return;
    }
    setUpdating('bulk');
    try {
      for (const uid of selectedIds) {
        const { error } = await supabase.from('profiles').update({ role: bulkRole }).eq('id', uid);
        if (error) throw error;
      }
      setUsers((prev) => prev.map((u) => (selectedIds.has(u.id) ? { ...u, role: bulkRole } : u)));
      showToast('success', `Applied ${ROLE_META[bulkRole]?.label} to ${selectedIds.size} users.`);
      setSelectedIds(new Set());
    } catch (e) {
      showToast('error', e.message ?? 'Bulk update failed.');
    } finally {
      setUpdating(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = useCallback((list) => {
    setSelectedIds(new Set(list.map((u) => u.id)));
  }, []);

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
      searchText: normalize(`${displayName(user.full_name, user.email)} ${user.email} ${user.role} ${taskStats.list.map((task) => task.title).join(' ')}`),
    };
  }), [getUserTaskStats, users]);

  const filteredUsers = useMemo(() => {
    const term = normalize(searchUsers.trim());
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
          name: [displayName(a.full_name, a.email), displayName(b.full_name, b.email)],
          role: [ROLE_META[a.role]?.label || a.role, ROLE_META[b.role]?.label || b.role],
          assigned: [a.taskStats.assigned, b.taskStats.assigned],
          completion: [a.completion, b.completion],
        };
        return compareValues(values[config.field]?.[0], values[config.field]?.[1], config.direction);
      });
  }, [roleFilter, searchUsers, userRows, userSort, workloadFilter]);

  const enrichedTasks = useMemo(() => tasks.map((task) => {
    const assignee = users.find((user) => user.id === task.assigned_to);
    const creator = users.find((user) => user.id === task.created_by);
    return {
      ...task,
      assigneeName: assignee ? displayName(assignee.full_name, assignee.email, 'Unassigned') : 'Unassigned',
      creatorName: creator ? displayName(creator.full_name, creator.email, 'Unknown') : 'Unknown',
      searchText: normalize(`${task.title} ${task.description} ${task.status} ${task.priority} ${assignee ? displayName(assignee.full_name, assignee.email) : ''} ${creator ? displayName(creator.full_name, creator.email) : ''}`),
    };
  }), [tasks, users]);

  const filteredTasks = useMemo(() => {
    const term = normalize(searchTasks.trim());
    const config = TASK_SORTS[taskSort] || TASK_SORTS.created_desc;
    return enrichedTasks
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => priorityFilter === 'all' || task.priority === priorityFilter)
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
          due: [
            a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY,
            b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY,
          ],
        };
        return compareValues(values[config.field]?.[0], values[config.field]?.[1], config.direction);
      });
  }, [assignmentFilter, enrichedTasks, priorityFilter, searchTasks, statusFilter, taskSort]);

  const resetUserControls = useCallback(() => {
    setSearchUsers('');
    setRoleFilter('all');
    setWorkloadFilter('all');
    setUserSort('created_desc');
    setSelectedIds(new Set());
  }, []);

  const resetTaskControls = useCallback(() => {
    setSearchTasks('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssignmentFilter('all');
    setTaskSort('created_desc');
  }, []);

  const exportUsersCsv = () => {
    const rows = filteredUsers.map((u) => ({
      email: u.email,
      full_name: displayName(u.full_name, u.email),
      role: u.role,
      assigned_count: u.taskStats.assigned,
      completion_pct: u.completion,
      created_at: u.created_at,
    }));
    const header = 'email,full_name,role,assigned_count,completion_pct,created_at';
    const body = rows.map((r) => [r.email, `"${String(r.full_name).replace(/"/g, '""')}"`, r.role, r.assigned_count, r.completion_pct, r.created_at].join(',')).join('\n');
    downloadCsv(`karyasync-users-${new Date().toISOString().slice(0, 10)}.csv`, `${header}\n${body}`);
    showToast('success', 'Exported users CSV.');
  };

  const exportTasksCsv = () => {
    const rows = filteredTasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      assignee: t.assigneeName,
      creator: t.creatorName,
      created_at: t.created_at,
    }));
    const header = 'title,status,priority,due_date,assignee,creator,created_at';
    const body = rows.map((r) => [
      `"${String(r.title).replace(/"/g, '""')}"`,
      r.status,
      r.priority,
      r.due_date ?? '',
      `"${String(r.assignee).replace(/"/g, '""')}"`,
      `"${String(r.creator).replace(/"/g, '""')}"`,
      r.created_at,
    ].join(',')).join('\n');
    downloadCsv(`karyasync-tasks-${new Date().toISOString().slice(0, 10)}.csv`, `${header}\n${body}`);
    showToast('success', 'Exported tasks CSV.');
  };

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.completed / stats.totalTasks) * 100) : 0;
  const visibleCount = tab === 'users' ? filteredUsers.length : tab === 'tasks' ? filteredTasks.length : audits.length;
  const totalCount = tab === 'users' ? users.length : tab === 'tasks' ? enrichedTasks.length : audits.length;
  const selectedUser = drawer?.type === 'user' ? userRows.find((user) => user.id === drawer.id) : null;
  const selectedTask = drawer?.type === 'task' ? enrichedTasks.find((task) => task.id === drawer.id) : null;
  const selectedUserTasks = selectedUser ? enrichedTasks.filter((task) => task.assigned_to === selectedUser.id) : [];
  const selectedTaskCreator = selectedTask ? users.find((user) => user.id === selectedTask.created_by) : null;
  const selectedTaskAssignee = selectedTask ? users.find((user) => user.id === selectedTask.assigned_to) : null;

  const auditRows = useMemo(() => audits.map((a) => {
    const subject = users.find((u) => u.id === a.profile_id);
    const actor = users.find((u) => u.id === a.actor_id);
    return {
      ...a,
      subjectLabel: subject ? displayName(subject.full_name, subject.email) : a.profile_id,
      actorLabel: actor ? displayName(actor.full_name, actor.email) : (a.actor_id ? a.actor_id : 'System'),
    };
  }), [audits, users]);

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
            <button type="button" className="btn" onClick={() => emitOpenProfile()}>Profile</button>
            <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <section className="hero-panel">
          <div className="hero-panel-header">
            <div className="row-main">
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
                <button type="button" className={`segment ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
                <button type="button" className={`segment ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>All tasks</button>
                <button type="button" className={`segment ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Role audit</button>
              </div>
              <div className="table-meta">
                Showing {visibleCount} of {totalCount}
              </div>
            </div>

            {tab === 'users' && (
              <>
                <div className="control-bar">
                  <div className="control-search">
                    <label className="label">Search users &amp; tasks</label>
                    <input className="field" value={searchUsers} onChange={(e) => setSearchUsers(e.target.value)} placeholder="Name, email, role, or task" />
                  </div>
                  <div className="control-group">
                    <label className="label">Role</label>
                    <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                      <option value="all">All roles</option>
                      {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Workload</label>
                    <select className="select" value={workloadFilter} onChange={(e) => setWorkloadFilter(e.target.value)}>
                      <option value="all">All workloads</option>
                      <option value="no_tasks">No tasks</option>
                      <option value="has_tasks">Has tasks</option>
                      <option value="active_work">Active work</option>
                      <option value="complete">100% complete</option>
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Sort</label>
                    <select className="select" value={userSort} onChange={(e) => setUserSort(e.target.value)}>
                      {Object.entries(USER_SORTS).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
                    </select>
                  </div>
                  <div className="control-action" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" className="btn" onClick={() => selectAllFiltered(filteredUsers)}>Select view</button>
                    <button type="button" className="btn" onClick={exportUsersCsv}>Export CSV</button>
                    <button type="button" className="btn" onClick={resetUserControls}>Reset</button>
                  </div>
                </div>

                {selectedIds.size > 0 && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: 'rgba(239,189,85,0.06)' }}>
                    <span className="subtitle" style={{ margin: 0 }}>{selectedIds.size} selected</span>
                    <div>
                      <label className="label">Bulk role</label>
                      <select className="select" style={{ width: 160 }} value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                      </select>
                    </div>
                    <button type="button" className="btn btn-primary" disabled={updating === 'bulk'} onClick={handleBulkApply}>Apply</button>
                    <button type="button" className="btn" onClick={() => setSelectedIds(new Set())}>Clear</button>
                  </div>
                )}

                <div className="list">
                  {filteredUsers.length === 0 && (
                    <div className="empty">
                      <div className="empty-icon" aria-hidden>👥</div>
                      <p className="subtitle" style={{ margin: 0 }}>No users match your filters.</p>
                    </div>
                  )}
                  {filteredUsers.map((user) => {
                    const { taskStats } = user;
                    const pct = user.completion;
                    const checked = selectedIds.has(user.id);
                    return (
                      <motion.div key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="row" style={{ cursor: 'pointer' }} onClick={() => setDrawer({ type: 'user', id: user.id })}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} className="row-main">
                            <input
                              type="checkbox"
                              checked={checked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(user.id)}
                              aria-label={`Select ${displayName(user.full_name, user.email)}`}
                            />
                            <Avatar name={user.full_name} email={user.email} seed={user.id} />
                            <div style={{ minWidth: 0 }}>
                              <div className="row-title">{displayName(user.full_name, user.email, 'Unnamed user')}</div>
                              <div className="row-subtitle">{user.email}</div>
                            </div>
                          </div>
                          <div className="row-actions">
                            <span className="row-subtitle">{taskStats.assigned} assigned | {pct}% done</span>
                            <Pill label={ROLE_META[user.role]?.label || user.role} color={ROLE_META[user.role]?.color || 'var(--text-soft)'} />
                            <select
                              className="select"
                              style={{ width: 150, minWidth: 0 }}
                              value={user.role}
                              disabled={updating === user.id}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            >
                              {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
                            </select>
                            <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setDrawer({ type: 'user', id: user.id }); }}>Details</button>
                          </div>
                        </div>
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
                    <label className="label">Search tasks</label>
                    <input className="field" value={searchTasks} onChange={(e) => setSearchTasks(e.target.value)} placeholder="Title, people, priority, status" />
                  </div>
                  <div className="control-group">
                    <label className="label">Status</label>
                    <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="all">All statuses</option>
                      {Object.entries(STATUS_META).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Priority</label>
                    <select className="select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                      <option value="all">All</option>
                      {Object.keys(PRIORITY_META).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Assignment</label>
                    <select className="select" value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)}>
                      <option value="all">All tasks</option>
                      <option value="assigned">Assigned</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </div>
                  <div className="control-group">
                    <label className="label">Sort</label>
                    <select className="select" value={taskSort} onChange={(e) => setTaskSort(e.target.value)}>
                      {Object.entries(TASK_SORTS).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
                    </select>
                  </div>
                  <div className="control-action" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" className="btn" onClick={exportTasksCsv}>Export CSV</button>
                    <button type="button" className="btn" onClick={resetTaskControls}>Reset</button>
                  </div>
                </div>
                <div className="list">
                  {filteredTasks.length === 0 && (
                    <div className="empty">
                      <div className="empty-icon" aria-hidden>📌</div>
                      <p className="subtitle" style={{ margin: 0 }}>No tasks match your filters.</p>
                    </div>
                  )}
                  {filteredTasks.map((task) => (
                    <motion.div className="row" key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ cursor: 'pointer' }} onClick={() => setDrawer({ type: 'task', id: task.id })}>
                      <div className="row-main">
                        <div className="row-title">{task.title}</div>
                        <div className="row-subtitle">
                          {task.description || 'No description'}
                          {' | '}
                          {task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString()} | ` : ''}
                          Created {new Date(task.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="row-actions">
                        <span className="row-subtitle">By {task.creatorName}</span>
                        <span className="row-subtitle">To {task.assigneeName}</span>
                        <Pill label={PRIORITY_META[task.priority]?.label || task.priority} color={PRIORITY_META[task.priority]?.color || 'var(--text-soft)'} />
                        <Pill label={STATUS_META[task.status]?.label || task.status} color={STATUS_META[task.status]?.color || 'var(--text-soft)'} />
                        <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setDrawer({ type: 'task', id: task.id }); }}>Details</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {tab === 'audit' && (
              <div className="list">
                {auditRows.length === 0 && (
                  <div className="empty">
                    <div className="empty-icon" aria-hidden>📜</div>
                    <p className="subtitle" style={{ margin: 0 }}>No role changes logged yet.</p>
                  </div>
                )}
                {auditRows.map((row) => (
                  <div className="row" key={row.id}>
                    <div className="row-main">
                      <div className="row-title">{row.subjectLabel}</div>
                      <div className="row-subtitle">
                        {ROLE_META[row.old_role]?.label || row.old_role} → {ROLE_META[row.new_role]?.label || row.new_role}
                        {' · '}by {row.actorLabel}
                      </div>
                    </div>
                    <div className="row-actions">
                      <span className="row-subtitle">{new Date(row.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {drawer && (
          <motion.div className="drawer-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="drawer-scrim" onClick={() => setDrawer(null)} aria-label="Close details" />
            <motion.aside
              className="detail-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {selectedUser && (
                <>
                  <div className="drawer-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <Avatar name={selectedUser.full_name} email={selectedUser.email} size={48} seed={selectedUser.id} />
                      <div className="row-main">
                        <p className="eyebrow">User profile</p>
                        <h2 className="drawer-title">{displayName(selectedUser.full_name, selectedUser.email, 'Unnamed user')}</h2>
                        <p className="drawer-subtitle">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="drawer-close-row">
                      <button type="button" className="btn" onClick={() => setDrawer(null)}>Close</button>
                    </div>
                  </div>

                  <div className="drawer-body">
                    <div className="drawer-section">
                      <div className="drawer-inline">
                        <Pill label={ROLE_META[selectedUser.role]?.label || selectedUser.role} color={ROLE_META[selectedUser.role]?.color || 'var(--text-soft)'} />
                        <span className="row-subtitle">Joined {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                      <label className="label" style={{ marginTop: 18 }}>Role control</label>
                      <select
                        className="select"
                        value={selectedUser.role}
                        disabled={updating === selectedUser.id}
                        onChange={(e) => handleRoleChange(selectedUser.id, e.target.value)}
                      >
                        {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
                      </select>
                    </div>

                    <div className="drawer-stat-grid">
                      <InfoTile label="Assigned" value={selectedUser.taskStats.assigned} accent="var(--blue)" />
                      <InfoTile label="Active" value={selectedUser.active} accent="var(--amber)" />
                      <InfoTile label="Completed" value={selectedUser.taskStats.completed} accent="var(--green)" />
                      <InfoTile label="Completion" value={`${selectedUser.completion}%`} accent="var(--gold-2)" />
                    </div>

                    <div className="drawer-section">
                      <div className="drawer-section-head">
                        <h3 className="panel-title">Assigned tasks</h3>
                        <span className="table-meta">{selectedUserTasks.length} total</span>
                      </div>
                      {selectedUserTasks.length === 0 ? (
                        <div className="thread-empty subtle-card">
                          <p className="subtitle" style={{ margin: 0 }}>Nothing assigned.</p>
                        </div>
                      ) : (
                        <div className="drawer-list">
                          {selectedUserTasks.map((task) => (
                            <button type="button" key={task.id} className="drawer-list-row" onClick={() => setDrawer({ type: 'task', id: task.id })}>
                              <span style={{ textAlign: 'left' }}>
                                <span className="row-title">{task.title}</span>
                                <span className="row-subtitle">{new Date(task.created_at).toLocaleDateString()}</span>
                              </span>
                              <Pill label={STATUS_META[task.status]?.label || task.status} color={STATUS_META[task.status]?.color || 'var(--text-soft)'} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {selectedTask && (
                <>
                  <div className="drawer-head">
                    <div className="row-main">
                      <p className="eyebrow">Task details</p>
                      <h2 className="drawer-title">{selectedTask.title}</h2>
                      <p className="drawer-subtitle">
                        Created {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString() : 'Unknown'}
                        {selectedTask.due_date && (
                          <> · Due {new Date(selectedTask.due_date).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                    <div className="drawer-close-row">
                      <button type="button" className="btn" onClick={() => setDrawer(null)}>Close</button>
                    </div>
                  </div>

                  <div className="drawer-body">
                    <div className="drawer-section">
                      <div className="drawer-inline">
                        <Pill label={PRIORITY_META[selectedTask.priority]?.label || selectedTask.priority} color={PRIORITY_META[selectedTask.priority]?.color || 'var(--text-soft)'} />
                        <Pill label={STATUS_META[selectedTask.status]?.label || selectedTask.status} color={STATUS_META[selectedTask.status]?.color || 'var(--text-soft)'} />
                        <span className="row-subtitle">{selectedTask.assigned_to ? 'Assigned' : 'Unassigned'}</span>
                      </div>
                      <p className="drawer-description">{selectedTask.description || 'No description has been added for this task.'}</p>
                    </div>

                    <div className="drawer-stat-grid">
                      <InfoTile label="Status" value={STATUS_META[selectedTask.status]?.label || selectedTask.status} accent={STATUS_META[selectedTask.status]?.color || 'var(--text)'} />
                      <InfoTile label="Created by" value={selectedTask.creatorName} accent="var(--gold-2)" />
                      <InfoTile label="Assigned to" value={selectedTask.assigneeName} accent="var(--blue)" />
                      <InfoTile label="Priority" value={PRIORITY_META[selectedTask.priority]?.label || selectedTask.priority} accent="var(--amber)" />
                    </div>

                    <div className="drawer-section">
                      <h3 className="panel-title">People</h3>
                      <div className="drawer-list" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="drawer-list-row"
                          disabled={!selectedTaskCreator}
                          onClick={() => selectedTaskCreator && setDrawer({ type: 'user', id: selectedTaskCreator.id })}
                        >
                          <span>
                            <span className="row-title">Creator</span>
                            <span className="row-subtitle">{selectedTask.creatorName}</span>
                          </span>
                          {selectedTaskCreator && <Pill label={ROLE_META[selectedTaskCreator.role]?.label || selectedTaskCreator.role} color={ROLE_META[selectedTaskCreator.role]?.color || 'var(--text-soft)'} />}
                        </button>
                        <button
                          type="button"
                          className="drawer-list-row"
                          disabled={!selectedTaskAssignee}
                          onClick={() => selectedTaskAssignee && setDrawer({ type: 'user', id: selectedTaskAssignee.id })}
                        >
                          <span>
                            <span className="row-title">Assignee</span>
                            <span className="row-subtitle">{selectedTask.assigneeName}</span>
                          </span>
                          {selectedTaskAssignee && <Pill label={ROLE_META[selectedTaskAssignee.role]?.label || selectedTaskAssignee.role} color={ROLE_META[selectedTaskAssignee.role]?.color || 'var(--text-soft)'} />}
                        </button>
                      </div>
                    </div>

                    <TaskComments taskId={selectedTask.id} />
                  </div>
                </>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
