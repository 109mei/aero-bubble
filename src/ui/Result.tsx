import { gameData } from '../data';
import { quitToTitle, showToast, startRound, useGame } from '../store/game';
import { CreatureIcon } from './CreatureIcon';
import { num } from './format';
import { CountUp } from './Hud';
import { House, RotateCcw, Share2, Sparkles } from './icons';

const SHARE_URL = 'https://109mei.github.io/aero-bubble/';

async function share(score: number): Promise<void> {
  const text = `エアロバブルで ${num(score)} 点！ おなじ色の泡をなぞってつなぐ、つやつやのパズル`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'エアロバブル', text, url: SHARE_URL });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${SHARE_URL}`);
    showToast('記録の文をコピーしました');
  } catch {
    // 共有を閉じたときは何もしない
  }
}

/** 結果：点数・記録・新しい仲間 */
export function Result() {
  const result = useGame((st) => st.result);
  const progress = useGame((st) => st.progress);
  const L = useGame((st) => st.layout);
  if (!result) return null;
  const s = result.stats;
  const best = progress?.best ?? result.score;
  const friends = result.unlocked.map((id) => gameData.creatures.find((c) => c.id === id)).filter((c) => c !== undefined);
  const stats: [string, string][] = [
    ['はじけた泡', `${num(s.popped)}個`],
    ['最長つなぎ', `${s.maxChain}`],
    ['最大コンボ', `${s.maxCombo}`],
    ['エアロタイム', `${s.fevers}回`],
    ['アクアボム', `${s.bombsMade}個`],
    ['プリズム', `${s.prismsMade}個`],
  ];
  return (
    <div className="result-screen" style={{ top: L.safeTop + 12, bottom: L.safeBottom + 12 }}>
      <div className="glass-card result-card" data-testid="result">
        <h2 className="result-title">けっか</h2>
        {result.newBest && (
          <div className="ribbon" data-testid="new-best">
            <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />
            {result.prevBest === 0 ? 'はじめての記録' : 'ベスト更新'}
          </div>
        )}
        <CountUp value={result.score} className="result-score" testId="result-score" duration={1.2} />
        <p className="best-line">
          ベスト <b>{num(best)}</b>
        </p>
        <dl className="stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {friends.length > 0 && (
          <div className="new-friends" data-testid="new-friends">
            <h3>なかまがふえた</h3>
            <ul>
              {friends.map((c) => (
                <li key={c.id}>
                  <CreatureIcon id={c.id} size={64} />
                  <span>{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="result-buttons">
          <button className="glossy-btn go" data-testid="retry" onClick={() => startRound()}>
            <RotateCcw size={22} strokeWidth={2.8} aria-hidden="true" />
            もういちど
          </button>
          <div className="result-sub">
            <button className="glossy-btn blue small" data-testid="to-title" onClick={() => quitToTitle()}>
              <House size={20} strokeWidth={2.6} aria-hidden="true" />
              タイトル
            </button>
            <button className="glossy-btn blue small" onClick={() => void share(result.score)}>
              <Share2 size={20} strokeWidth={2.6} aria-hidden="true" />
              シェア
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
