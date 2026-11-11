import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveServerMessage,type LiveCallbacks,type LiveSendRealtimeInputParameters} from '@google/genai';
import {LiveAudioStream} from '../src/live-stream';

test('audio input keeps flowing during model output without waiting for turnComplete',async()=>{
 const sent:LiveSendRealtimeInputParameters[]=[];
 let callbacks!:LiveCallbacks;
 let messages=0,closed=0;
 const stream=new LiveAudioStream(async cb=>{callbacks=cb;return {sendRealtimeInput:data=>sent.push(data),close:()=>{closed++;}};},{message:()=>messages++,state:()=>{},error:assert.fail,sent:()=>{}});
 await stream.start();
 const chunk=new ArrayBuffer(3200);
 for(let i=0;i<200;i++){
  stream.send(chunk);
  if(i===10)callbacks.onmessage(Object.assign(new LiveServerMessage(),{serverContent:{modelTurn:{parts:[{inlineData:{data:'AAA=',mimeType:'audio/pcm;rate=24000'}}]}}}));
 }
 assert.equal(sent.length,200);assert.equal(messages,1);
 assert.ok(sent.every(message=>message.audio&&!message.activityStart&&!message.activityEnd));
 callbacks.onmessage(Object.assign(new LiveServerMessage(),{serverContent:{turnComplete:true}}));
 stream.send(chunk);assert.equal(sent.length,201);
 stream.stop();stream.send(chunk);assert.equal(sent.length,201);assert.equal(closed,1);
});

test('goAway reconnects and drains only the transport buffer; stop cancels retry',async()=>{
 const callbacks:LiveCallbacks[]=[];const sent:number[]=[];let closes=0;
 const stream=new LiveAudioStream(async cb=>{const id=callbacks.length;callbacks.push(cb);return {sendRealtimeInput:()=>sent.push(id),close:()=>{closes++;}};},{message:()=>{},state:()=>{},error:assert.fail,sent:()=>{}},5);
 await stream.start();stream.send(new ArrayBuffer(3200));
 callbacks[0].onmessage(Object.assign(new LiveServerMessage(),{goAway:{}}));
 stream.send(new ArrayBuffer(3200));assert.deepEqual(sent,[0]);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.deepEqual(sent,[0,1]);assert.equal(closes,1);
 callbacks[1].onmessage(Object.assign(new LiveServerMessage(),{goAway:{}}));stream.stop();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(callbacks.length,2);
});

test('a connection resolving after stop is closed',async()=>{
 let resolve!:(connection:{sendRealtimeInput:()=>void;close:()=>void})=>void;
 let closes=0;
 const stream=new LiveAudioStream(()=>new Promise(done=>{resolve=done;}),{message:()=>{},state:()=>{},error:assert.fail,sent:()=>{}});
 const pending=stream.start();stream.stop();
 resolve({sendRealtimeInput:()=>{},close:()=>{closes++;}});
 await pending;assert.equal(closes,1);
});

test('repeated short-lived sockets stop after three reconnect attempts',async()=>{
 let attempts=0;let failure:Error|undefined;
 let finished!:()=>void;const done=new Promise<void>(resolve=>{finished=resolve;});
 const stream=new LiveAudioStream(async callbacks=>{
  attempts++;
  setTimeout(()=>callbacks.onclose?.({code:1006} as CloseEvent),1);
  return {sendRealtimeInput:()=>{},close:()=>{}};
 },{message:()=>{},state:()=>{},error:error=>{failure=error;finished();},sent:()=>{}},1);
 try{
  await stream.start();
  const timeout=setTimeout(finished,1000);
  await done;clearTimeout(timeout);
  assert.equal(attempts,4,'initial connection plus three retries');
  assert.match(failure?.message??'',/3 lần thử/);
 }finally{stream.stop();}
});
