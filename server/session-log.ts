import {appendFile,mkdir} from 'node:fs/promises';

export const LOG_PATH=new URL('../logs/api-sessions.jsonl',import.meta.url);
let pending=Promise.resolve();

export function appendSessionLog(record:Record<string,unknown>){
 const line=JSON.stringify({time:new Date().toISOString(),...sanitizeMetrics(record)})+'\n';
 const write=pending.then(async()=>{
  await mkdir(new URL('.',LOG_PATH),{recursive:true});
  await appendFile(LOG_PATH,line,'utf8');
 });
 pending=write.catch(()=>{});return write;
}

/** Whitelist fields so secrets/audio/arbitrary strings can never be written by this endpoint. */
export function sanitizeMetrics(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object')throw Error('Invalid metrics');
 const data=value as Record<string,unknown>;
 const result:Record<string,unknown>={};
 for(const field of ['totalTokens','estimatedUsd']){
  const number=data[field];
  if(typeof number!=='number'||!Number.isFinite(number)||number<0)throw Error('Invalid numeric metric');
  result[field]=number;
 }
 return result;
}
