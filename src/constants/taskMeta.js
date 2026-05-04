export const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];

export const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--amber)' },
  in_progress: { label: 'In progress', color: 'var(--blue)' },
  completed: { label: 'Completed', color: 'var(--green)' },
  cancelled: { label: 'Cancelled', color: 'var(--red)' },
};

/** Matches DB constraint task_priority */
export const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

export const PRIORITY_META = {
  low: { label: 'Low', color: 'var(--text-muted)' },
  medium: { label: 'Medium', color: 'var(--blue)' },
  high: { label: 'High', color: 'var(--amber)' },
  urgent: { label: 'Urgent', color: 'var(--red)' },
};

export const TASK_LIMITS = {
  titleMax: 200,
  descriptionMax: 8000,
  commentMax: 2000,
  fullNameMax: 120,
};
