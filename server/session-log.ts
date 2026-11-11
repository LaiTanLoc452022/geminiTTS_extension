import {appendFile,mkdir} from 'node:fs/promises';

export const LOG_PATH=new URL('../logs/api-sessions.jsonl',import.meta.url);
let pending=Promise.resolve();
const logTimeFormatter=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
 hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
});

export function formatLogTime(date=new Date()){
 const parts=Object.fromEntries(logTimeFormatter.formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function appendSessionLog(record:Record<string,unknown>){
 const line=JSON.stringify({time:formatLogTime(),...sanitizeMetrics(record)})+'\n';
 const write=pending.then(async()=>{
  await mkdir(new URL('.',LOG_PATH),{recursive:true});
  await appendFile(LOG_PATH,line,'utf8');
  process.stdout.write(line);
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
