import type { GameState } from '../core/types';
import { MIGRATIONS } from './migrations';
import { SaveDataSchema, type Settings } from './schema';

/** セーブの版番号。形を変えたら上げて、MIGRATIONS に古い版からの変換を足す */
export const SAVE_VERSION = 1;

/** 読み込むテキストの長さの上限（これより長いものは読まない） */
export const MAX_SAVE_TEXT = 200_000;

export interface SaveData {
  saveVersion: number;
  /** 最後に保存した時刻（ミリ秒、Date.now） */
  savedAt: number;
  settings: Settings;
  state: GameState;
}

export class SaveFormatError extends Error {}

/** 古い版のセーブを今の版へ変換し、形を確かめる */
export function migrate(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SaveFormatError('セーブの形ではない');
  let data = raw as Record<string, unknown>;
  let version = typeof data.saveVersion === 'number' && Number.isInteger(data.saveVersion) ? data.saveVersion : 0;
  if (version > SAVE_VERSION) throw new SaveFormatError(`新しすぎる版のセーブ（${version}）`);
  while (version < SAVE_VERSION) {
    const up = MIGRATIONS[version];
    if (!up) throw new SaveFormatError(`版 ${version} のセーブは変換できない`);
    try {
      data = up(structuredClone(data));
    } catch {
      throw new SaveFormatError(`版 ${version} のセーブを変換できなかった`);
    }
    version += 1;
    data.saveVersion = version;
  }
  const parsed = SaveDataSchema.safeParse(data);
  if (!parsed.success) throw new SaveFormatError('セーブが壊れている');
  return parsed.data as SaveData;
}

export function serialize(data: SaveData): string {
  return JSON.stringify(data);
}

export function deserialize(text: string): SaveData {
  if (text.length > MAX_SAVE_TEXT) throw new SaveFormatError('セーブが大きすぎる');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveFormatError('セーブを読めない');
  }
  return migrate(raw);
}

/** 書き出し用の文字列の頭につける印 */
const EXPORT_PREFIX = 'AERO1.';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** セーブをテキストとして書き出す（あそびの途中の盤面は入れない） */
export function exportText(data: SaveData): string {
  const slim: SaveData = { ...data, state: { ...data.state, round: null, lastResult: null } };
  return EXPORT_PREFIX + toBase64(serialize(slim));
}

/** 書き出したテキスト（または JSON そのまま）を読み込む */
export function importText(text: string): SaveData {
  if (text.length > MAX_SAVE_TEXT) throw new SaveFormatError('テキストが長すぎる');
  const trimmed = text.trim().replace(/\s+/g, '');
  if (trimmed.startsWith(EXPORT_PREFIX)) {
    let json: string;
    try {
      json = fromBase64(trimmed.slice(EXPORT_PREFIX.length));
    } catch {
      throw new SaveFormatError('書き出したテキストではない');
    }
    return deserialize(json);
  }
  return deserialize(text.trim());
}
