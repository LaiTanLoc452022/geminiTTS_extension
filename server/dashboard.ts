import {readFile,open} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {type IncomingMessage,type ServerResponse} from 'node:http';
import {BackendSettings} from './settings';
import {LOG_PATH} from './session-log';
import {MODEL} from '../src/config';

const csrf=randomBytes(32).toString('hex');
export async function readJson(req:IncomingMessage){
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req){const buffer=Buffer.from(chunk);size+=buffer.length;if(size>4096)throw Error('Dữ liệu gửi quá lớn.');chunks.push(buffer);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export function json(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(body));}
async function recentLogs(){
 try{
  const file=await open(LOG_PATH,'r');
  try{const size=(await file.stat()).size;const start=Math.max(0,size-65536);const buffer=Buffer.alloc(size-start);await file.read(buffer,0,buffer.length,start);
   const lines=buffer.toString('utf8').split('\n');if(start>0)lines.shift();
   return lines.filter(Boolean).slice(-100).flatMap(line=>{try{const row=JSON.parse(line);if(typeof row.time!=='string'||!Number.isFinite(row.totalTokens)||!Number.isFinite(row.estimatedUsd))return [];return [{time:row.time,totalTokens:row.totalTokens,estimatedUsd:row.estimatedUsd}];}catch{return [];}}).reverse();
  }finally{await file.close();}
 }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
}

export async function dashboard(req:IncomingMessage,res:ServerResponse,settings:BackendSettings){
 const path=req.url??'/';
 if(!['/','/admin.css','/admin.js','/admin/state','/admin/config'].includes(path))return false;
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){json(res,403,{error:'Origin không hợp lệ.'});return true;}
 if(req.method==='GET'&&['/','/admin.css','/admin.js'].includes(path)){
  const name=path==='/'?'admin.html':path.slice(1);
  const content=await readFile(new URL(`./public/${name}`,import.meta.url),'utf8');
  res.writeHead(200,{'Content-Type':path==='/'?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});
  res.end(path==='/'?content.replace('__CSRF__',csrf):content);return true;
 }
 if(req.method==='GET'&&path==='/admin/state'){
  json(res,200,{...settings.publicState,model:MODEL,logs:await recentLogs()});return true;
 }
 if(req.method==='POST'&&path==='/admin/config'){
  const provided=Buffer.from(String(req.headers['x-admin-token']??''));const expected=Buffer.from(csrf);
  if(req.headers.origin!==`http://${req.headers.host}`||provided.length!==expected.length||!timingSafeEqual(provided,expected)){json(res,403,{error:'Hãy tải lại trang quản lý rồi thử lại.'});return true;}
  try{await settings.save(await readJson(req));json(res,200,settings.publicState);}
  catch(error){const message=(error as NodeJS.ErrnoException).code?'Không lưu được file .env. Kiểm tra quyền ghi thư mục dự án.':(error as Error).message;json(res,400,{error:message});}return true;
 }
 json(res,405,{error:'Phương thức không hợp lệ.'});return true;
}
