import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePCM, AudioPlayer } from '../src/audio';
test('PCM16 signed little endian decoding', () => {
    const samples = decodePCM(Buffer.from([0, 128, 0, 0, 255, 127, 0, 64]).toString('base64'));
    assert.deepEqual([...samples], [-1, 0, 32767 / 32768, 0.5]);
    assert.throws(() => decodePCM('AA=='), /byte length/);
});
test('audio chunks are scheduled sequentially and cancelled on stop', () => {
    const starts: number[] = [], sources: Array<{
        stopped: boolean;
    }> = [];
    const context = { currentTime: 1, state: 'running', destination: {},
        createBuffer: (_channels: number, length: number, rate: number) => ({ duration: length / rate, copyToChannel: () => { } }),
        createBufferSource: () => { const s = { buffer: null, stopped: false, onended: null, connect: () => { }, disconnect: () => { }, start: (t: number) => starts.push(t), stop: () => { s.stopped = true; } }; sources.push(s); return s; } };
    const player = new AudioPlayer(context as unknown as AudioContext);
    const chunk = Buffer.alloc(4800).toString('base64');
    assert.equal(player.enqueue(chunk, 'audio/pcm;rate=24000'), 0.1);
    player.enqueue(chunk, 'audio/pcm;rate=24000');
    assert.ok(Math.abs(starts[1] - starts[0] - 0.1) < 1e-9);
    assert.throws(() => player.enqueue(chunk, 'audio/mp3'), /unsupported/);
    player.stop();
    assert.ok(sources.every(s => s.stopped));
});
