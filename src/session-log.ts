import {type LiveServerMessage} from '@google/genai';
import {estimate} from './usage';

/** One summary per API connection, written when it ends. */
export class SessionLog {
 private finished=false;
 private totalTokens=0;
 private estimatedUsd=0;

 constructor(private id:string,private secret:string){}

 message(message:LiveServerMessage){
  const usage=message.usageMetadata;
  if(!usage)return;
  this.totalTokens=usage.totalTokenCount??this.totalTokens;
  this.estimatedUsd=estimate(usage.promptTokensDetails??[],usage.responseTokensDetails??[]).usd;
 }

 finish(){
  if(this.finished)return;this.finished=true;
  void fetch(`http://127.0.0.1:8787/sessions/${this.id}`,{
   method:'POST',headers:{Authorization:`Bearer ${this.secret}`,'Content-Type':'application/json'},
   signal:AbortSignal.timeout(5000),
   body:JSON.stringify({totalTokens:this.totalTokens,estimatedUsd:this.estimatedUsd})
  }).then(response=>{if(!response.ok)throw Error('Log write failed');})
    .catch(()=>console.warn('Không ghi được nhật ký phiên vào backend.'));
 }
}
