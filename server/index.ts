import { createServer } from 'node:http';
import { timingSafeEqual,randomUUID } from 'node:crypto';
import {appendSessionLog,sanitizeMetrics} from './session-log';
import { GoogleGenAI } from '@google/genai';
import { MODEL, liveConfig, TOKEN_LIFETIME_MS } from '../src/config.js';
const { GEMINI_API_KEY, EXTENSION_ID, PAIRING_SECRET } = process.env;
if (!GEMINI_API_KEY || !EXTENSION_ID?.match(/^[a-p]{32}$/) || !PAIRING_SECRET || PAIRING_SECRET.length < 32) throw Error('Configure GEMINI_API_KEY, EXTENSION_ID and PAIRING_SECRET in .env');
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { apiVersion: 'v1beta', timeout: 10000 } });
let busy = false, last = 0;
createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Origin');
  if (req.headers.origin !== `chrome-extension://${EXTENSION_ID}`) { res.writeHead(403).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const got = Buffer.from(req.headers.authorization ?? ''); const wanted = Buffer.from(`Bearer ${PAIRING_SECRET}`);
  if (got.length !== wanted.length || !timingSafeEqual(got, wanted)) { res.writeHead(401).end(); return; }
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
    const token = await ai.authTokens.create(
      { config: { uses: 1, expireTime: new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(), newSessionExpireTime: new Date(Date.now() + 60000).toISOString(), liveConnectConstraints: { model: MODEL, config: liveConfig() } } }
    );
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ token: token.name,sessionId }));
  } catch {
    res.writeHead(502).end(JSON.stringify({ error: 'Không cấp được token Gemini. Kiểm tra model, API key, quota, nhật ký và kết nối backend.' }));
  } finally { busy = false; }
}).listen(8787, '127.0.0.1', () => console.log('Token broker listening on http://127.0.0.1:8787'));
