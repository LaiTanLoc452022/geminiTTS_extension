import { GoogleGenAI, type LiveCallbacks, type Session } from '@google/genai';
import { MODEL, liveConfig } from './config';
import {SessionLog} from './session-log';
export async function connectLive(secret: string, callbacks: LiveCallbacks, signal: AbortSignal): Promise<Session> {
    const response = await fetch('http://127.0.0.1:8787/token', {
        method: 'POST', headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
    });
    if (!response.ok)
        throw Error(`Backend HTTP ${response.status}: kiểm tra mã ghép nối, quota và cấu hình.`);
    const { token,sessionId } = await response.json();
    if (typeof token !== 'string' || !token)
        throw Error('Backend trả token không hợp lệ.');
    signal.throwIfAborted();
    const log=typeof sessionId==='string'&&/^[0-9a-f-]{36}$/.test(sessionId)?new SessionLog(sessionId,secret):undefined;
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1beta' } });
    let expired = false;
    const connection = ai.live.connect({ model: MODEL, config: liveConfig(), callbacks:{...callbacks,
        onmessage:message=>{log?.message(message);callbacks.onmessage(message);},
        onclose:event=>{log?.finish();callbacks.onclose?.(event);},
        onerror:event=>{log?.finish();callbacks.onerror?.(event);}
    }});
    void connection.then(session => { if (expired || signal.aborted)
        session.close(); }).catch(() => { });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: () => void = () => { };
    try {
        const session=await Promise.race([
            connection,
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Kết nối Gemini quá 15 giây.')), 15000); }),
            new Promise<never>((_, reject) => { abort = () => reject(Error('Đã hủy kết nối.')); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted)
                abort(); })
        ]);
        const close=session.close.bind(session);
        session.close=()=>{log?.finish();close();};
        return session;
    }
    catch (error) {
        expired = true;
        log?.finish();
        throw error;
    }
    finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
}
