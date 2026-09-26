import { cellAt, neighborTable } from './hex';
import { randomInt } from './rng';
import type { Board, Bubble, RoundState } from './types';

/** 新しい色の泡を1つ作る（色は種つきの乱数で決める） */
export function newBubble(r: RoundState, colors: number): Bubble {
  return { id: r.nextId++, kind: 'color', color: randomInt(r, colors) };
}

/** 盤面をすべて新しい泡で埋める（上の列から順に、同じ種なら同じ並び） */
export function fillBoard(r: RoundState, cols: number, rows: number, colors: number): Board {
  const cells: Bubble[] = [];
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) cells[cellAt(c, row, rows)] = newBubble(r, colors);
  }
  return { cols, rows, cells };
}

/**
 * 消えた泡の分を詰める。泡は浮かぶので、残った泡は上へ詰まり、下から新しい泡が湧く。
 * removed に入ったマスの泡を消し、keep に入ったマスには替わりの泡（特別な泡）を置く。
 */
export function collapse(r: RoundState, removed: Set<number>, keep: Map<number, Bubble>, colors: number): void {
  const { cols, rows, cells } = r.board;
  for (let c = 0; c < cols; c++) {
    const stay: Bubble[] = [];
    let changed = false;
    for (let row = 0; row < rows; row++) {
      const i = cellAt(c, row, rows);
      const put = keep.get(i);
      if (put) {
        stay.push(put);
        changed = true;
      } else if (removed.has(i)) {
        changed = true;
      } else {
        stay.push(cells[i]!);
      }
    }
    if (!changed) continue;
    const fresh = rows - stay.length;
    for (let k = 0; k < fresh; k++) stay.push(newBubble(r, colors));
    for (let row = 0; row < rows; row++) cells[cellAt(c, row, rows)] = stay[row]!;
  }
}

/** 同じ色でつながった泡のかたまり（ふつうの泡だけ） */
export function components(board: Board): number[][] {
  const { cols, rows, cells } = board;
  const nb = neighborTable(cols, rows);
  const seen = new Uint8Array(cells.length);
  const out: number[][] = [];
  for (let i = 0; i < cells.length; i++) {
    const b = cells[i]!;
    if (seen[i] || b.kind !== 'color') continue;
    const group: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      group.push(cur);
      for (const n of nb[cur]!) {
        const nbBubble = cells[n]!;
        if (!seen[n] && nbBubble.kind === 'color' && nbBubble.color === b.color) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    out.push(group);
  }
  return out;
}

/** まだ消せる手があるか（3つ以上つながった同じ色か、特別な泡があれば手がある） */
export function hasMove(board: Board, minChain: number): boolean {
  if (board.cells.some((b) => b.kind !== 'color')) return true;
  return components(board).some((g) => g.length >= minChain);
}

/**
 * 手がなくなったら、ふつうの泡の置き場所を入れ替える（特別な泡は動かさない）。
 * 入れ替えても手ができないときは、左上の3つを同じ色にする。
 */
export function shuffleBoard(r: RoundState, minChain: number): void {
  const { cells } = r.board;
  const slots: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i]!.kind === 'color') slots.push(i);
  for (let attempt = 0; attempt < 30; attempt++) {
    const bubbles = slots.map((i) => cells[i]!);
    for (let k = bubbles.length - 1; k > 0; k--) {
      const j = randomInt(r, k + 1);
      [bubbles[k], bubbles[j]] = [bubbles[j]!, bubbles[k]!];
    }
    slots.forEach((slot, k) => {
      cells[slot] = bubbles[k]!;
    });
    if (hasMove(r.board, minChain)) return;
  }
  const color = cells[slots[0] ?? 0]?.color ?? 0;
  for (let row = 0; row < Math.min(minChain, r.board.rows); row++) {
    const i = cellAt(0, row, r.board.rows);
    const b = cells[i]!;
    if (b.kind === 'color') cells[i] = { ...b, color };
  }
}
