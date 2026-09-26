import { gameData } from '../data';
import { openSheet, play, useGame } from '../store/game';
import { sound } from './audio';
import { num } from './format';
import { CircleQuestionMark, Fish, Play, Settings, Trophy } from './icons';

/** タイトル：空に浮かぶロゴと、水の中のボタン */
export function Title() {
  const L = useGame((st) => st.layout);
  const progress = useGame((st) => st.progress);
  const best = progress?.best ?? 0;
  const got = progress?.unlocked.length ?? 0;
  const total = gameData.creatures.length;
  const bottom = L.frameH - L.safeBottom;
  return (
    <div className="title-screen">
      <div className="logo" style={{ top: L.safeTop + Math.max(26, (L.surfaceTitle - L.safeTop - 190) * 0.45) }}>
        <h1 className="logo-main" aria-label="エアロバブル">
          <span className="logo-line">AERO</span>
          <span className="logo-line">BUBBLE</span>
        </h1>
        <p className="logo-sub">エアロバブル</p>
      </div>
      {best > 0 && (
        <div className="best-chip" style={{ top: L.surfaceTitle + 18 }} data-testid="best">
          <Trophy size={16} strokeWidth={2.4} aria-hidden="true" />
          ベスト <b>{num(best)}</b>
        </div>
      )}
      <p className="tagline" style={{ top: bottom - 262 }}>
        おなじ色の泡を なぞって つなげよう
      </p>
      <button
        className="glossy-btn go play-btn"
        style={{ top: bottom - 222 }}
        data-testid="play"
        onClick={() => {
          sound.unlock();
          sound.tap();
          play();
        }}
      >
        <Play size={26} strokeWidth={2.8} fill="currentColor" aria-hidden="true" />
        あそぶ
      </button>
      <div className="title-row" style={{ top: bottom - 132 }}>
        <button className="orb-btn" data-testid="open-aquarium" onClick={() => openSheet('aquarium')}>
          <Fish size={26} strokeWidth={2.2} aria-hidden="true" />
          <span>アクアリウム</span>
          <small>
            {got}/{total}
          </small>
        </button>
        <button className="orb-btn" data-testid="open-howto" onClick={() => openSheet('howto')}>
          <CircleQuestionMark size={26} strokeWidth={2.2} aria-hidden="true" />
          <span>あそびかた</span>
        </button>
        <button className="orb-btn" data-testid="open-settings" onClick={() => openSheet('settings')}>
          <Settings size={26} strokeWidth={2.2} aria-hidden="true" />
          <span>せってい</span>
        </button>
      </div>
    </div>
  );
}
