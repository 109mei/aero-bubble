import { useEffect, useRef } from 'react';
import { game, pauseGame, useGame } from '../store/game';
import { hitCell, toBase } from '../world/layout';
import { pointer } from '../world/pointer';
import { sound } from './audio';
import { Hud } from './Hud';
import { Banners, Countdown, Popups, Toast } from './Overlays';
import { Result } from './Result';
import { SheetHost } from './sheets';
import { Title } from './Title';

/** 指が動いた道のりを、泡の半径のこの割合ごとに調べる（速くなぞっても泡を飛ばさない） */
const SAMPLE_STEP = 0.3;
/** 触れ始めは広め、なぞる途中は狭めに当たりを取る（斜めに通るとき隣の泡を拾いすぎない） */
const HIT_PRESS = 1.05;
const HIT_MOVE = 0.8;

function canTouchBoard(): boolean {
  const st = useGame.getState();
  return st.screen === 'game' && st.sheet === null && st.round !== null && st.round.phase === 'playing';
}

/**
 * 画面全体。指の操作は画面全体を包むこの要素で受け取り、canvas には取らせない。
 * 画面の部品は基準の画面（幅390）に置き、端末の大きさに合わせて拡大縮小する。
 */
export function App({ onWorldHost }: { onWorldHost: (el: HTMLDivElement) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const layout = useGame((st) => st.layout);
  const screen = useGame((st) => st.screen);
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (host.current) onWorldHost(host.current);
  }, [onWorldHost]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useGame.getState().sheet === null) pauseGame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const endTouch = (cancel: boolean) => {
    touch.current = null;
    pointer.active = false;
    if (cancel) game().cancelTouch();
    else game().release();
  };

  return (
    <div
      className="frame"
      data-testid="frame"
      data-screen={screen}
      onPointerDown={(e) => {
        sound.unlock();
        if (touch.current !== null || !canTouchBoard()) return;
        if ((e.target as Element).closest('button, [data-noboard]')) return;
        const L = useGame.getState().layout;
        const p = toBase(L, e.clientX, e.clientY);
        const cell = hitCell(L.board, p.x, p.y, HIT_PRESS);
        if (cell < 0) return;
        touch.current = { id: e.pointerId, x: p.x, y: p.y };
        pointer.active = true;
        pointer.x = p.x;
        pointer.y = p.y;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // 取れなくてもなぞれる
        }
        game().press(cell);
      }}
      onPointerMove={(e) => {
        const t = touch.current;
        if (t === null || t.id !== e.pointerId) return;
        if (!canTouchBoard()) {
          endTouch(true);
          return;
        }
        const L = useGame.getState().layout;
        const p = toBase(L, e.clientX, e.clientY);
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        const steps = Math.max(1, Math.ceil(d / (L.board.r * SAMPLE_STEP)));
        for (let i = 1; i <= steps; i++) {
          const x = t.x + ((p.x - t.x) * i) / steps;
          const y = t.y + ((p.y - t.y) * i) / steps;
          const cell = hitCell(L.board, x, y, HIT_MOVE);
          if (cell >= 0) game().enter(cell);
        }
        t.x = p.x;
        t.y = p.y;
        pointer.x = p.x;
        pointer.y = p.y;
      }}
      onPointerUp={(e) => {
        if (touch.current?.id === e.pointerId) endTouch(false);
      }}
      onPointerCancel={(e) => {
        if (touch.current?.id === e.pointerId) endTouch(true);
      }}
      onLostPointerCapture={(e) => {
        if (touch.current?.id === e.pointerId) endTouch(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="world-host" ref={host} />
      <div className="rotate-hint" aria-hidden="true">
        スマホを縦にすると遊びやすくなります
      </div>
      <div
        className="app"
        style={{
          left: layout.offsetX,
          top: layout.offsetY,
          width: layout.frameW,
          height: layout.frameH,
          transform: `scale(${layout.scale})`,
        }}
      >
        {screen === 'title' && <Title />}
        {screen === 'game' && <Hud />}
        {screen === 'result' && <Result />}
        <Popups />
        <Banners />
        <Countdown />
        <SheetHost />
        <Toast />
      </div>
    </div>
  );
}
