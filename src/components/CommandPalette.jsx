import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { emitOpenProfile, emitOpenTask } from '../lib/appEvents';

/**
 * ⌘K / Ctrl+K — quick actions + role-aware task lookup.
 */
export default function CommandPalette({ role }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const loadTasks = useCallback(async () => {
    if (!role) return;
    setLoadingTasks(true);
    try {
      if (role === 'super_admin') {
        const { data } = await supabase.from('tasks').select('id,title').order('created_at', { ascending: false }).limit(120);
        setTasks(data ?? []);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTasks([]);
        return;
      }
      if (role === 'admin') {
        const { data } = await supabase.from('tasks').select('id,title').eq('created_by', session.user.id).order('created_at', { ascending: false }).limit(120);
        setTasks(data ?? []);
        return;
      }
      const { data } = await supabase.from('tasks').select('id,title').eq('assigned_to', session.user.id).order('created_at', { ascending: false }).limit(120);
      setTasks(data ?? []);
    } finally {
      setLoadingTasks(false);
    }
  }, [role]);

  useEffect(() => {
    if (open) {
      setQuery('');
      loadTasks();
    }
  }, [open, loadTasks]);

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => (
    tasks.filter((t) => !q || t.title.toLowerCase().includes(q)).slice(0, 40)
  ), [tasks, q]);

  const openProfile = () => {
    emitOpenProfile();
    setOpen(false);
  };

  const pickTask = (id) => {
    emitOpenTask(id);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop cmd-palette-layer"
          style={{ alignItems: 'flex-start', paddingTop: '12vh', zIndex: 100 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={() => setOpen(false)}
        >
          <motion.div
            className="modal cmd-palette-modal"
            style={{ overflow: 'hidden' }}
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <p className="eyebrow" style={{ margin: 0 }}>Command palette</p>
              <input
                className="field"
                style={{ marginTop: 10 }}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks…"
              />
            </div>
            <div className="cmd-palette-actions">
              <button type="button" className="cmd-palette-row" onClick={openProfile}>
                <span className="cmd-palette-meta">⌘ shortcut</span>
                <span>Open profile settings</span>
              </button>
            </div>
            <div className="cmd-palette-results">
              {loadingTasks && <div className="subtitle" style={{ padding: '10px 16px', margin: 0 }}>Loading tasks…</div>}
              {!loadingTasks && matches.length === 0 && (
                <div className="subtitle" style={{ padding: '10px 16px', margin: 0 }}>No matching tasks.</div>
              )}
              {!loadingTasks && matches.map((t) => (
                <button type="button" key={t.id} className="cmd-palette-row" onClick={() => pickTask(t.id)}>
                  <span className="cmd-palette-meta">Open</span>
                  <span>{t.title}</span>
                </button>
              ))}
            </div>
            <div className="subtitle" style={{ padding: '8px 14px', fontSize: 11, margin: 0 }}>
              Esc to close • Ctrl/⌘K to toggle • Select a task to open details in your dashboard
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
