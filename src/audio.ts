import {AdaptiveAudioBuffer,AUDIO_BUFFER_LIMITS} from './adaptive-buffer';

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
    private sources = new Map<AudioBufferSourceNode,{buffer:AudioBuffer,start:number,end:number,offset:number}>();
    private adaptive = new AdaptiveAudioBuffer();
    private skipped = 0;
    constructor(private context: AudioContext) { }
    get pendingSeconds() { return Math.max(0, this.next - this.context.currentTime); }
    get bufferStats() { return {targetSeconds:this.adaptive.targetSeconds,underruns:this.adaptive.underruns,skippedSeconds:this.skipped}; }
    endTurn() { this.adaptive.endTurn(); }
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
        const buffer = this.context.createBuffer(1, samples.length, rate);
        buffer.copyToChannel(samples, 0);
        const now=this.context.currentTime;
        this.adaptive.observe(now,buffer.duration,this.next>0&&this.next<now);
        if(this.pendingSeconds+buffer.duration>AUDIO_BUFFER_LIMITS.maxBacklog){
            this.catchUp(buffer);
        }else{
            // Apply prebuffer on startup/rebuffer only; never insert silence between live chunks.
            const when=this.next<=now?now+this.adaptive.targetSeconds:this.next;
            this.schedule(buffer,when);
        }
        return buffer.duration;
    }

    private schedule(buffer:AudioBuffer,when:number,offset=0){
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.onended = () => { this.sources.delete(source); source.disconnect(); };
        this.sources.set(source,{buffer,start:when,end:when+buffer.duration-offset,offset});
        source.start(when,offset);
        this.next = when + buffer.duration-offset;
    }

    private catchUp(incoming:AudioBuffer){
        const now=this.context.currentTime;
        const buffers:Array<{buffer:AudioBuffer,offset:number}>=[];
        let remaining=AUDIO_BUFFER_LIMITS.catchUpBacklog as number;
        const old=[...this.sources.values()].filter(item=>item.end>now);
        const candidates=[...old.map(item=>({buffer:item.buffer,offset:item.offset+Math.max(0,now-item.start)})),{buffer:incoming,offset:0}];
        for(let i=candidates.length-1;i>=0&&remaining>0;i--){
            const {buffer,offset}=candidates[i];
            const keep=Math.min(buffer.duration-offset,remaining);
            buffers.unshift({buffer,offset:buffer.duration-keep});remaining-=keep;
        }
        const retained=AUDIO_BUFFER_LIMITS.catchUpBacklog-remaining;
        // Includes remaining scheduled audio only, not the part already played.
        const queued=old.reduce((sum,item)=>sum+item.end-Math.max(now,item.start),0)+incoming.duration;
        this.skipped+=Math.max(0,queued-retained);
        this.cancelSources();
        this.next=now+this.adaptive.targetSeconds;
        // Reuse decoded buffers and start at an offset instead of copying PCM tails.
        for(const {buffer,offset} of buffers)this.schedule(buffer,this.next,offset);
    }

    private cancelSources(){for (const source of this.sources.keys()) {
        source.onended = null;
        source.stop();
        source.disconnect();
    } this.sources.clear();}
    stop() {this.cancelSources();this.next=0;this.skipped=0;this.adaptive.reset();}
}

