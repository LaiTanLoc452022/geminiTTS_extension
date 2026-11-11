import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TabAudioCapture } from '../src/capture';
test('capture resolving after close stops its tracks immediately', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let resolve!: (stream: MediaStream) => void;
    let stopped = false;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(done => { resolve = done; }) } } });
    try {
        const capture = new TabAudioCapture();
        const pending = capture.open('test', () => assert.fail('unexpected ended callback'));
        await capture.close();
        resolve({ getTracks: () => [{ stop: () => { stopped = true; } }] } as unknown as MediaStream);
        await pending;
        assert.equal(stopped, true);
    }
    finally {
        if (previous)
            Object.defineProperty(globalThis, 'navigator', previous);
        else
            Reflect.deleteProperty(globalThis, 'navigator');
    }
});
