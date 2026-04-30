// src/components/AdminTaskCreator.jsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];

const STATUS_COLORS = {
  pending:     'text-amber-400',
  in_progress: 'text-sky-400',
  completed:   'text-emerald-400',
  cancelled:   'text-red-400',
};

const fieldVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const INITIAL_FORM = {
  title:       '',
  description: '',
  assigned_to: '',
  status:      'pending',
};

export default function AdminTaskCreator() {
  const [form,       setForm]       = useState(INITIAL_FORM);
  const [members,    setMembers]    = useState([]);
  const [loadingMem, setLoadingMem] = useState(true);
  const [memberErr,  setMemberErr]  = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState(null); // { type, text }

  // ── Fetch members for the dropdown ────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function fetchMembers() {
      setLoadingMem(true);
      setMemberErr(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'member')
        .order('full_name', { ascending: true });

      if (!isMounted) return;
      setLoadingMem(false);

      if (error) {
        setMemberErr(error.message);
        return;
      }
      setMembers(data ?? []);
    }

    fetchMembers();
    return () => { isMounted = false; };
  }, []);

  // ── Form field change ──────────────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFeedback(null);
  }, []);

  // ── Submit new task ────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setFeedback({ type: 'error', text: 'Task title is required.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    // Get current session to set created_by
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFeedback({ type: 'error', text: 'Not authenticated. Please log in again.' });
      setSubmitting(false);
      return;
    }

    const payload = {
      title:       form.title.trim(),
      description: form.description.trim() || null,
      created_by:  session.user.id,
      assigned_to: form.assigned_to || null,
      status:      form.status,
    };

    const { error } = await supabase
      .from('tasks')
      .insert([payload]);

    setSubmitting(false);

    if (error) {
      setFeedback({ type: 'error', text: `Failed to create task: ${error.message}` });
      return;
    }

    setFeedback({ type: 'success', text: '✓ Task created successfully!' });
    setForm(INITIAL_FORM);
  }, [form]);

  return (
    <div className="min-h-screen bg-[#0c0c14] text-slate-100 font-sans p-6 md:p-10 flex items-start justify-center">
      <div className="w-full max-w-xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🗂️</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Create <span className="text-amber-400">Task</span>
            </h1>
          </div>
          <p className="text-slate-400 text-sm ml-10">
            Assign tasks to team members. RLS ensures only your tasks are visible to you.
          </p>
        </motion.div>

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              key={feedback.text}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/15 border-red-500/30 text-red-300'
              }`}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Card */}
        <motion.form
          onSubmit={handleSubmit}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="bg-[#111120] border border-white/10 rounded-2xl p-6 space-y-5"
        >
          {/* Title */}
          <motion.div variants={fieldVariants}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Task Title *
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Update onboarding documentation"
              className="
                w-full bg-[#0c0c14] border border-white/10 rounded-xl
                px-4 py-3 text-sm text-slate-100 placeholder-slate-600
                focus:outline-none focus:ring-2 focus:ring-amber-500/50
                transition-all duration-200
              "
            />
          </motion.div>

          {/* Description */}
          <motion.div variants={fieldVariants}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional task details…"
              className="
                w-full bg-[#0c0c14] border border-white/10 rounded-xl
                px-4 py-3 text-sm text-slate-100 placeholder-slate-600
                focus:outline-none focus:ring-2 focus:ring-amber-500/50
                resize-none transition-all duration-200
              "
            />
          </motion.div>

          {/* Assign To (Members only) */}
          <motion.div variants={fieldVariants}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Assign To
            </label>
            {loadingMem ? (
              <div className="w-full bg-[#0c0c14] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-500 animate-pulse">
                Loading members…
              </div>
            ) : memberErr ? (
              <div className="text-xs text-red-400 mt-1">{memberErr}</div>
            ) : (
              <select
                name="assigned_to"
                value={form.assigned_to}
                onChange={handleChange}
                className="
                  w-full bg-[#0c0c14] border border-white/10 rounded-xl
                  px-4 py-3 text-sm text-slate-100
                  focus:outline-none focus:ring-2 focus:ring-amber-500/50
                  cursor-pointer transition-all duration-200
                "
              >
                <option value="">— Unassigned —</option>
                {members.length === 0 && (
                  <option disabled>No members available</option>
                )}
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ? `${m.full_name} (${m.email})` : m.email}
                  </option>
                ))}
              </select>
            )}
          </motion.div>

          {/* Status */}
          <motion.div variants={fieldVariants}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, status: s })); setFeedback(null); }}
                  className={`
                    py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all duration-200
                    ${form.status === s
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                    }
                  `}
                >
                  <span className={form.status === s ? STATUS_COLORS[s] : ''}>
                    {s.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Submit */}
          <motion.div variants={fieldVariants} className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="
                w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40
                text-black font-bold text-sm py-3.5 rounded-xl
                transition-all duration-200 active:scale-[0.98]
                flex items-center justify-center gap-2
              "
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                '+ Create Task'
              )}
            </button>
          </motion.div>
        </motion.form>
      </div>
    </div>
  );
}
