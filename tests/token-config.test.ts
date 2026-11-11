import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GoogleGenAI} from '@google/genai';
import {MODEL,liveConfig} from '../src/config';

test('SDK serializes translation settings into constrained token request',async()=>{
 let body:Record<string,unknown>|undefined;
 const client=new GoogleGenAI({apiKey:'test-key-not-real',httpOptions:{apiVersion:'v1beta',fetch:async(_url,init)=>{
  body=JSON.parse(String(init?.body));
  return Response.json({name:'auth_tokens/test'});
 }}});
 await client.authTokens.create({config:{uses:1,liveConnectConstraints:{model:MODEL,config:liveConfig()}}});
 assert.ok(body);
 const serialized=JSON.stringify(body);
 assert.match(serialized,/gemini-3\.5-live-translate-preview/);
 assert.match(serialized,/"translationConfig":\{"echoTargetLanguage":true,"targetLanguageCode":"vi"\}|"translationConfig":\{"targetLanguageCode":"vi","echoTargetLanguage":true\}/);
 assert.doesNotMatch(serialized,/systemInstruction|thinkingConfig|automaticActivityDetection/);
});
