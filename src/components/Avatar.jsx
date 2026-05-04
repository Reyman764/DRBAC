import { avatarGradientStyle } from '../lib/avatarHue';

/** Two-letter initials avatar with stable per-user gradient from `seed` (typically user id). */
export default function Avatar({ name, email, seed, size = 38 }) {
  const base = (name || email || '?').slice(0, 2).toUpperCase();
  const s = seed ?? email ?? name ?? base;
  return (
    <div
      className="avatar avatar-hued"
      style={{ width: size, height: size, fontSize: size * 0.34, ...avatarGradientStyle(s) }}
    >
      {base}
    </div>
  );
}
