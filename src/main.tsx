import { createRoot } from 'react-dom/client';
import { bestChain, type Progress, type SpecialKind } from './core';
import { gameData } from './data';
import { LocalStorageSaveStore, MemorySaveStore, type SaveStore } from './save';
import { game, openSheet, pauseGame, refreshProgress, refreshView, setLayout, setRuntime, setSystemReduced, showToast, useGame, type SheetKind } from './store/game';
import { GameRuntime } from './store/runtime';
import { App } from './ui/App';
import { sound } from './ui/audio';
import { hapticsFor, setVibration } from './ui/haptics';
import './ui/styles.css';
import { cellCenter, computeLayout, toClient } from './world/layout';
import type { World, WorldMode } from './world/World';

const params = new URLSearchParams(window.location.search);
/** テスト用の窓口（?debug=1）は、開発中とテスト用のビルド（--mode e2e）だけ */
const DEBUG_ALLOWED = import.meta.env.DEV || import.meta.env.MODE === 'e2e';
const debug = DEBUG_ALLOWED && params.get('debug') === '1';
const seedParam = params.get('seed');
const fixedSeed = DEBUG_ALLOWED && seedParam !== null && Number.isFinite(Number(seedParam)) ? Math.floor(Number(seedParam)) >>> 0 : null;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 0;
}

function saveStore(): SaveStore {
  try {
    const probe = 'aero-bubble/probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new LocalStorageSaveStore(window.localStorage);
  } catch {
    return new MemorySaveStore();
  }
}

/** iPhone などでは、指を離したとき・タップしたときにしか音を出す準備ができないことがあるので、何度でも試す */
function unlockAudioOnGesture(): void {
  const unlock = () => sound.unlock();
  for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) window.addEventListener(type, unlock, { passive: true });
}

/** 切り欠き・ホームバーの余白（CSS の env() を読む） */
function measureInsets(): { top: number; bottom: number } {
  const probe = document.getElementById('safe-probe');
  if (!probe) return { top: 0, bottom: 0 };
  const cs = getComputedStyle(probe);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
}

async function start(): Promise<void> {
  const bal = gameData;
  const store = saveStore();
  const runtime = new GameRuntime({
    bal,
    store,
    now: () => Date.now(),
    newSeed: () => fixedSeed ?? randomSeed(),
    speed: 1,
  });
  const resumed = await runtime.boot();

  const applyLayout = () => {
    const ins = measureInsets();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const L = computeLayout(vw, vh, ins.top, ins.bottom, bal.board.cols, bal.board.rows);
    setLayout(L);
    world?.resize(L);
  };

  let world: World | null = null;
  let creating = false;
  applyLayout();
  setRuntime(runtime, resumed);
  if (store instanceof MemorySaveStore) showToast('この環境では記録が保存されません（プライベートブラウズなど）');

  // 音と振動
  unlockAudioOnGesture();
  sound.setEnabled(runtime.settings.sound, runtime.settings.music);
  setVibration(runtime.settings.vibration);
  runtime.addListener((ev) => {
    sound.handle(ev);
    hapticsFor(ev);
  });
  const musicFor = (screen: string) => (screen === 'game' ? 'game' : 'title');
  sound.setMusic(musicFor(useGame.getState().screen));
  useGame.subscribe((st, prev) => {
    if (st.settings !== prev.settings) {
      sound.setEnabled(st.settings.sound, st.settings.music);
      setVibration(st.settings.vibration);
    }
    if (st.screen !== prev.screen) sound.setMusic(musicFor(st.screen));
  });

  // 動きを減らす（端末の設定）
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  setSystemReduced(mq.matches);
  mq.addEventListener('change', () => setSystemReduced(mq.matches));

  window.addEventListener('resize', applyLayout);
  window.visualViewport?.addEventListener('resize', applyLayout);

  // PixiJS は画面の枠ができてから読み込む
  const onWorldHost = (el: HTMLDivElement) => {
    if (world !== null || creating) return;
    creating = true;
    void import('./world/World')
      .then(async ({ World }) => {
        world = await World.create(el, useGame.getState().layout);
        document.documentElement.dataset.world = 'ready';
      })
      .catch(() => {
        document.documentElement.dataset.world = 'failed';
        showToast('この端末では絵を表示できませんでした');
      });
  };

  const root = document.getElementById('root')!;
  createRoot(root).render(<App onWorldHost={onWorldHost} />);

  // 更新の頻度を分ける：core は決まった刻み（タイマー）、React は1秒に uiHz 回、PixiJS は毎フレーム。
  // core をフレームに頼らず進めるので、フレームが間引かれても時間は遅れない
  window.setInterval(() => runtime.frame(performance.now()), bal.tickSeconds * 1000);
  window.setInterval(refreshView, 1000 / bal.display.uiHz);
  const modeOf = (screen: string): WorldMode => (screen === 'title' ? 'title' : screen === 'result' ? 'result' : 'game');
  const loop = (now: number) => {
    // 画面の大きさの変化は、知らせ（resize）が来ない場合もあるので毎フレーム見る
    const L = useGame.getState().layout;
    if (Math.abs(L.vw - window.innerWidth) > 0.5 || Math.abs(L.vh - window.innerHeight) > 0.5) applyLayout();
    runtime.frame(performance.now());
    const st = useGame.getState();
    const events = runtime.drainWorldEvents();
    world?.render(runtime.state, events, modeOf(st.screen), st.reduced, now, bal.chain.min);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const st = useGame.getState();
      if (st.screen === 'game' && st.sheet === null && runtime.state.round !== null) pauseGame();
      runtime.onHidden();
      sound.suspend();
    } else {
      runtime.onVisible();
      sound.resume();
      refreshView();
    }
  });
  window.addEventListener('pagehide', () => runtime.onHidden());

  if (debug) {
    // テストとスクリーンショット用の窓口（?debug=1 のときだけ）
    const client = (cell: number) => {
      const L = useGame.getState().layout;
      const c = cellCenter(L.board, cell);
      return toClient(L, c.x, c.y);
    };
    Object.assign(window, {
      __aero: {
        state: () => JSON.parse(JSON.stringify(runtime.state)),
        layout: () => useGame.getState().layout,
        cellPoint: client,
        findChain: (min = bal.chain.min) => {
          const r = runtime.state.round;
          if (!r) return null;
          const cells = bestChain(r.board, min);
          return { cells, points: cells.map(client) };
        },
        skipCountdown: () => {
          runtime.debugSkipCountdown();
          refreshView();
        },
        step: (seconds: number) => {
          runtime.debugStep(seconds);
          refreshView();
        },
        setGauge: (n: number) => {
          runtime.debugSetGauge(n);
          refreshView();
        },
        setTimeLeft: (seconds: number) => {
          runtime.debugSetTimeLeft(seconds);
          refreshView();
        },
        placeSpecial: (kind: SpecialKind, cell: number, color = 0) => {
          runtime.debugPlaceSpecial(kind, cell, color);
          refreshView();
        },
        setColors: (colors: number[]) => {
          runtime.debugSetColors(colors);
          refreshView();
        },
        grant: (patch: Partial<Progress>) => {
          runtime.debugGrant(patch);
          refreshProgress();
        },
        openSheet: (kind: SheetKind) => openSheet(kind),
        save: () => runtime.save(),
        pause: () => pauseGame(),
        worldReady: () => world !== null,
        worldStats: () => world?.stats() ?? null,
        runtime: () => game(),
      },
    });
  }
}

void start();
