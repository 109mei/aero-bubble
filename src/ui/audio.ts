import type { GameEvent } from '../core';

/**
 * 効果音と音楽（WebAudio でその場で作る。音のファイルは使わない）。
 * つなぐたびに上がっていく澄んだ音、泡のはじける音、ゆったりした音楽。
 * ブラウザの決まりで、最初に指で触れたとき（unlock）から鳴らせる。
 */

type MusicMode = 'off' | 'title' | 'game' | 'fever';

const PENTA = [0, 2, 4, 7, 9];
const C5 = 523.25;

function hz(semitones: number, base = C5): number {
  return base * Math.pow(2, semitones / 12);
}

/** 4小節でひとまわりする和音（F△7 → Em7 → Dm9 → C△9）。数字は C4 からの半音 */
const CHORDS: number[][] = [
  [5, 9, 12, 16],
  [4, 7, 11, 14],
  [2, 5, 9, 12, 16],
  [0, 4, 7, 11, 14],
];
const BASS = [5, 4, 2, 0];
/** 16分音符ごとの鈴の並び（和音の何番目の音か。-1 は休み） */
const ARP = [0, -1, 2, -1, 1, -1, 3, 2, -1, 1, -1, 2, 0, -1, 3, -1];
const BPM = 92;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private seBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private seOn = true;
  private musicOn = true;
  private mode: MusicMode = 'off';
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private lastPop = 0;

  /** 指で触れたときに呼ぶ（そのときだけ音を出す準備ができる） */
  unlock(): void {
    if (this.ctx === null) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.seBus = ctx.createGain();
      this.seBus.gain.value = this.seOn ? 0.75 : 0;
      this.seBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.42 : 0;
      this.musicBus.connect(this.master);
      const len = Math.floor(ctx.sampleRate * 0.5);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    this.applyMusic();
  }

  setEnabled(se: boolean, music: boolean): void {
    this.seOn = se;
    this.musicOn = music;
    const now = this.ctx?.currentTime ?? 0;
    this.seBus?.gain.setTargetAtTime(se ? 0.75 : 0, now, 0.05);
    this.musicBus?.gain.setTargetAtTime(music ? 0.42 : 0, now, 0.2);
    this.applyMusic();
  }

  setMusic(mode: MusicMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyMusic();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  private applyMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const want = this.musicOn && this.mode !== 'off';
    if (want && this.timer === null) {
      this.nextTime = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 50);
    } else if (!want && this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ------------------------------------------------------------ 音の部品

  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType, bus: GainNode | null, attack = 0.005): void {
    const ctx = this.ctx;
    if (!ctx || !bus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** ガラスの鈴のような音（基音＋少しの倍音） */
  private bell(freq: number, at: number, dur: number, gain: number, bus: GainNode | null): void {
    this.tone(freq, at, dur, gain, 'sine', bus);
    this.tone(freq * 2, at, dur * 0.5, gain * 0.25, 'sine', bus);
    this.tone(freq * 3.01, at, dur * 0.3, gain * 0.08, 'sine', bus);
  }

  /** ぽこっ（高い音から下がる） */
  private bloop(from: number, to: number, at: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.seBus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(to, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.seBus);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  /** ざぶん（しぶきの音） */
  private splash(at: number, dur: number, gain: number, freq: number, bus: GainNode | null = this.seBus): void {
    const ctx = this.ctx;
    if (!ctx || !bus || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, at);
    f.frequency.exponentialRampToValueAtTime(freq * 0.4, at + dur);
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  // ------------------------------------------------------------ 効果音

  private get t(): number {
    return this.ctx?.currentTime ?? 0;
  }

  tap(): void {
    if (!this.ctx) return;
    this.bloop(1200, 700, this.t, 0.06, 0.12);
  }

  link(length: number): void {
    if (!this.ctx) return;
    const i = Math.max(0, length - 1);
    const semi = PENTA[i % 5]! + 12 * Math.floor(i / 5);
    this.bell(hz(Math.min(semi, 36)), this.t, 0.28, 0.2, this.seBus);
  }

  unlink(): void {
    if (!this.ctx) return;
    this.tone(hz(-5), this.t, 0.08, 0.08, 'triangle', this.seBus);
  }

  cancel(): void {
    if (!this.ctx) return;
    this.bloop(300, 160, this.t, 0.14, 0.18);
  }

  pop(n: number, made: boolean): void {
    if (!this.ctx) return;
    // 同じ瞬間にたくさん鳴らしすぎない
    const t0 = Math.max(this.t, this.lastPop);
    const count = Math.min(n, 10);
    for (let k = 0; k < count; k++) {
      const f = 700 + k * 90 + Math.random() * 60;
      this.bloop(f, f * 0.35, t0 + k * 0.032, 0.09, 0.22);
    }
    this.lastPop = t0 + count * 0.032;
    if (n >= 5 || made) {
      const end = t0 + count * 0.032;
      [0, 4, 7, 12].forEach((s, k) => this.bell(hz(s + (made ? 12 : 7)), end + k * 0.05, 0.5, 0.12, this.seBus));
    }
  }

  burst(kind: 'bomb' | 'prism'): void {
    if (!this.ctx) return;
    const t = this.t;
    this.splash(t, 0.45, 0.5, 1400);
    this.tone(140, t, 0.3, 0.35, 'sine', this.seBus);
    if (kind === 'prism') {
      for (let k = 0; k < 10; k++) this.bell(hz(PENTA[k % 5]! + 12 * Math.floor(k / 5) + 7), t + 0.05 + k * 0.045, 0.4, 0.1, this.seBus);
    } else {
      [12, 16, 19, 24].forEach((s, k) => this.bell(hz(s), t + 0.04 + k * 0.03, 0.35, 0.08, this.seBus));
    }
  }

  fever(): void {
    if (!this.ctx) return;
    const t = this.t;
    this.splash(t, 0.8, 0.25, 2500);
    [0, 4, 7, 11, 14, 19, 24].forEach((s, k) => this.bell(hz(s), t + k * 0.06, 0.9, 0.12, this.seBus));
  }

  feverEnd(): void {
    if (!this.ctx) return;
    this.bell(hz(7), this.t, 0.4, 0.1, this.seBus);
    this.bell(hz(0), this.t + 0.12, 0.6, 0.1, this.seBus);
  }

  countdown(n: number): void {
    if (!this.ctx) return;
    this.tone(n > 0 ? 660 : 990, this.t, 0.18, 0.18, 'sine', this.seBus);
  }

  start(): void {
    if (!this.ctx) return;
    [0, 4, 7, 12].forEach((s, k) => this.bell(hz(s + 7), this.t + k * 0.04, 0.5, 0.12, this.seBus));
  }

  warn(): void {
    if (!this.ctx) return;
    this.tone(1320, this.t, 0.07, 0.1, 'square', this.seBus);
  }

  timeUp(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1400, this.t);
    o.frequency.exponentialRampToValueAtTime(500, this.t + 0.5);
    g.gain.setValueAtTime(0.18, this.t);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.55);
    o.connect(g).connect(this.seBus!);
    o.start(this.t);
    o.stop(this.t + 0.6);
  }

  result(newBest: boolean): void {
    if (!this.ctx) return;
    const notes = newBest ? [0, 4, 7, 12, 16, 19, 24] : [0, 4, 7, 12];
    notes.forEach((s, k) => this.bell(hz(s), this.t + k * 0.09, 0.8, 0.12, this.seBus));
  }

  unlockCreature(): void {
    if (!this.ctx) return;
    [12, 16, 19, 24, 28].forEach((s, k) => this.bell(hz(s), this.t + 0.4 + k * 0.07, 0.6, 0.1, this.seBus));
  }

  /** ルール本体の出来事に合わせて鳴らす */
  handle(ev: GameEvent[]): void {
    for (const e of ev) {
      switch (e.type) {
        case 'link':
          this.link(e.length);
          break;
        case 'unlink':
          this.unlink();
          break;
        case 'cancel':
          this.cancel();
          break;
        case 'pop':
          this.pop(e.length, e.made !== null);
          break;
        case 'burst':
          if (!e.chained) this.burst(e.kind);
          break;
        case 'feverStart':
          this.fever();
          this.setMusic('fever');
          break;
        case 'feverEnd':
          this.feverEnd();
          this.setMusic('game');
          break;
        case 'countdown':
          this.countdown(e.n);
          break;
        case 'start':
          this.start();
          break;
        case 'warn':
          this.warn();
          break;
        case 'timeUp':
          this.timeUp();
          break;
        case 'roundEnd':
          this.result(e.result.newBest);
          if (e.result.unlocked.length > 0) this.unlockCreature();
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------ 音楽

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const sixteenth = 60 / BPM / 4;
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % (16 * CHORDS.length);
    }
  }

  private playStep(step: number, at: number, sixteenth: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[bar]!;
    const bus = this.musicBus;
    const C4 = 261.63;
    const fever = this.mode === 'fever';
    const title = this.mode === 'title';
    if (s === 0) {
      // やわらかい和音
      for (const n of chord.slice(0, 4)) {
        this.tone(hz(n, C4), at, sixteenth * 16, 0.028, 'triangle', bus, 0.4);
        this.tone(hz(n, C4) * 1.004, at, sixteenth * 16, 0.02, 'sine', bus, 0.5);
      }
    }
    if (!title && (s === 0 || s === 6 || s === 10)) {
      this.tone(hz(BASS[bar]! - 12, C4 / 2), at, sixteenth * 3, 0.12, 'sine', bus, 0.01);
    }
    const idx = ARP[s]!;
    const every = title ? s % 4 === 0 : true;
    if (idx >= 0 && every) {
      const n = chord[idx % chord.length]!;
      this.bell(hz(n + 12, C4), at, 0.45, title ? 0.035 : 0.045, bus);
    }
    if (fever && s % 2 === 1) {
      const n = chord[(s >> 1) % chord.length]!;
      this.bell(hz(n + 24, C4), at, 0.25, 0.03, bus);
    }
    if (!title && s % 2 === 0) this.splash(at, 0.05, s % 4 === 2 ? 0.05 : 0.025, 7000, bus);
  }
}

export const sound = new Sound();
