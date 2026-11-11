import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeMetrics} from '../server/session-log';

test('session metrics whitelist excludes credentials, audio and arbitrary fields',()=>{
 const record=sanitizeMetrics({event:'checkpoint',elapsedMs:15000,totalTokens:123,inputTokens:100,outputTokens:23,
  audioChunksReceived:19,estimatedUsd:0.001,apiKey:'secret',token:'secret',audio:'base64',reason:'sensitive',sessionId:'forged'});
 assert.deepEqual(record,{totalTokens:123,estimatedUsd:0.001});
});

test('session metrics reject invalid events and unbounded numeric values',()=>{
 for(const value of [null,{}, {totalTokens:-1,estimatedUsd:0},{totalTokens:1,estimatedUsd:Infinity},{totalTokens:'12',estimatedUsd:0}]){
  assert.throws(()=>sanitizeMetrics(value));
 }
});
