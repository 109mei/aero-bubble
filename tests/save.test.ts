import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, createState, playRound, startRound, step } from '../src/core';
import {
  DEFAULT_SETTINGS,
  deserialize,
  exportText,
  importText,
  LocalStorageSaveStore,
  MAX_SAVE_TEXT,
  migrate,
  SAVE_VERSION,
  SaveFormatError,
  serialize,
  type KeyValueStorage,
  type SaveData,
} from '../src/save';
import { bal } from './helpers';

function sample(): SaveData {
  const s = playRound(bal, 5, BOT_PROFILES.casual, 6).state;
  startRound(s, bal, 11);
  for (let i = 0; i < 200; i++) step(s, bal);
  return { saveVersion: SAVE_VERSION, savedAt: 1_700_000_000_000, settings: { ...DEFAULT_SETTINGS, music: false }, state: s };
}

class MapStorage implements KeyValueStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe('セーブ', () => {
  it('保存して読み込んでも中身が変わらない（あそびの途中の盤面も）', () => {
    const data = sample();
    expect(data.state.round).not.toBeNull();
    expect(deserialize(serialize(data))).toEqual(data);
  });

  it('localStorage の窓口で保存・読み込み・消去ができる', async () => {
    const storage = new MapStorage();
    const store = new LocalStorageSaveStore(storage);
    expect(await store.load()).toBeNull();
    const data = sample();
    await store.save(data);
    expect(await store.load()).toEqual(data);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('書き出したテキストを読み込むと、記録と設定が戻る（途中の盤面は入れない）', () => {
    const data = sample();
    const text = exportText(data);
    expect(text.startsWith('AERO1.')).toBe(true);
    const back = importText(`  ${text.slice(0, 20)}\n${text.slice(20)}  `);
    expect(back.state.progress).toEqual(data.state.progress);
    expect(back.settings).toEqual(data.settings);
    expect(back.state.round).toBeNull();
    // JSON そのままでも読める
    expect(importText(serialize(data)).state).toEqual(data.state);
  });

  it('版番号のない古いセーブは、記録だけを引き継いで読める', () => {
    const old = { progress: { best: 777, rounds: 3, totalPopped: 90, unlocked: ['goldfish'] }, settings: { sound: false } };
    const data = migrate(old);
    expect(data.saveVersion).toBe(SAVE_VERSION);
    expect(data.state.progress).toMatchObject({ best: 777, rounds: 3, totalPopped: 90, unlocked: ['goldfish'], tutorialSeen: false });
    expect(data.settings).toEqual({ ...DEFAULT_SETTINGS, sound: false });
    expect(data.state.round).toBeNull();
  });

  it('新しすぎる版・壊れたセーブ・大きすぎるテキストは読まない', () => {
    const data = sample();
    expect(() => migrate({ ...data, saveVersion: SAVE_VERSION + 1 })).toThrow(SaveFormatError);
    expect(() => deserialize('{')).toThrow(SaveFormatError);
    expect(() => deserialize('[]')).toThrow(SaveFormatError);
    expect(() => importText('AERO1.@@@')).toThrow(SaveFormatError);
    expect(() => deserialize('x'.repeat(MAX_SAVE_TEXT + 1))).toThrow(SaveFormatError);
    const broken = structuredClone(data);
    broken.state.progress.best = -5;
    expect(() => migrate(broken)).toThrow(SaveFormatError);
    const outside = structuredClone(data);
    outside.state.round!.chain = [999];
    expect(() => migrate(outside)).toThrow(SaveFormatError);
    const shortBoard = structuredClone(data);
    shortBoard.state.round!.board.cells.pop();
    expect(() => migrate(shortBoard)).toThrow(SaveFormatError);
  });

  it('知らない鍵（__proto__ など）は取り除く', () => {
    const data = sample();
    const text = serialize(data).replace('"progress":{', '"progress":{"__proto__":{"polluted":true},"extra":1,');
    const back = deserialize(text);
    expect(Object.keys(back.state.progress)).not.toContain('extra');
    expect(Object.prototype.hasOwnProperty.call(back.state.progress, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('新しい状態も保存の形に合う', () => {
    const data: SaveData = { saveVersion: SAVE_VERSION, savedAt: 0, settings: DEFAULT_SETTINGS, state: createState() };
    expect(migrate(JSON.parse(serialize(data)))).toEqual(data);
  });
});
