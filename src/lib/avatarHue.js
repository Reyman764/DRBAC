/** Stable hue 0–360 from a profile id / email string for avatar backgrounds */
export function hueFromSeed(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function avatarGradientStyle(seed) {
  const h = hueFromSeed(seed);
  const h2 = (h + 48) % 360;
  return {
    '--avatar-h': `${h}`,
    borderColor: 'rgba(255,255,255,0.22)',
    background: `linear-gradient(135deg, hsl(${h} 52% 38%) / 0.85, hsl(${h2} 45% 28%) / 0.72)`,
  };
}
