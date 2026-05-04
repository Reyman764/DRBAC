import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TASK_LIMITS } from '../constants/taskMeta';
import Avatar from './Avatar';

export default function TaskComments({ taskId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('task_comments')
      .select('id, body, author_id, author_display_name, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (!error) setItems(data ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || body.length > TASK_LIMITS.commentMax) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('task_comments')
      .insert([{ task_id: taskId, author_id: session.user.id, body }])
      .select('id, body, author_id, author_display_name, created_at')
      .single();
    setPosting(false);
    if (!error && data) {
      setItems((prev) => [...prev, data]);
      setDraft('');
    }
  };

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <div className="drawer-section" style={{ marginTop: 0 }}>
      <h3 className="panel-title" style={{ marginBottom: 14 }}>Thread</h3>
      {loading && <p className="subtitle">Loading comments…</p>}
      {empty && (
        <div className="thread-empty subtle-card">
          <p className="subtitle" style={{ margin: 0 }}>No messages yet — start the thread.</p>
        </div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((c) => (
          <div key={c.id} className="thread-row subtle-card">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar name={c.author_display_name} email={c.author_display_name} seed={c.author_id} size={34} />
              <div style={{ minWidth: 0 }}>
                <div className="row-title" style={{ fontSize: 13 }}>{c.author_display_name}</div>
                <div className="row-subtitle">{new Date(c.created_at).toLocaleString()}</div>
                <p className="drawer-description" style={{ marginTop: 10 }}>{c.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className="form-grid" style={{ marginTop: 16 }} onSubmit={post}>
        <div>
          <label className="label">Reply</label>
          <textarea
            className="textarea"
            rows={3}
            value={draft}
            maxLength={TASK_LIMITS.commentMax}
            onChange={(ev) => setDraft(ev.target.value)}
            placeholder="Add a comment"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={posting || !draft.trim()}>{posting ? 'Posting…' : 'Post'}</button>
      </form>
    </div>
  );
}
