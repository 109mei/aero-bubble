const nf = new Intl.NumberFormat('ja-JP');

/** 12,345 のように3桁ごとに区切る */
export function num(n: number): string {
  return nf.format(Math.round(n));
}
