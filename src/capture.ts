/** Owns tab audio resources; close() also cancels initialization in progress. */
export class TabAudioCapture {
    private closed = false;
    private stream?: MediaStream;
    private context?: AudioContext;
    private processor?: AudioWorkletNode;
    async open(streamId: string, onEnded: () => void) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as MediaTrackConstraints, video: false });
        if (this.closed) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        this.stream = stream;
        stream.getAudioTracks()[0].onended = onEnded;
    }
    async start(onChunk: (chunk: ArrayBuffer) => void) {
        if (this.closed || !this.stream)
            return;
        const context = new AudioContext({ sampleRate: 16000 });
        this.context = context;
        await context.audioWorklet.addModule('pcm-worklet.js');
        if (this.closed)
            return;
        const source = context.createMediaStreamSource(this.stream);
        // Monitor only the original tab stream. Gemini playback has a separate graph.
        source.connect(context.destination);
        const processor = new AudioWorkletNode(context, 'pcm');
        this.processor = processor;
        const mute = context.createGain();
        mute.gain.value = 0;
        source.connect(processor);
        processor.connect(mute).connect(context.destination);
        processor.port.onmessage = event => { if (!this.closed)
            onChunk(event.data); };
        await context.resume();
    }
    async close() {
        this.closed = true;
        if (this.processor) {
            this.processor.port.onmessage = null;
            this.processor.port.close();
            this.processor.disconnect();
        }
        this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
        await this.context?.close().catch(() => { });
    }
}
