const $=id=>document.getElementById(id);
let loading=false;
const number=new Intl.NumberFormat('vi-VN');
function notice(message,error=false){$('notice').textContent=message;$('notice').hidden=false;$('notice').classList.toggle('error',error);}
async function state(){
 const response=await fetch('/admin/state');if(!response.ok)throw Error('Không đọc được trạng thái backend.');
 const data=await response.json();
 $('readiness').classList.toggle('ready',data.ready);$('readiness').querySelector('span').textContent=data.ready?'Sẵn sàng kết nối':'Cần hoàn tất cấu hình';
 $('model').textContent=data.model;$('key-state').textContent=data.keyConfigured?'Đã lưu key':'Chưa có key';
 $('api-key').placeholder=data.keyConfigured?'Để trống để giữ key đang dùng':'Nhập API key Gemini';
 if(document.activeElement!==$('extension-id')&&!$('extension-id').dataset.edited)$('extension-id').value=data.extensionId||'';
 $('count').textContent=data.logs.length;$('sum-tokens').textContent=number.format(data.logs.reduce((sum,row)=>sum+row.totalTokens,0));
 $('sum-cost').textContent='$'+data.logs.reduce((sum,row)=>sum+row.estimatedUsd,0).toFixed(6);
 const rows=document.createDocumentFragment();
 for(const log of data.logs){const row=document.createElement('tr');for(const value of [log.time,number.format(log.totalTokens),'$'+log.estimatedUsd.toFixed(6)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}rows.append(row);}
 $('log-rows').replaceChildren(rows);$('empty').hidden=data.logs.length>0;
}
$('extension-id').addEventListener('input',()=>{$('extension-id').dataset.edited='true';});
$('reveal').addEventListener('click',()=>{const visible=$('api-key').type==='password';$('api-key').type=visible?'text':'password';$('reveal').textContent=visible?'Ẩn':'Hiện';$('reveal').setAttribute('aria-pressed',String(visible));});
$('config-form').addEventListener('submit',async event=>{
 event.preventDefault();if(loading)return;loading=true;$('save').disabled=true;
 try{
  const response=await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':document.querySelector('meta[name="admin-token"]').content},body:JSON.stringify({apiKey:$('api-key').value,extensionId:$('extension-id').value})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Không lưu được cấu hình.');
  $('api-key').value='';$('api-key').type='password';$('reveal').textContent='Hiện';$('reveal').setAttribute('aria-pressed','false');
  delete $('extension-id').dataset.edited;notice('Đã lưu. Cấu hình mới áp dụng cho lần kết nối tiếp theo, không cần khởi động lại backend.');await state();
 }catch(error){notice(error.message,true);}finally{loading=false;$('save').disabled=false;}
});
$('refresh').addEventListener('click',async()=>{$('refresh').disabled=true;try{await state();}catch(error){notice(error.message,true);}finally{$('refresh').disabled=false;}});
void state().catch(error=>notice(error.message,true));
setInterval(()=>{if(!document.hidden&&!loading)void state().catch(()=>{});},10000);
