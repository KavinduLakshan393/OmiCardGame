/**
 * Browser audio facade for Omi presentation sounds.
 *
 * The rules engine never imports this module. Sounds are synthesized through
 * Web Audio so the game has no external audio-file dependency.
 */
export class AudioManager {
    constructor({ enabled = true, contextFactory = null } = {}) {
        this.enabled = Boolean(enabled);
        this.contextFactory = contextFactory;
        this.context = null;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        return this.enabled;
    }

    async init() {
        if (this.context) {
            if (this.context.state === 'suspended' && typeof this.context.resume === 'function') {
                await this.context.resume().catch(() => {});
            }
            return this.context;
        }

        try {
            const factory = this.contextFactory ?? (() => {
                const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
                return Context ? new Context() : null;
            });
            this.context = factory();
            if (this.context?.state === 'suspended' && typeof this.context.resume === 'function') {
                await this.context.resume().catch(() => {});
            }
        } catch {
            this.context = null;
        }
        return this.context;
    }

    #tone(freq, type, gain, start, duration) {
        if (!this.context || !this.enabled) return;
        const osc = this.context.createOscillator();
        const amp = this.context.createGain();
        osc.connect(amp);
        amp.connect(this.context.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.context.currentTime + start);
        amp.gain.setValueAtTime(0.0001, this.context.currentTime + start);
        amp.gain.linearRampToValueAtTime(gain, this.context.currentTime + start + 0.02);
        amp.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + start + duration);
        osc.start(this.context.currentTime + start);
        osc.stop(this.context.currentTime + start + duration + 0.05);
    }

    play(type) {
        if (!this.enabled || !this.context) return;
        switch (type) {
            case 'card':
                this.#tone(380, 'triangle', 0.18, 0, 0.12);
                break;
            case 'trick':
                [523, 659, 784].forEach((f, i) => this.#tone(f, 'sine', 0.28, i * 0.12, 0.25));
                break;
            case 'win':
                [523, 659, 784, 1047].forEach((f, i) => this.#tone(f, 'sine', 0.32, i * 0.14, 0.35));
                break;
            case 'lose':
                [392, 330, 262].forEach((f, i) => this.#tone(f, 'triangle', 0.22, i * 0.17, 0.35));
                break;
            case 'kapothi':
                [523, 659, 784, 1047, 1319].forEach((f, i) => this.#tone(f, 'sine', 0.38, i * 0.13, 0.45));
                break;
            case 'invalid':
                this.#tone(110, 'square', 0.25, 0, 0.15);
                break;
            case 'trump':
                this.#tone(220, 'sine', 0.28, 0, 0.10);
                this.#tone(440, 'sine', 0.28, 0.12, 0.10);
                this.#tone(880, 'sine', 0.28, 0.26, 0.25);
                break;
            default:
                break;
        }
    }
}
