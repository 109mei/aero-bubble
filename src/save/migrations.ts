type Json = Record<string, any>;

/**
 * 版 n のセーブを 版 n+1 に変換する関数。
 * 今は版 1 だけ。セーブの形を変えたら SAVE_VERSION を上げ、ここに古い版からの変換を足す
 * （例：2: (d) => { d.state.progress.newField = 0; return d; }）。
 */
export const MIGRATIONS: Record<number, (old: Json) => Json> = {
  // 版 0（版番号のない、試作の前のセーブ）：記録だけを引き継ぐ
  0: (d) => {
    const progress = (d.state?.progress ?? d.progress ?? {}) as Json;
    return {
      saveVersion: 0,
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
      settings: { sound: true, music: true, vibration: true, motion: 'auto', ...(d.settings ?? {}) },
      state: {
        schema: 1,
        progress: {
          best: 0,
          rounds: 0,
          totalPopped: 0,
          totalFevers: 0,
          maxChain: 0,
          bestFevers: 0,
          unlocked: [],
          tutorialSeen: false,
          recent: [],
          ...progress,
        },
        round: null,
        lastResult: null,
      },
    };
  },
};
