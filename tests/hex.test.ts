import { describe, expect, it } from 'vitest';
import { hasMove, hexDistance, neighborTable } from '../src/core';
import { shuffleBoard } from '../src/core/board';
import { bal, playing, QUIET, setBoard } from './helpers';

const { cols, rows } = bal.board;

describe('六角形の並び', () => {
  it('隣は6つまでで、向こうから見ても隣', () => {
    const nb = neighborTable(cols, rows);
    for (let i = 0; i < cols * rows; i++) {
      expect(nb[i]!.length).toBeLessThanOrEqual(6);
      expect(nb[i]!.length).toBeGreaterThanOrEqual(2);
      for (const n of nb[i]!) expect(nb[n]).toContain(i);
    }
    // まんなかの泡は6つ隣がある
    expect(nb[3 * rows + 3]).toHaveLength(6);
  });

  it('距離1はちょうど隣', () => {
    const nb = neighborTable(cols, rows);
    for (let a = 0; a < cols * rows; a++) {
      for (let b = 0; b < cols * rows; b++) {
        expect(hexDistance(a, b, rows) === 1).toBe(nb[a]!.includes(b));
      }
      expect(hexDistance(a, a, rows)).toBe(0);
    }
  });
});

describe('手がなくなったとき', () => {
  it('同じ色が隣り合わない盤面には手がなく、並べ直すと手ができる（色の数は変わらない）', () => {
    const s = playing();
    setBoard(s, QUIET);
    const r = s.round!;
    expect(hasMove(r.board, bal.chain.min)).toBe(false);
    const before = r.board.cells.map((b) => b.color).sort();
    shuffleBoard(r, bal.chain.min);
    expect(hasMove(r.board, bal.chain.min)).toBe(true);
    expect(r.board.cells.map((b) => b.color).sort()).toEqual(before);
  });

  it('特別な泡があれば手はある', () => {
    const s = playing();
    setBoard(s, ['b1234012', ...QUIET.slice(1)]);
    expect(hasMove(s.round!.board, bal.chain.min)).toBe(true);
  });
});
