import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePCM, pcmPeak } from '../src/pcm';
import { decodePCM } from '../src/audio';
test('input PCM survives base64 round trip and measures signed peaks', () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    [-32768, 0, 16384, 32767].forEach((value, index) => view.setInt16(index * 2, value, true));
    assert.deepEqual([...decodePCM(encodePCM(buffer))], [-1, 0, 0.5, 32767 / 32768]);
    assert.equal(pcmPeak(buffer), 1);
    assert.equal(pcmPeak(new ArrayBuffer(3200)), 0);
});
