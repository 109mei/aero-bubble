import { useState, type ReactNode } from 'react';
import { conditionProgress } from '../core';
import { gameData, type Condition } from '../data';
import { closeSheet, game, importSave, openSheet, quitToTitle, resetAll, setSettings, showToast, startRound, useGame } from '../store/game';
import { canVibrate } from './haptics';
import { CreatureIcon } from './CreatureIcon';
import { num } from './format';
import { Check, ClipboardPaste, Copy, House, Lock, Music, Play, RotateCcw, Trash, Vibrate, Volume2, X } from './icons';

declare const __APP_VERSION__: string;

export function SheetHost() {
  const sheet = useGame((st) => st.sheet);
  if (sheet === null) return null;
  const closable = sheet !== 'pause';
  return (
    <div
      className="sheet-backdrop"
      data-noboard
      onClick={(e) => {
        if (closable && e.target === e.currentTarget) closeSheet();
      }}
    >
      <div className={`sheet glass-card sheet-${sheet}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-testid={`sheet-${sheet}`}>
        {closable && (
          <button className="sheet-close" aria-label="とじる" data-testid="sheet-close" onClick={() => closeSheet()}>
            <X size={22} strokeWidth={2.6} aria-hidden="true" />
          </button>
        )}
        {sheet === 'pause' && <PauseSheet />}
        {sheet === 'settings' && <SettingsSheet />}
        {sheet === 'aquarium' && <AquariumSheet />}
        {sheet === 'howto' && <HowToSheet />}
      </div>
    </div>
  );
}

function Toggle({ label, icon, on, onChange, testId }: { label: string; icon: ReactNode; on: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} data-testid={testId} onClick={() => onChange(!on)}>
      <span className="toggle-icon">{icon}</span>
      <span className="toggle-label">{label}</span>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}

function SoundToggles() {
  const s = useGame((st) => st.settings);
  return (
    <div className="toggles">
      <Toggle label="効果音" icon={<Volume2 size={20} strokeWidth={2.4} />} on={s.sound} onChange={(v) => setSettings({ sound: v })} testId="toggle-sound" />
      <Toggle label="音楽" icon={<Music size={20} strokeWidth={2.4} />} on={s.music} onChange={(v) => setSettings({ music: v })} testId="toggle-music" />
    </div>
  );
}

function PauseSheet() {
  const resumed = useGame((st) => st.resumed);
  return (
    <>
      <h2 id="sheet-title" className="sheet-title">
        {resumed ? 'つづきから あそべます' : 'ひとやすみ'}
      </h2>
      <div className="sheet-buttons">
        <button className="glossy-btn go" data-testid="resume" onClick={() => closeSheet()}>
          <Play size={24} strokeWidth={2.8} fill="currentColor" aria-hidden="true" />
          つづける
        </button>
        <button
          className="glossy-btn blue small"
          data-testid="restart"
          onClick={() => {
            game().quitRound();
            startRound();
          }}
        >
          <RotateCcw size={20} strokeWidth={2.6} aria-hidden="true" />
          はじめから
        </button>
        <button className="glossy-btn blue small" data-testid="quit" onClick={() => quitToTitle()}>
          <House size={20} strokeWidth={2.6} aria-hidden="true" />
          タイトルへ
        </button>
      </div>
      <SoundToggles />
    </>
  );
}

function SettingsSheet() {
  const s = useGame((st) => st.settings);
  const [exported, setExported] = useState<string | null>(null);
  const [importing, setImporting] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const motions: [typeof s.motion, string][] = [
    ['auto', 'おまかせ'],
    ['reduce', 'へらす'],
    ['full', 'ぜんぶ'],
  ];
  return (
    <>
      <h2 id="sheet-title" className="sheet-title">
        せってい
      </h2>
      <SoundToggles />
      {canVibrate() && (
        <div className="toggles">
          <Toggle label="振動" icon={<Vibrate size={20} strokeWidth={2.4} />} on={s.vibration} onChange={(v) => setSettings({ vibration: v })} />
        </div>
      )}
      <section className="setting-block">
        <h3>動き</h3>
        <div className="segmented" role="radiogroup" aria-label="動き">
          {motions.map(([m, label]) => (
            <button key={m} role="radio" aria-checked={s.motion === m} className={s.motion === m ? 'on' : ''} onClick={() => setSettings({ motion: m })}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="setting-block">
        <h3>記録の引っ越し</h3>
        <p className="note">別のブラウザやホーム画面のアプリへ、記録を持っていけます</p>
        <div className="row-buttons">
          <button
            className="glossy-btn blue small"
            data-testid="export"
            onClick={() => {
              const text = game().exportSave();
              setExported(text);
              navigator.clipboard?.writeText(text).then(
                () => showToast('記録のテキストをコピーしました'),
                () => undefined,
              );
            }}
          >
            <Copy size={18} strokeWidth={2.6} aria-hidden="true" />
            書き出す
          </button>
        </div>
        {exported !== null && <textarea className="save-text" readOnly value={exported} data-testid="export-text" aria-label="書き出した記録" onFocus={(e) => e.currentTarget.select()} />}
        <textarea
          className="save-text"
          placeholder="書き出したテキストをここに貼る"
          value={importing}
          onChange={(e) => setImporting(e.target.value)}
          data-testid="import-text"
          aria-label="読み込む記録"
        />
        <div className="row-buttons">
          <button
            className="glossy-btn blue small"
            data-testid="import"
            disabled={importing.trim() === ''}
            onClick={() => {
              if (importSave(importing)) setImporting('');
            }}
          >
            <ClipboardPaste size={18} strokeWidth={2.6} aria-hidden="true" />
            読み込む
          </button>
        </div>
      </section>
      <section className="setting-block">
        <h3>記録を消す</h3>
        {!confirmReset ? (
          <button className="glossy-btn red small" onClick={() => setConfirmReset(true)}>
            <Trash size={18} strokeWidth={2.6} aria-hidden="true" />
            ぜんぶ消す
          </button>
        ) : (
          <div className="confirm">
            <p>ベストと仲間がすべて消えます。消しますか</p>
            <div className="row-buttons">
              <button className="glossy-btn red small" data-testid="reset-yes" onClick={() => resetAll()}>
                <Check size={18} strokeWidth={2.6} aria-hidden="true" />
                消す
              </button>
              <button className="glossy-btn blue small" onClick={() => setConfirmReset(false)}>
                やめる
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="version">エアロバブル 版 {__APP_VERSION__}　音はその場で作っています</p>
    </>
  );
}

function conditionText(c: Condition): string {
  switch (c.type) {
    case 'rounds':
      return `${c.n}回あそぶ`;
    case 'popped':
      return `泡をあわせて${num(c.n)}個はじけさせる`;
    case 'chain':
      return `${c.n}つなぎする`;
    case 'fevers':
      return `エアロタイムをあわせて${c.n}回`;
    case 'feversInRound':
      return `1回のあそびでエアロタイムを${c.n}回`;
    case 'score':
      return `${num(c.n)}点をとる`;
    case 'all':
      return 'ほかの仲間をぜんぶ集める';
  }
}

function AquariumSheet() {
  const progress = useGame((st) => st.progress);
  const list = gameData.creatures;
  const got = new Set(progress?.unlocked ?? []);
  return (
    <>
      <h2 id="sheet-title" className="sheet-title">
        アクアリウム <small data-testid="aquarium-count">{got.size} / {list.length}</small>
      </h2>
      <p className="note">仲間になった生き物は、海の中を泳ぎます</p>
      <ul className="friends">
        {list.map((c) => {
          const has = got.has(c.id);
          const pr = progress ? conditionProgress(progress, c.cond, list) : { value: 0, target: 1 };
          const frac = Math.max(0, Math.min(1, pr.value / pr.target));
          return (
            <li key={c.id} className={`friend${has ? ' has' : ''}`} data-testid={`friend-${c.id}`} data-unlocked={has}>
              <div className="friend-art">
                <CreatureIcon id={c.id} size={76} locked={!has} />
                {!has && <Lock className="friend-lock" size={18} strokeWidth={2.6} aria-hidden="true" />}
              </div>
              <div className="friend-name">{has ? c.name : '？？？'}</div>
              <div className="friend-desc">{has ? c.desc : conditionText(c.cond)}</div>
              {!has && (
                <div className="friend-progress" role="progressbar" aria-valuemin={0} aria-valuemax={pr.target} aria-valuenow={Math.min(pr.value, pr.target)}>
                  <span style={{ transform: `scaleX(${frac})` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function HowToSheet() {
  const startAfter = useGame((st) => st.startAfterHowto);
  return (
    <>
      <h2 id="sheet-title" className="sheet-title">
        あそびかた
      </h2>
      <ol className="howto">
        <li>
          <HowArt kind="link" />
          <div>
            <b>おなじ色の泡を指でなぞる</b>
            <span>となりどうしを3つ以上つないで、指をはなすとはじける。長いほど点が大きい</span>
          </div>
        </li>
        <li>
          <HowArt kind="special" />
          <div>
            <b>7つでアクアボム・11つでプリズム</b>
            <span>タップすると、まわりや同じ色の泡をまとめて消せる</span>
          </div>
        </li>
        <li>
          <HowArt kind="fever" />
          <div>
            <b>ゲージがたまるとエアロタイム</b>
            <span>時間が止まって点が2倍。続けて消すとコンボでさらに上がる</span>
          </div>
        </li>
      </ol>
      <p className="note">60秒でどこまで点をのばせるかな。遊ぶほどアクアリウムの仲間が増えていく</p>
      <div className="sheet-buttons">
        <button className="glossy-btn go" data-testid="howto-ok" onClick={() => closeSheet()}>
          {startAfter ? (
            <>
              <Play size={22} strokeWidth={2.8} fill="currentColor" aria-hidden="true" />
              はじめる
            </>
          ) : (
            'わかった'
          )}
        </button>
      </div>
    </>
  );
}

/** あそびかたの小さな絵（SVG） */
function HowArt({ kind }: { kind: 'link' | 'special' | 'fever' }) {
  const bubble = (x: number, y: number, c: string, key?: string) => (
    <g key={key ?? `${x}-${y}`}>
      <circle cx={x} cy={y} r="11" fill={c} />
      <ellipse cx={x} cy={y - 5} rx="7" ry="4" fill="#fff" opacity="0.75" />
      <circle cx={x} cy={y} r="11" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" />
    </g>
  );
  if (kind === 'link') {
    const pts: [number, number][] = [
      [16, 40],
      [36, 30],
      [56, 40],
      [76, 30],
    ];
    return (
      <svg className="how-art" viewBox="0 0 92 64" aria-hidden="true">
        {bubble(16, 16, '#FF4C9D')}
        {bubble(76, 54, '#32C23A')}
        {pts.map(([x, y]) => bubble(x, y, '#1E96FF'))}
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="80" cy="38" r="6" fill="#fff" stroke="#0B58D0" strokeWidth="2" />
      </svg>
    );
  }
  if (kind === 'special') {
    return (
      <svg className="how-art" viewBox="0 0 92 64" aria-hidden="true">
        <circle cx="30" cy="32" r="18" fill="#34C6F4" />
        <path d="M30 20 a12 12 0 1 1 -10 18" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="30" cy="22" rx="11" ry="6" fill="#fff" opacity="0.7" />
        <circle cx="68" cy="32" r="18" fill="#FFE27A" />
        <circle cx="68" cy="32" r="13" fill="none" stroke="#FF4C9D" strokeWidth="4" />
        <circle cx="68" cy="32" r="5" fill="#fff" />
        <ellipse cx="68" cy="22" rx="11" ry="6" fill="#fff" opacity="0.7" />
      </svg>
    );
  }
  return (
    <svg className="how-art" viewBox="0 0 92 64" aria-hidden="true">
      <rect x="6" y="24" width="80" height="16" rx="8" fill="#DDF4FF" stroke="#fff" strokeWidth="2" />
      <rect x="8" y="26" width="66" height="12" rx="6" fill="#39D98A" />
      <rect x="10" y="27" width="62" height="4" rx="2" fill="#fff" opacity="0.6" />
      <path d="M20 12 l3 6 l6 1 l-5 4 l2 6 l-6 -3 l-6 3 l2 -6 l-5 -4 l6 -1z" fill="#FFD84F" />
      <path d="M70 46 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -1z" fill="#B99BFF" />
    </svg>
  );
}

export { openSheet };
