import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('worklet downmixes stereo and emits exact 100 ms PCM chunks',()=>{
 const chunks:ArrayBuffer[]=[];
 let Processor!:new()=>{process(inputs:Float32Array[][]):boolean};
 class Base{port={postMessage:(buffer:ArrayBuffer)=>chunks.push(buffer)};}
 runInNewContext(readFileSync(new URL('../public/pcm-worklet.js',import.meta.url),'utf8'),{
  AudioWorkletProcessor:Base,registerProcessor:(_name:string,type:typeof Processor)=>{Processor=type;}
 });
 const processor=new Processor();
 assert.equal(processor.process([]),true);
 for(let i=0;i<25;i++)processor.process([[new Float32Array(128).fill(1),new Float32Array(128)]]);
 assert.equal(chunks.length,2);
 for(const chunk of chunks){assert.equal(chunk.byteLength,3200);const view=new DataView(chunk);for(let i=0;i<3200;i+=2)assert.equal(view.getInt16(i,true),16384);}
});
