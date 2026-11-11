import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveAudioBuffer} from '../src/adaptive-buffer';
import {AudioPlayer} from '../src/audio';

test('jitter expands target and stable audio gradually restores low latency',()=>{
 const policy=new AdaptiveAudioBuffer();
 policy.observe(0,0.1,false);
 policy.observe(0.3,0.1,true);
 policy.observe(0.8,0.1,true);
 assert.ok(policy.targetSeconds>0.25);assert.equal(policy.underruns,2);
 let time=0.8;
 for(let i=0;i<1000;i++){time+=0.1;policy.observe(time,0.1,false);}
 assert.ok(policy.targetSeconds>=0.1&&policy.targetSeconds<=0.25);
 policy.endTurn();policy.observe(time+4,0.1,true);
 assert.equal(policy.underruns,2,'sentence pause is not counted as network jitter');
 policy.reset();assert.equal(policy.targetSeconds,0.15);
});

function output(){
 let buffersCreated=0;
 const sources:Array<{stopped:boolean;startTime:number;buffer:AudioBuffer|null;onended:(()=>void)|null;stop:()=>void}>=[];
 const context={currentTime:1,state:'running',destination:{},
  createBuffer:(_channels:number,length:number,rate:number)=>{
   buffersCreated++;
   const data=new Float32Array(length);
   return {duration:length/rate,length,sampleRate:rate,copyToChannel:(samples:Float32Array)=>data.set(samples),getChannelData:()=>data};
  },
  createBufferSource:()=>{
   const source={stopped:false,startTime:0,buffer:null as AudioBuffer|null,onended:null as (()=>void)|null,
    connect:()=>{},disconnect:()=>{},start:(time:number)=>{source.startTime=time;},stop:()=>{source.stopped=true;}};
   sources.push(source);return source;
  }
 };
 return {context,sources,player:new AudioPlayer(context as unknown as AudioContext),bufferCount:()=>buffersCreated};
}

test('startup/rebuffer use adaptive target without gaps between healthy chunks',()=>{
 const {player,context,sources}=output();const chunk=Buffer.alloc(4800).toString('base64');
 player.enqueue(chunk,'audio/pcm;rate=24000');player.enqueue(chunk,'audio/pcm;rate=24000');
 assert.equal(sources[0].startTime,1.15);
 assert.ok(Math.abs(sources[1].startTime-sources[0].startTime-0.1)<1e-9);
 context.currentTime=1.4;
 player.enqueue(chunk,'audio/pcm;rate=24000');
 assert.equal(player.bufferStats.underruns,1);
 assert.ok(sources[2].startTime>=1.6-1e-9);
 player.stop();assert.ok(sources.every(source=>source.stopped));
});

test('stale backlog is discarded while retaining latest audio, including oversized chunks',()=>{
 const {player,sources,bufferCount}=output();const chunk=Buffer.alloc(24000).toString('base64');
 for(let i=0;i<8;i++)player.enqueue(chunk,'audio/pcm;rate=24000');
 assert.ok(player.bufferStats.skippedSeconds>0);
 assert.ok(player.pendingSeconds<3);
 assert.ok(sources.some(source=>source.stopped));
 player.enqueue(Buffer.alloc(24000*2*5).toString('base64'),'audio/pcm;rate=24000');
 assert.ok(player.pendingSeconds<=1.81);
 assert.ok(player.bufferStats.skippedSeconds>=5);
 assert.equal(bufferCount(),9,'one buffer per incoming chunk; catch-up reuses PCM');
 player.stop();assert.equal(player.pendingSeconds,0);
});
