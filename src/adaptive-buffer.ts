export const AUDIO_BUFFER_LIMITS = {
    minTarget: 0.1,
    maxStableTarget: 0.25,
    maxTarget: 0.8,
    maxBacklog: 3,
    catchUpBacklog: 1
} as const;

/** Arrival jitter is an estimate: model generation time and network time are indistinguishable. */
export class AdaptiveAudioBuffer {
    targetSeconds = 0.15;
    underruns = 0;
    private lastArrival?: number;
    private lastDuration = 0;
    private jitter = 0;

    observe(now: number, duration: number, underrun: boolean) {
        if (this.lastArrival !== undefined) {
            const gap = now - this.lastArrival;
            // Long pauses can be sentence boundaries, not network jitter.
            if (gap < 2) {
                const late = Math.max(0, gap - this.lastDuration);
                this.jitter = this.jitter * 0.8 + late * 0.2;
                if (underrun) {
                    this.underruns++;
                    this.targetSeconds = Math.min(AUDIO_BUFFER_LIMITS.maxTarget,
                        Math.max(this.targetSeconds + 0.05, 0.1 + this.jitter * 3));
                } else {
                    // Slow recovery prevents oscillating between tiny and large buffers.
                    const desired = Math.min(AUDIO_BUFFER_LIMITS.maxStableTarget, 0.1 + this.jitter * 3);
                    this.targetSeconds = Math.max(desired, this.targetSeconds - Math.min(duration, 0.25) * 0.01);
                }
            }
        }
        this.lastArrival = now;
        this.lastDuration = duration;
    }

    endTurn() { this.lastArrival = undefined; }
    reset() { this.targetSeconds = 0.15; this.underruns = 0; this.lastArrival = undefined; this.jitter = 0; }
}
