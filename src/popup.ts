import {type PopupState} from './popup-state';

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const start=element<HTMLButtonElement>('start');
const stop=element<HTMLButtonElement>('stop');
let state:PopupState|undefined;
let busy=false;

function render(){
 const active=state?.active??false;
 start.disabled=busy||active;
 stop.disabled=!active;
 element('badge').classList.toggle('active',active);
 element('badge-text').textContent=busy?'Đang xử lý':active?'Đang kết nối / dịch':'Sẵn sàng';
 element('message').textContent=state?.message??'Mở video YouTube và bắt đầu nghe bản dịch.';
 element('wave').classList.toggle('playing',active&&(state?.signal??false));
 element('signal').textContent=active?(state?.signal?'Có tín hiệu audio':'Chờ tín hiệu audio'):'Chưa có phiên đang chạy';
 element('sent').textContent=`${(state?.sentSeconds??0).toFixed(1)} s`;
 element('tokens').textContent=(state?.tokens??0).toLocaleString('vi-VN');
 element('cost').textContent=`$${(state?.estimatedUsd??0).toFixed(6)}`;
 element('output').textContent=`${(state?.outputSeconds??0).toFixed(1)} s`;
 element('events').textContent=`${state?.audioChunks??0} / ${state?.events??0}`;
 element('dropped').textContent=`${state?.underruns??0} / ${(state?.skippedSeconds??0).toFixed(1)} s`;
 element('usage-note').textContent=state?.unknownTokens?'Ước tính chưa đủ phân loại token; không phải hóa đơn.':'Ước tính theo token đã nhận, không phải hóa đơn.';
}

for(const type of ['start','stop'])element(type).addEventListener('click',async()=>{
 if(busy&&type==='start')return;
 element('error').hidden=true;
 busy=true;render();
 try{
  const response=await chrome.runtime.sendMessage({target:'background',type});
  if(response?.error)throw Error(response.error);
  await refresh();
 }catch(error){element('error').textContent=(error as Error).message;element('error').hidden=false;}
 finally{busy=false;render();}
});


async function refresh(){
 const stored=await chrome.storage.session.get(['popupState','status']);state=stored.popupState;
 element('status').textContent=stored.status??'Chưa có phiên dịch.';render();
}

chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='session'&&(changes.popupState||changes.status))void refresh();
});
void refresh().catch(()=>{element('error').textContent='Không đọc được trạng thái extension. Hãy đóng rồi mở lại popup.';element('error').hidden=false;});
