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

  const filteredUsers = useMemo(() => {
    let list = roleFilter === 'all' ? users : users.filter((user) => user.role === roleFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((user) => user.email?.toLowerCase().includes(term) || user.full_name?.toLowerCase().includes(term));
    }
    return list;
  }, [users, roleFilter, search]);

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

  const enrichedTasks = useMemo(() => tasks.map((task) => {
    const assignee = users.find((user) => user.id === task.assigned_to);
    const creator = users.find((user) => user.id === task.created_by);
    return {
      ...task,
      assigneeName: assignee?.full_name || assignee?.email || 'Unassigned',
      creatorName: creator?.full_name || creator?.email || 'Unknown',
    };
  }), [tasks, users]);

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.completed / stats.totalTasks) * 100) : 0;

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
              {tab === 'users' && <input className="field" style={{ maxWidth: 330 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" />}
            </div>

            {tab === 'users' && (
              <>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
                  <div className="segmented">
                    {['all', 'super_admin', 'admin', 'member'].map((role) => (
                      <button key={role} className={`segment ${roleFilter === role ? 'active' : ''}`} onClick={() => setRoleFilter(role)}>
                        {role === 'all' ? 'All roles' : ROLE_META[role].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="list">
                  {filteredUsers.length === 0 && <div className="empty">No users match your filters.</div>}
                  {filteredUsers.map((user) => {
                    const taskStats = getUserTaskStats(user.id);
                    const expanded = expandedId === user.id;
                    const pct = taskStats.assigned > 0 ? Math.round((taskStats.completed / taskStats.assigned) * 100) : 0;
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
              <div className="list">
                {enrichedTasks.length === 0 && <div className="empty">No tasks found.</div>}
                {enrichedTasks.map((task) => (
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
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
