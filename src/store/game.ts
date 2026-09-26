import { create } from 'zustand';
import type { GameEvent, Progress, RoundResult } from '../core';
import type { Settings } from '../save';
import { DEFAULT_SETTINGS } from '../save';
import { cellCenter, computeLayout, type Layout } from '../world/layout';
import type { GameRuntime } from './runtime';
import { buildRoundView, type RoundView } from './view';

/**
 * 画面（React）への橋渡し。ルール本体の写し（round）と、画面だけの状態（今の画面・開いているシート・浮かぶ点数）を持つ。
 * 残り時間などは1秒に10回ほど写し直す。書き換えはすべて runtime の命令を通す。
 */

export type Screen = 'title' | 'game' | 'result';
export type SheetKind = 'pause' | 'settings' | 'aquarium' | 'howto';

export interface Popup {
  id: number;
  /** 基準の座標 */
  x: number;
  y: number;
  text: string;
  kind: 'chain' | 'burst' | 'big';
}

export interface Banner {
  id: number;
  kind: 'praise' | 'fever' | 'timeUp' | 'start' | 'shuffle' | 'special';
  text: string;
  sub?: string;
}

export interface GameStore {
  round: RoundView | null;
  progress: Progress | null;
  result: RoundResult | null;
  screen: Screen;
  sheet: SheetKind | null;
  /** あそびの途中で再読み込みしたときの「つづきから」 */
  resumed: boolean;
  /** あそびかたを閉じたら始める */
  startAfterHowto: boolean;
  popups: Popup[];
  banners: Banner[];
  toast: { id: number; text: string } | null;
  settings: Settings;
  /** 動きを減らすか（設定と端末の設定から決める） */
  reduced: boolean;
  layout: Layout;
}

export const useGame = create<GameStore>(() => ({
  round: null,
  progress: null,
  result: null,
  screen: 'title',
  sheet: null,
  resumed: false,
  startAfterHowto: false,
  popups: [],
  banners: [],
  toast: null,
  settings: { ...DEFAULT_SETTINGS },
  reduced: false,
  layout: computeLayout(390, 844, 0, 0, 7, 8),
}));

/** 同時に出す浮かぶ点数・知らせの上限 */
const MAX_POPUPS = 5;
const MAX_BANNERS = 2;

let runtime: GameRuntime | null = null;
let effectId = 1;
let systemReduced = false;

export function game(): GameRuntime {
  if (runtime === null) throw new Error('runtime がまだない');
  return runtime;
}

export function setRuntime(r: GameRuntime, resumed: boolean): void {
  runtime = r;
  r.addListener(onEvents);
  useGame.setState({
    settings: { ...r.settings },
    screen: r.state.round !== null ? 'game' : 'title',
    sheet: resumed ? 'pause' : null,
    resumed,
  });
  applyMotion();
  refreshView();
  refreshProgress();
  if (r.loadFailed) showToast('セーブを読み込めなかったので、新しく始めます');
}

/** ルール本体の写しを作り直す（1秒に10回ほどと、指で操作したとき） */
export function refreshView(): void {
  const r = game();
  const round = buildRoundView(r.state, r.bal);
  const prev = useGame.getState().round;
  if (!sameRound(prev, round)) useGame.setState({ round });
}

function sameRound(a: RoundView | null, b: RoundView | null): boolean {
  if (a === null || b === null) return a === b;
  for (const k of Object.keys(a) as (keyof RoundView)[]) {
    if (k === 'comboFrac' || k === 'timeFrac' || k === 'gaugeFrac' || k === 'feverFrac') {
      if (Math.abs((a[k] as number) - (b[k] as number)) > 0.004) return false;
    } else if (a[k] !== b[k]) return false;
  }
  return true;
}

export function refreshProgress(): void {
  const r = game();
  useGame.setState({ progress: structuredClone(r.state.progress) });
}

function praiseFor(length: number): string | null {
  if (length >= 13) return 'ファンタスティック！';
  if (length >= 10) return 'エクセレント！';
  if (length >= 8) return 'グレート！';
  if (length >= 6) return 'ナイス！';
  return null;
}

function pushPopup(p: Omit<Popup, 'id'>): void {
  useGame.setState((st) => ({ popups: [...st.popups, { ...p, id: effectId++ }].slice(-MAX_POPUPS) }));
}

function pushBanner(b: Omit<Banner, 'id'>): void {
  useGame.setState((st) => ({ banners: [...st.banners.filter((x) => x.kind !== b.kind), { ...b, id: effectId++ }].slice(-MAX_BANNERS) }));
}

const yen = new Intl.NumberFormat('ja-JP');

/** ルール本体の出来事から、浮かぶ点数と知らせを作る */
function onEvents(ev: GameEvent[]): void {
  const { layout } = useGame.getState();
  let viewChanged = false;
  for (const e of ev) {
    switch (e.type) {
      case 'link':
      case 'unlink':
      case 'cancel':
        viewChanged = true;
        break;
      case 'pop': {
        viewChanged = true;
        const last = e.cells[e.cells.length - 1]!;
        const at = cellCenter(layout.board, last.cell);
        pushPopup({ x: at.x, y: at.y, text: `+${yen.format(e.score)}`, kind: e.length >= 8 ? 'big' : 'chain' });
        if (e.made === 'prism') pushBanner({ kind: 'special', text: 'プリズム誕生！', sub: 'タップで同じ色をぜんぶ消す' });
        else if (e.made === 'bomb') pushBanner({ kind: 'special', text: 'アクアボム誕生！', sub: 'タップでまわりをまとめて消す' });
        else {
          const praise = praiseFor(e.length);
          if (praise) pushBanner({ kind: 'praise', text: praise });
        }
        break;
      }
      case 'burstScore': {
        viewChanged = true;
        const at = cellCenter(layout.board, e.cell);
        pushPopup({ x: at.x, y: at.y, text: `+${yen.format(e.score)}`, kind: 'big' });
        break;
      }
      case 'feverStart':
        pushBanner({ kind: 'fever', text: 'エアロタイム！', sub: `${e.seconds}秒 時間が止まって点が2倍` });
        viewChanged = true;
        break;
      case 'start':
        pushBanner({ kind: 'start', text: 'スタート！' });
        viewChanged = true;
        break;
      case 'timeUp':
        pushBanner({ kind: 'timeUp', text: 'タイムアップ！' });
        viewChanged = true;
        break;
      case 'shuffle':
        pushBanner({ kind: 'shuffle', text: 'ならべかえ' });
        break;
      case 'roundEnd':
        useGame.setState({ result: e.result, screen: 'result', sheet: null, banners: [], popups: [] });
        refreshProgress();
        viewChanged = true;
        // 保存は少しあとに終わるので、そのあとで確かめる（黙らずに知らせる）
        window.setTimeout(() => {
          if (runtime?.saveFailed) showToast('記録を保存できませんでした。空き容量やブラウザの設定を確かめてください');
        }, 400);
        break;
      default:
        break;
    }
  }
  if (viewChanged) refreshView();
}

export function removePopup(id: number): void {
  useGame.setState((st) => ({ popups: st.popups.filter((p) => p.id !== id) }));
}

export function removeBanner(id: number): void {
  useGame.setState((st) => ({ banners: st.banners.filter((b) => b.id !== id) }));
}

export function showToast(text: string): void {
  useGame.setState({ toast: { id: effectId++, text } });
}

export function clearToast(id: number): void {
  if (useGame.getState().toast?.id === id) useGame.setState({ toast: null });
}

// ------------------------------------------------------------ 画面の操作

/** タイトルの「あそぶ」：はじめての人には、あそびかたを先に見せる */
export function play(): void {
  const r = game();
  if (!r.state.progress.tutorialSeen) {
    useGame.setState({ sheet: 'howto', startAfterHowto: true });
    return;
  }
  startRound();
}

export function startRound(): void {
  const r = game();
  r.startRound();
  useGame.setState({ screen: 'game', sheet: null, result: null, popups: [], banners: [], resumed: false, startAfterHowto: false });
  refreshView();
}

export function openSheet(kind: SheetKind): void {
  if (kind === 'pause') game().pause();
  useGame.setState({ sheet: kind });
  refreshView();
}

export function closeSheet(): void {
  const st = useGame.getState();
  if (st.sheet === 'howto') {
    game().markTutorialSeen();
    refreshProgress();
    if (st.startAfterHowto) {
      startRound();
      return;
    }
  }
  if (st.sheet === 'pause' || (st.screen === 'game' && game().paused)) game().resume();
  useGame.setState({ sheet: null, resumed: false });
  refreshView();
}

export function pauseGame(): void {
  if (useGame.getState().screen !== 'game' || game().state.round === null) return;
  openSheet('pause');
}

export function quitToTitle(): void {
  const r = game();
  if (r.state.round !== null) r.quitRound();
  useGame.setState({ screen: 'title', sheet: null, popups: [], banners: [], resumed: false });
  refreshView();
  refreshProgress();
}

export function setSettings(patch: Partial<Settings>): void {
  game().setSettings(patch);
  useGame.setState({ settings: { ...game().settings } });
  applyMotion();
}

export function setSystemReduced(on: boolean): void {
  systemReduced = on;
  applyMotion();
}

function applyMotion(): void {
  const m = runtime?.settings.motion ?? 'auto';
  const reduced = m === 'reduce' || (m === 'auto' && systemReduced);
  if (useGame.getState().reduced !== reduced) useGame.setState({ reduced });
  document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
}

export function setLayout(layout: Layout): void {
  useGame.setState({ layout });
}

export function importSave(text: string): boolean {
  try {
    game().importSave(text);
  } catch {
    showToast('読み込めませんでした。書き出したテキストをそのまま貼ってください');
    return false;
  }
  useGame.setState({ settings: { ...game().settings }, screen: 'title', sheet: null, result: null });
  applyMotion();
  refreshProgress();
  refreshView();
  showToast('記録を読み込みました');
  return true;
}

export function resetAll(): void {
  game().resetAll();
  useGame.setState({ screen: 'title', sheet: null, result: null, popups: [], banners: [] });
  refreshProgress();
  refreshView();
  showToast('記録を消しました');
}
