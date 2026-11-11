export function decodePCM(data: string) {
    const binary = atob(data);
    if (binary.length % 2)
        throw Error('Invalid PCM16 byte length');
    const samples = new Float32Array(binary.length / 2);
    for (let i = 0; i < samples.length; i++) {
        const value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
        samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
    }
    return samples;
}
export class AudioPlayer {
    private next = 0;
    private sources = new Set<AudioBufferSourceNode>();
    constructor(private context: AudioContext) { }
    get pendingSeconds() { return Math.max(0, this.next - this.context.currentTime); }
    enqueue(data: string, mimeType: string) {
        if (!/^audio\/pcm(?:;|$)/i.test(mimeType))
            throw Error('Gemini returned unsupported audio format');
        const rate = Number(/(?:^|;)\s*rate=(\d+)/i.exec(mimeType)?.[1] ?? 24000);
        if (!Number.isFinite(rate) || rate < 8000 || rate > 96000)
            throw Error('Invalid PCM sample rate');
        const samples = decodePCM(data);
        if (!samples.length)
            return 0;
        if (this.context.state !== 'running')
            throw Error('Audio bị tạm dừng bởi trình duyệt. Bấm Dừng rồi Bắt đầu lại.');
        if (Math.max(this.next - this.context.currentTime, 0) + samples.length / rate > 20)
            throw Error('Hàng đợi phát audio vượt 20 giây.');
        const buffer = this.context.createBuffer(1, samples.length, rate);
        buffer.copyToChannel(samples, 0);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.onended = () => { this.sources.delete(source); source.disconnect(); };
        this.sources.add(source);
        const when = Math.max(this.next, this.context.currentTime + 0.03);
        source.start(when);
        this.next = when + buffer.duration;
        return buffer.duration;
    }
    stop() { for (const source of this.sources) {
        source.onended = null;
        source.stop();
        source.disconnect();
    } this.sources.clear(); this.next = 0; }
}

/** Tests the same Web Audio output path without calling Gemini. */
export async function testSpeaker(context: AudioContext) {
    await context.resume();
    if (context.state !== 'running') throw Error('Trình duyệt chưa cho phép phát audio.');
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, context.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
    oscillator.connect(gain).connect(context.destination);
    await new Promise<void>(resolve => {
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); resolve(); };
        oscillator.start(); oscillator.stop(context.currentTime + 0.45);
    });
}
