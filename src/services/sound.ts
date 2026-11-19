/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlarmEventConfig, AlarmEventKey, AlarmToneOption } from '../types';

// Web Audio API Synthesizer for COMPE SPAM Alerts & Notifications

class SoundEffectsService {
  private audioCtx: AudioContext | null = null;
  private alarmConfigResolver: ((eventKey: AlarmEventKey) => AlarmEventConfig | undefined) | null = null;

  registerAlarmConfigResolver(fn: (eventKey: AlarmEventKey) => AlarmEventConfig | undefined) {
    this.alarmConfigResolver = fn;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  playTone(tone: AlarmToneOption, volume = 0.25, repeatCount = 1) {
    const safeVol = Math.max(0.02, Math.min(1, volume || 0.25));
    const repeats = Math.max(1, Math.min(3, Math.round(repeatCount || 1)));

    for (let r = 0; r < repeats; r++) {
      const delayMs = r * 700;
      const run = () => {
        if (tone === 'urgent_alarm') this.playUrgentAlarm(safeVol);
        else if (tone === 'cash_success') this.playCashSuccess(safeVol);
        else if (tone === 'delivery_chime') this.playDeliveryChime(safeVol);
        else if (tone === 'warning_beep') this.playWarningBeep(safeVol);
        else if (tone === 'chat_tone') this.playChatMessageTone(safeVol);
        else if (tone === 'siren_pulse') this.playSirenPulse(safeVol);
      };
      if (delayMs === 0) run();
      else setTimeout(run, delayMs);
    }
  }

  playConfiguredEvent(eventKey: AlarmEventKey) {
    const cfg = this.alarmConfigResolver?.(eventKey);
    if (cfg) {
      if (!cfg.enabled) return;
      this.playTone(cfg.tone, cfg.volume, cfg.repeatCount);
      return;
    }
    if (eventKey === 'nova_oportunidade') this.playUrgentAlarm();
    else if (eventKey === 'venda_confirmada') this.playCashSuccess();
    else if (eventKey === 'orcamento_recebido' || eventKey === 'pedido_a_caminho') this.playDeliveryChime();
    else if (eventKey === 'mensagem_chat') this.playChatMessageTone();
    else this.playWarningBeep();
  }

  // Dual-tone urgent alert for SPAM "NOVA OPORTUNIDADE" & Admin Alerts
  playUrgentAlarm(volume = 0.22) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);
      osc.frequency.setValueAtTime(660, now + 0.45);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Ignore mobile audio restriction
    }
  }

  // Cash / Victory arpeggio for "PARABÉNS! VOCÊ VENDEU!"
  playCashSuccess(volume = 0.25) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
      });
    } catch {
      // Ignore mobile audio restriction
    }
  }

  // Bright chime for "ORÇAMENTO RECEBIDO" or "PEDIDO A CAMINHO"
  playDeliveryChime(volume = 0.22) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [587.33, 880, 1174.66]; // D5, A5, D6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch {
      // Ignore mobile audio restriction
    }
  }

  // Short warning beep
  playWarningBeep(volume = 0.2) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.12);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignore mobile audio restriction
    }
  }

  // Pulsing siren for high-priority alerts
  playSirenPulse(volume = 0.22) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.linearRampToValueAtTime(1120, now + 0.25);
      osc.frequency.linearRampToValueAtTime(720, now + 0.5);

      gain.gain.setValueAtTime(volume * 0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.58);
    } catch {
      // Ignore mobile audio restriction
    }
  }

  // Toque sonoro característico de mensagem de chat recebida
  playChatMessageTone(volume = 0.28) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [
        { freq: 784, time: now, duration: 0.14 },
        { freq: 1046.5, time: now + 0.12, duration: 0.22 },
      ].forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration + 0.02);
      });
    } catch {
      // Ignore mobile audio restriction
    }
  }
}

export const soundEffects = new SoundEffectsService();
