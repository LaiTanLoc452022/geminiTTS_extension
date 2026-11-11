// Emit 100 ms of mono PCM16 at the capture context's 16 kHz sample rate.
class PCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.buffer = new ArrayBuffer(3200);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;

    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      const value = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
      this.view.setInt16(this.offset, value, true);
      this.offset += 2;

      if (this.offset === this.buffer.byteLength) {
        this.port.postMessage(this.buffer, [this.buffer]);
        this.reset();
      }
    }
    return true;
  }
}

registerProcessor('pcm', PCM);
