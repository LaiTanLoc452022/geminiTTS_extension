import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import {appendSessionLog,sanitizeMetrics} from './session-log';
import { GoogleGenAI } from '@google/genai';
import { MODEL, liveConfig, TOKEN_LIFETIME_MS } from '../src/config.js';
import {BackendSettings} from './settings';
import {dashboard,json} from './dashboard';
const settings=new BackendSettings();await settings.load();
let busy = false, last = 0;
createServer(async (req, res) => {try{
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Origin');
  if(!['127.0.0.1:8787','localhost:8787'].includes(req.headers.host??'')){res.writeHead(403).end();return;}
  if(await dashboard(req,res,settings))return;
  if (!settings.publicState.ready||req.headers.origin !== `chrome-extension://${settings.id}`) { res.writeHead(403).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const sessionMatch=/^\/sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(req.url??'');
  if(req.method==='POST'&&sessionMatch){
    try{
      let bytes=0;const chunks:Buffer[]=[];
      for await(const chunk of req){const buffer=Buffer.from(chunk);bytes+=buffer.length;if(bytes>4096){res.writeHead(413).end();return;}chunks.push(buffer);}
      const metrics=sanitizeMetrics(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      await appendSessionLog({...metrics,sessionId:sessionMatch[1]});res.writeHead(204).end();
    }catch{res.writeHead(400).end();}return;
  }
  if (req.method !== 'POST' || req.url !== '/token') { res.writeHead(404).end(); return; }
  if (busy || Date.now() - last < 10000) { res.writeHead(429).end(); return; } busy = true; last = Date.now();
  const sessionId=randomUUID();
  try {
    const ai = new GoogleGenAI({ apiKey:settings.key, httpOptions: { apiVersion: 'v1beta', timeout: 10000 } });
    const token = await ai.authTokens.create(
      { config: { uses: 1, expireTime: new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(), newSessionExpireTime: new Date(Date.now() + 60000).toISOString(), liveConnectConstraints: { model: MODEL, config: liveConfig() } } }
    );
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ token: token.name,sessionId }));
  } catch {
    res.writeHead(502).end(JSON.stringify({ error: 'Không cấp được token Gemini. Kiểm tra model, API key, quota, nhật ký và kết nối backend.' }));
  } finally { busy = false; }
}catch{if(!res.headersSent)json(res,500,{error:'Backend gặp lỗi xử lý yêu cầu.'});else res.end();}
}).listen(8787, '127.0.0.1', () => console.log('Backend dashboard: http://127.0.0.1:8787'));
