/**
 * 六角形の並び（列は縦にまっすぐ、奇数の列は半マス下にずれる）の隣と距離。
 * マスの番号は index = col * rows + row。
 */

/** 偶数の列から見た隣（列の差, 行の差） */
const EVEN_NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
];
/** 奇数の列から見た隣（半マス下にずれているぶん、横の列の同じ行と1つ下が隣になる） */
const ODD_NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export function colOf(cell: number, rows: number): number {
  return Math.floor(cell / rows);
}

export function rowOf(cell: number, rows: number): number {
  return cell % rows;
}

export function cellAt(col: number, row: number, rows: number): number {
  return col * rows + row;
}

const neighborCache = new Map<string, number[][]>();

/** 盤面の大きさごとに、すべてのマスの隣の一覧を作っておく */
export function neighborTable(cols: number, rows: number): number[][] {
  const key = `${cols}x${rows}`;
  const hit = neighborCache.get(key);
  if (hit) return hit;
  const table: number[][] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const list: number[] = [];
      for (const [dc, dr] of c % 2 === 0 ? EVEN_NEIGHBORS : ODD_NEIGHBORS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) list.push(cellAt(nc, nr, rows));
      }
      table[cellAt(c, r, rows)] = list;
    }
  }
  neighborCache.set(key, table);
  return table;
}

export function isNeighbor(a: number, b: number, cols: number, rows: number): boolean {
  return neighborTable(cols, rows)[a]?.includes(b) ?? false;
}

/** 六角形の並びでの距離（隣なら 1） */
export function hexDistance(a: number, b: number, rows: number): number {
  const ca = toCube(colOf(a, rows), rowOf(a, rows));
  const cb = toCube(colOf(b, rows), rowOf(b, rows));
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z));
}

function toCube(col: number, row: number): { x: number; y: number; z: number } {
  const x = col;
  const z = row - (col - (col & 1)) / 2;
  return { x, y: -x - z, z };
}
