export {};
const status = document.querySelector('#status')!;
const secret = document.querySelector<HTMLInputElement>('#secret')!;
void chrome.storage.session.get('pairing').then(v => secret.value = v.pairing ?? '');
for (const type of ['start', 'stop','test-speaker'])
    document.querySelector('#' + type)!.addEventListener('click', async () => {
        try {
            status.textContent = 'Đang xử lý…';
            if (type === 'start')
                await chrome.storage.session.set({ pairing: secret.value });
            const r = await chrome.runtime.sendMessage({ target: 'background', type, secret: secret.value });
            if (r?.error)
                throw Error(r.error);
            await refresh();
        }
        catch (e) {
            status.textContent = (e as Error).message;
        }
    });
async function refresh() { const v = await chrome.storage.session.get('status'); status.textContent = v.status ?? 'Sẵn sàng'; }
void refresh();
setInterval(() => void refresh(), 1500);
