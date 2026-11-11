import {readFile,writeFile,rename} from 'node:fs/promises';
import {parseEnv} from 'node:util';

export function validateSettings(value:unknown){
 if(!value||typeof value!=='object')throw Error('Dữ liệu cấu hình không hợp lệ.');
 const input=value as Record<string,unknown>;
 const extensionId=typeof input.extensionId==='string'?input.extensionId.trim():'';
 const apiKey=typeof input.apiKey==='string'?input.apiKey.trim():'';
 if(!/^[a-p]{32}$/.test(extensionId))throw Error('ID extension phải gồm 32 chữ cái a–p.');
 if(apiKey&&!/^[A-Za-z0-9_-]{20,200}$/.test(apiKey))throw Error('API key không đúng định dạng.');
 return {extensionId,apiKey};
}

export class BackendSettings {
 constructor(private envPath=new URL('../.env',import.meta.url)){}
 private apiKey=process.env.GEMINI_API_KEY??'';
 private extensionId=process.env.EXTENSION_ID??'';
 private writing=false;
 async load(){
  try{const values=parseEnv(await readFile(this.envPath,'utf8'));this.apiKey=values.GEMINI_API_KEY??this.apiKey;this.extensionId=values.EXTENSION_ID??this.extensionId;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 get key(){return this.apiKey;}
 get id(){return this.extensionId;}
 get publicState(){return {extensionId:this.extensionId,keyConfigured:!!this.apiKey&&this.apiKey!=='replace_me',ready:!!this.apiKey&&this.apiKey!=='replace_me'&&/^[a-p]{32}$/.test(this.extensionId)};}
 async save(value:unknown){
  if(this.writing)throw Error('Đang lưu cấu hình, vui lòng thử lại.');
  const {apiKey,extensionId}=validateSettings(value);
  if(!apiKey&&!this.publicState.keyConfigured)throw Error('Nhập API key để hoàn tất cấu hình.');
  this.writing=true;
  try{
   let previous='';try{previous=await readFile(this.envPath,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   const key=apiKey||this.apiKey;
   const values={GEMINI_API_KEY:key,EXTENSION_ID:extensionId};
   let text=previous;
   for(const [name,entry] of Object.entries(values)){
    const pattern=new RegExp(`^(?:export\\s+)?${name}\\s*=.*$`,'gm');
    if(pattern.test(text))text=text.replace(pattern,`${name}=${entry}`);else text+=`${text.endsWith('\n')||!text?'':'\n'}${name}=${entry}\n`;
   }
   const temporary=new URL(this.envPath.href+'.tmp');
   await writeFile(temporary,text,{encoding:'utf8',mode:0o600});await rename(temporary,this.envPath);
   this.apiKey=key;this.extensionId=extensionId;
  }finally{this.writing=false;}
 }
}
