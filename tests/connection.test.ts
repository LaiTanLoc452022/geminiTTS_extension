import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectLive} from '../src/connection';

test('token broker errors and malformed tokens fail before opening Live',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(null,{status:401});
  await assert.rejects(connectLive('test',{onmessage:()=>{}},new AbortController().signal),/HTTP 401/);
  globalThis.fetch=async()=>Response.json({token:null});
  await assert.rejects(connectLive('test',{onmessage:()=>{}},new AbortController().signal),/token không hợp lệ/);
 }finally{globalThis.fetch=original;}
});

test('stop cancels an in-flight token request',async()=>{
 const original=globalThis.fetch;
 const controller=new AbortController();
 try{
  globalThis.fetch=async(_input,init)=>new Promise((_,reject)=>{
   init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true});
  });
  const pending=connectLive('test',{onmessage:()=>{}},controller.signal);
  controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
 }finally{globalThis.fetch=original;}
});
