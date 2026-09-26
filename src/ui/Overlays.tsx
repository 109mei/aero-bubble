import { useEffect } from 'react';
import { clearToast, removeBanner, removePopup, useGame } from '../store/game';

/** はじけた場所から浮かぶ点数 */
export function Popups() {
  const popups = useGame((st) => st.popups);
  return (
    <>
      {popups.map((p) => (
        <span key={p.id} className={`popup ${p.kind}`} style={{ left: p.x, top: p.y }} onAnimationEnd={() => removePopup(p.id)} aria-hidden="true">
          {p.text}
        </span>
      ))}
    </>
  );
}

/** 盤面のまんなかに出す知らせ（ナイス・アクアボム誕生・エアロタイム・タイムアップ） */
export function Banners() {
  const banners = useGame((st) => st.banners);
  const L = useGame((st) => st.layout);
  const cy = L.panel.y + Math.min(L.panel.h * 0.42, 220);
  return (
    <div className="banners" style={{ top: cy }} aria-live="polite">
      {banners.map((b, i) => (
        // 2つ重なるときは、古いほうを上へずらす
        <div key={b.id} className="banner-slot" style={{ top: (i - (banners.length - 1)) * 92 }}>
          <div className={`banner ${b.kind}`} data-testid={`banner-${b.kind}`} onAnimationEnd={(e) => e.target === e.currentTarget && removeBanner(b.id)}>
            <span className="banner-text">{b.text}</span>
            {b.sub && <span className="banner-sub">{b.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** はじめの 3・2・1 */
export function Countdown() {
  const n = useGame((st) => (st.screen === 'game' && st.sheet === null ? (st.round?.countdown ?? null) : null));
  const L = useGame((st) => st.layout);
  if (n === null) return null;
  return (
    <div className="countdown" style={{ top: L.panel.y + L.panel.h / 2 }} aria-live="assertive">
      <span key={n} data-testid="countdown" data-value={n}>
        {n}
      </span>
    </div>
  );
}

export function Toast() {
  const toast = useGame((st) => st.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => clearToast(toast.id), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" data-testid="toast">
      {toast.text}
    </div>
  );
}
