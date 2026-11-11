import {type LiveCallbacks,type LiveServerMessage,type Session} from '@google/genai';
import {encodePCM} from './pcm';

type Connection = Pick<Session,'sendRealtimeInput'|'close'>;
type Connector = (callbacks:LiveCallbacks,signal:AbortSignal)=>Promise<Connection>;
type Events = {
 message:(message:LiveServerMessage)=>void;
 state:(message:string)=>void;
 error:(error:Error)=>void;
 sent:()=>void;
};

/** Sends audio independently of model generation and turnComplete events. */
export class LiveAudioStream {
 private controller=new AbortController();
 private connection?:Connection;
 private version=0;
 private reconnecting=false;
 private retryTimer?:ReturnType<typeof setTimeout>;
 private pending:ArrayBuffer[]=[];
 private retries=0;
 private stopped=false;
 private lastFailure='';

 constructor(private connect:Connector,private events:Events,private retryMs=10000){}

 async start(){await this.open();}

 send(chunk:ArrayBuffer){
  if(this.stopped)return;
  if(!this.connection){
   // Buffer only during a transport reconnect, never while the model is speaking.
   if(this.pending.length>=300){this.fail(Error('Mất kết nối quá lâu: bộ đệm audio 30 giây đã đầy.'));return;}
   this.pending.push(chunk);return;
  }
  try{
   this.connection.sendRealtimeInput({audio:{data:encodePCM(chunk),mimeType:'audio/pcm;rate=16000'}});
   this.events.sent();
  }catch{this.pending.push(chunk);this.reconnect();}
 }

 stop(){
  if(this.stopped)return;
  this.stopped=true;this.version++;this.controller.abort();clearTimeout(this.retryTimer);
  this.pending=[];const connection=this.connection;this.connection=undefined;connection?.close();
 }

 private async open(){
  const version=++this.version;
  this.events.state(this.reconnecting?'Đang kết nối lại Gemini…':'Đang kết nối Gemini…');
  try{
   const connection=await this.connect({
    onmessage:message=>{
     if(this.stopped||version!==this.version)return;
     this.events.message(message);
     if(message.goAway)this.reconnect();
    },
    onerror:()=>{if(version===this.version){this.lastFailure='Lỗi WebSocket';this.reconnect();}},
    onclose:event=>{if(version===this.version){this.lastFailure=`WebSocket đóng, mã ${event.code}`;this.reconnect();}}
   },this.controller.signal);
   if(this.stopped||version!==this.version){connection.close();return;}
   this.connection=connection;this.reconnecting=false;this.retries=0;
   this.events.state('Đang gửi / nhận audio liên tục');
   const buffered=this.pending;this.pending=[];
   for(let i=0;i<buffered.length;i++){
    this.send(buffered[i]);
    if(!this.connection){this.pending.push(...buffered.slice(i+1));break;}
   }
  }catch(error){
   if(this.stopped||version!==this.version)return;
   if(!this.reconnecting)throw error;
   this.lastFailure=error instanceof Error&&/Backend HTTP \d{3}/.test(error.message)?error.message:'Không mở được kết nối Live';
   this.reconnect();
  }
 }

 private reconnect(){
  if(this.stopped||this.retryTimer)return;
  if(++this.retries>3){this.fail(Error(`Không thể kết nối lại Gemini sau 3 lần thử. ${this.lastFailure}`));return;}
  this.reconnecting=true;this.version++;
  const previous=this.connection;this.connection=undefined;previous?.close();
  this.events.state(`Kết nối gián đoạn · đang giữ audio để kết nối lại${this.lastFailure?'\n'+this.lastFailure:''}`);
  this.retryTimer=setTimeout(()=>{this.retryTimer=undefined;void this.open();},this.retryMs);
 }

 private fail(error:Error){this.stop();this.events.error(error);}
}
