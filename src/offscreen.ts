import {type LiveServerMessage} from '@google/genai';
import {MODEL} from './config';
import {TabAudioCapture} from './capture';
import {connectLive} from './connection';
import {pcmPeak} from './pcm';
import {estimate} from './usage';
import {AudioPlayer} from './audio';
import {LiveAudioStream} from './live-stream';
import {type PopupState} from './popup-state';

class TranslationSession {
 private capture=new TabAudioCapture();
 private context=new AudioContext({sampleRate:24000});
 private player=new AudioPlayer(this.context);
 private transport:LiveAudioStream;
 private stopped=false;
 private watch?:ReturnType<typeof setInterval>;
 private state='Đang khởi động';
 private received=0;
 private sent=0;
 private output=0;
 private peak=0;
 private tokens=0;
 private cost=0;
 private unknown=0;
 private events=0;
 private audioChunks=0;
 private lastAudio=0;
 private startedAt=Date.now();

 constructor(private onStopped:()=>void){
  this.transport=new LiveAudioStream((callbacks,signal)=>connectLive(callbacks,signal),{
   message:message=>this.receive(message),
   state:state=>{this.state=state;if(state==='Đang gửi / nhận audio liên tục')this.tokens=this.cost=this.unknown=0;this.publish();},
   error:error=>void this.stop(error.message),
   sent:()=>this.sent++
  });
 }

 async start(streamId:string){
  await this.capture.open(streamId,()=>void this.stop('Tab đã kết thúc luồng âm thanh.'));
  if(this.stopped)return;
  await this.context.resume();
  if(this.stopped)return;
  await this.transport.start();
  if(this.stopped)return;
  await this.capture.start(chunk=>{
   this.received++;this.peak=pcmPeak(chunk);this.transport.send(chunk);
  });
  if(this.stopped)return;
  this.watch=setInterval(()=>this.publish(),1000);
  this.publish();
 }

 async stop(reason='Đã dừng'){
  if(this.stopped)return;
  this.stopped=true;clearInterval(this.watch);
  this.onStopped();
  this.transport.stop();this.player.stop();
  this.state=reason;this.publish();
  await Promise.all([this.capture.close(),this.context.close().catch(()=>{})]);
 }


 private receive(message:LiveServerMessage){
  if(this.stopped)return;
  this.events++;
  const usage=message.usageMetadata;
  if(usage){
   this.tokens=usage.totalTokenCount??this.tokens;
   const price=estimate(usage.promptTokensDetails??[],usage.responseTokensDetails??[]);
   this.cost=price.usd;this.unknown=price.unknown;
   if(!(usage.promptTokensDetails?.length||usage.responseTokensDetails?.length))this.unknown=this.tokens;
  }
  try{
   if(message.serverContent?.interrupted)this.player.stop();
   for(const part of message.serverContent?.modelTurn?.parts??[]){
    const audio=part.inlineData;
    if(audio?.data&&audio.mimeType?.startsWith('audio/')){
     this.audioChunks++;this.lastAudio=Date.now();
     this.output+=this.player.enqueue(audio.data,audio.mimeType);
    }
   }
   if(message.serverContent?.turnComplete)this.player.endTurn();
  }catch(error){void this.stop('Lỗi phát audio: '+(error as Error).message);}
 }

 private publish(){
  const status=[this.state,`Model: ${MODEL}`,
   `Audio nguồn nhận/gửi: ${(this.received/10).toFixed(1)}s / ${(this.sent/10).toFixed(1)}s`,
   `Mức âm thanh: ${this.peak>0.001?'Có tín hiệu':'Im lặng / chưa nhận'}`,
   `Audio Gemini đã xếp phát: ${this.output.toFixed(1)}s`,
   `Chunk audio Gemini: ${this.audioChunks} · Sự kiện: ${this.events}`,
   `Bộ phát: ${this.context.state} · Chờ phát: ${this.player.pendingSeconds.toFixed(1)}s`,
   `Đệm mục tiêu: ${Math.round(this.player.bufferStats.targetSeconds*1000)}ms · Hụt đệm: ${this.player.bufferStats.underruns} · Bỏ audio cũ: ${this.player.bufferStats.skippedSeconds.toFixed(1)}s`,
   ...(this.lastAudio?[`Audio cuối: ${Math.round((Date.now()-this.lastAudio)/1000)}s trước`,...(Date.now()-this.lastAudio>15000?['Chưa có audio mới từ Live Translate. Kiểm tra tín hiệu nguồn và trạng thái kết nối.']:[])]:Date.now()-this.startedAt>15000?['Chưa nhận audio Live Translate. Kiểm tra audio nguồn gửi và quyền truy cập model.']:[]),
   `Token kết nối hiện tại: ${this.tokens}`,
   `Ước tính kết nối hiện tại: $${this.cost.toFixed(6)}${this.unknown?' (thiếu phân loại token)':''}`,
   'Không phải hóa đơn. Chi phí tiếp tục cho tới khi dừng.'
  ].join('\n');
  const details:PopupState={active:!this.stopped,message:this.state,model:MODEL,
   receivedSeconds:this.received/10,sentSeconds:this.sent/10,outputSeconds:this.output,signal:this.peak>0.001,
   tokens:this.tokens,estimatedUsd:this.cost,unknownTokens:this.unknown,
   bufferMs:Math.round(this.player.bufferStats.targetSeconds*1000),queuedSeconds:this.player.pendingSeconds,
   skippedSeconds:this.player.bufferStats.skippedSeconds,underruns:this.player.bufferStats.underruns,
   audioChunks:this.audioChunks,events:this.events};
  void chrome.runtime.sendMessage({target:'background',type:'status',status,details}).catch(()=>{});
 }
}

let current:TranslationSession|undefined;
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
 if(message.target!=='offscreen'||!['start','stop'].includes(message.type))return;
 if(message.type==='start'&&current){reply({error:'Đang có phiên dịch. Hãy Dừng trước khi bắt đầu lại.'});return;}
 const task=(async()=>{
  if(message.type==='stop'){const previous=current;current=undefined;await previous?.stop();return;}
  const session=new TranslationSession(()=>{if(current===session)current=undefined;});current=session;
  try{await session.start(message.streamId);}
  catch(error){await session.stop('Lỗi: '+(error as Error).message);if(current===session)current=undefined;throw error;}
 })();
 void task.then(()=>reply({ok:true})).catch(error=>reply({error:error.message}));return true;
});
