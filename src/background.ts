let starting = false;
chrome.runtime.onMessage.addListener((m, _sender, reply) => {
    if (m.target !== 'background')
        return;
    void (async () => {
        if (m.type === 'status') {
            await chrome.storage.session.set({ status: String(m.status) });
            return;
        }
        if (m.type === 'stop') {
            const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
            if (contexts.length)
                await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' });
            return;
        }
        if(m.type==='test-speaker'){
            const contexts=await chrome.runtime.getContexts({contextTypes:[chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]});
            if(!contexts.length)await chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.USER_MEDIA],justification:'Test audio output for live translation'});
            const result=await chrome.runtime.sendMessage({target:'offscreen',type:'test-speaker'});
            if(result?.error)throw Error(result.error);
            return;
        }
        if (m.type !== 'start')
            return;
        if (starting)
            throw Error('Đang khởi động phiên dịch.');
        starting = true;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.id || !tab.url?.startsWith('https://www.youtube.com/'))
                throw Error('Hãy mở tab YouTube trước.');
            const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [chrome.runtime.getURL('offscreen.html')] });
            if (!contexts.length)
                await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: [chrome.offscreen.Reason.USER_MEDIA], justification: 'Capture YouTube audio for live translation' });
            const streamId = await new Promise<string>((resolve, reject) => chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, id => { const error = chrome.runtime.lastError; if (error)
                reject(Error(error.message));
            else
                resolve(id); }));
            const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start', streamId, secret: m.secret });
            if (result?.error)
                throw Error(result.error);
        }
        finally {
            starting = false;
        }
    })().then(() => reply({ ok: true })).catch(e => reply({ error: e.message }));
    return true;
});
