import { useEffect, useRef } from 'react';
import { useGame } from '../store/game';
import { CREATURE_ART } from '../world/art/creatures';

/** アクアリウムの仲間の絵（まだ仲間でなければ影だけ） */
export function CreatureIcon({ id, size, locked = false }: { id: string; size: number; locked?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = useGame((st) => st.layout.scale);
  const art = CREATURE_ART[id];
  const aspect = art?.aspect ?? 1;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  useEffect(() => {
    const c = ref.current;
    if (!c || !art) return;
    const k = Math.min(3, (window.devicePixelRatio || 1) * scale);
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    art.paint(ctx, c.width, c.height);
    if (locked) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = 'rgba(20,70,130,0.38)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [art, w, h, locked, scale]);
  return <canvas ref={ref} className="creature-icon" style={{ width: w, height: h }} aria-hidden="true" />;
}
