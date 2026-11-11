import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate } from '../src/usage';
import { MODEL, liveConfig } from '../src/config';
test('mixed audio/text billing and unknown modalities', () => {
    const r = estimate([{ modality: 'AUDIO', tokenCount: 1000000 }, { modality: 'TEXT', tokenCount: 1000000 }], [{ modality: 'AUDIO', tokenCount: 1000000 }, { modality: 'TEXT', tokenCount: 1000000 }, { modality: 'OTHER', tokenCount: 20 }]);
    assert.equal(r.usd, 24.5);
    assert.equal(r.unknown, 2000020);
});
test('Live Translate uses only supported translation settings without agent instructions', () => {
 const c=liveConfig();
 assert.deepEqual(c.responseModalities,['AUDIO']);
 assert.equal(c.outputAudioTranscription,undefined);
 assert.equal(c.inputAudioTranscription,undefined);
 assert.equal(MODEL,'gemini-3.5-live-translate-preview');
 assert.deepEqual(c.translationConfig,{targetLanguageCode:'vi',echoTargetLanguage:true});
 assert.equal(c.realtimeInputConfig,undefined);
 assert.equal(c.systemInstruction,undefined);
 assert.equal(c.temperature,undefined);
 assert.equal(c.thinkingConfig,undefined);
 assert.equal(c.maxOutputTokens,undefined);
 assert.equal(c.contextWindowCompression,undefined);
});
