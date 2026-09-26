import { cellAt, createState, startRound, step, ticksOf, type Bubble, type GameState } from '../src/core';
import { gameData, type GameData } from '../src/data';

export const bal: GameData = gameData;

/** 数え始めを飛ばして、あそべる状態にする */
export function playing(seed = 1, data: GameData = bal): GameState {
  const s = createState();
  startRound(s, data, seed);
  const n = ticksOf(data, data.round.countdownSeconds);
  for (let i = 0; i < n; i++) step(s, data);
  if (s.round?.phase !== 'playing') throw new Error('あそべる状態にならなかった');
  return s;
}

/**
 * 盤面を文字で決める。columns は列ごとの文字列（上から下）。
 * '0'〜'5' は色、'b' はアクアボム（色0）、'A'〜'F' はプリズム（色0〜5）。
 */
export function setBoard(s: GameState, columns: string[]): void {
  const r = s.round!;
  const cols = columns.length;
  const rows = columns[0]!.length;
  if (cols !== r.board.cols || rows !== r.board.rows) throw new Error(`盤面の大きさが違う：${cols}x${rows}`);
  const cells: Bubble[] = [];
  let id = 10_000;
  columns.forEach((col, c) => {
    [...col].forEach((ch, row) => {
      let b: Bubble;
      if (ch === 'b') b = { id: id++, kind: 'bomb', color: 0 };
      else if (ch >= 'A' && ch <= 'F') b = { id: id++, kind: 'prism', color: ch.charCodeAt(0) - 65 };
      else b = { id: id++, kind: 'color', color: Number(ch) };
      cells[cellAt(c, row, rows)] = b;
    });
  });
  r.board.cells = cells;
  r.nextId = id;
}

/** 盤面を文字にする（setBoard と同じ書き方） */
export function boardText(s: GameState): string[] {
  const r = s.round!;
  const out: string[] = [];
  for (let c = 0; c < r.board.cols; c++) {
    let col = '';
    for (let row = 0; row < r.board.rows; row++) {
      const b = r.board.cells[cellAt(c, row, r.board.rows)]!;
      col += b.kind === 'bomb' ? 'b' : b.kind === 'prism' ? String.fromCharCode(65 + b.color) : String(b.color);
    }
    out.push(col);
  }
  return out;
}

export function cell(c: number, row: number): number {
  return cellAt(c, row, bal.board.rows);
}

/** seconds 秒ぶん step を回し、出来事をまとめて返す */
export function run(s: GameState, seconds: number, data: GameData = bal) {
  const ev = [];
  const n = ticksOf(data, seconds);
  for (let i = 0; i < n; i++) ev.push(...step(s, data));
  return ev;
}

/** 手がつながらないように色を交互に並べた盤面（7列×8行、色0〜4）。つなげる場所だけ書き換えて使う */
export const QUIET: string[] = ['01234012', '23401234', '40123401', '12340123', '34012340', '01234012', '23401234'];
