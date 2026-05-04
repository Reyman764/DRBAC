import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { TASK_LIMITS } from '../constants/taskMeta';
import { emitProfileUpdated } from '../lib/appEvents';

export default function ProfileSettings({ open, onClose, onSaved }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let m = true;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !m) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', session.user.id)
        .single();
      if (!m) return;
      if (error) setErr(error.message);
      else {
        setFullName(typeof data.full_name === 'string' ? data.full_name.trim() : '');
        setEmail(data.email ?? session.user.email ?? '');
      }
      setLoading(false);
    })();
    return () => { m = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const save = useCallback(async (e) => {
    e?.preventDefault();
    const trimmed = fullName.trim();
    if (trimmed.length > TASK_LIMITS.fullNameMax) {
      setErr(`Name must be at most ${TASK_LIMITS.fullNameMax} characters.`);
      return;
    }
    setSaving(true);
    setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      setErr('Not signed in.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed === '' ? null : trimmed })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    emitProfileUpdated();
    onSaved?.(trimmed === '' ? null : trimmed);
    onClose?.();
  }, [fullName, onClose, onSaved]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <h2 className="panel-title">Profile settings</h2>
              <button type="button" className="btn" onClick={onClose}>Close</button>
            </div>
            <div className="modal-body form-grid">
              {loading ? <p className="subtitle">Loading…</p> : (
                <>
                  <div>
                    <label className="label">Email</label>
                    <input className="field" readOnly disabled value={email} />
                  </div>
                  <div>
                    <label className="label">Full name</label>
                    <input
                      className="field"
                      value={fullName}
                      maxLength={TASK_LIMITS.fullNameMax}
                      onChange={(ev) => setFullName(ev.target.value)}
                      placeholder="Shown across the workspace"
                    />
                  </div>
                  {err && <p className="subtitle" style={{ color: 'var(--red)', margin: 0 }}>{err}</p>}
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
