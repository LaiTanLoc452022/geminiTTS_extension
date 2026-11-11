import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {dashboard} from '../server/dashboard';
import {BackendSettings,validateSettings} from '../server/settings';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

test('settings validation rejects malformed IDs and newline injection',()=>{
 assert.deepEqual(validateSettings({extensionId:'a'.repeat(32),apiKey:''}),{extensionId:'a'.repeat(32),apiKey:''});
 assert.throws(()=>validateSettings({extensionId:'bad',apiKey:''}));
 assert.throws(()=>validateSettings({extensionId:'a'.repeat(32),apiKey:'key\nEXTENSION_ID=evil'}));
});

test('saving settings preserves unrelated env values and keeps key when input is blank',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translate-settings-'));const path=join(directory,'.env');
 try{
  await writeFile(path,'# local settings\nOTHER_VALUE=keep\nGEMINI_API_KEY=test_key_123456789012345\nEXTENSION_ID='+ 'a'.repeat(32)+'\n');
  const settings=new BackendSettings(pathToFileURL(path));await settings.load();
  await settings.save({extensionId:'b'.repeat(32),apiKey:''});
  const contents=await readFile(path,'utf8');
  assert.match(contents,/OTHER_VALUE=keep/);assert.match(contents,/GEMINI_API_KEY=test_key_123456789012345/);
  assert.equal(settings.id,'b'.repeat(32));assert.equal(settings.publicState.ready,true);
  assert.equal('apiKey' in settings.publicState,false);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('dashboard masks API key and requires same-origin CSRF token before writes',async()=>{
 const settings=new BackendSettings();let saved=false;
 settings.save=async()=>{saved=true;};
 const server=createServer((req,res)=>{void dashboard(req,res,settings).then(handled=>{if(!handled)res.writeHead(404).end();}).catch(()=>res.writeHead(500).end());});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 const origin=`http://127.0.0.1:${address.port}`;
 try{
  const page=await fetch(origin);assert.equal(page.status,200);
  const html=await page.text();const token=/name="admin-token" content="([a-f0-9]+)"/.exec(html)?.[1];assert.ok(token);
  const status=await fetch(origin+'/admin/state').then(response=>response.json());
  assert.equal('apiKey' in status,false);assert.equal('key' in status,false);
  const evil=await fetch(origin+'/admin/config',{method:'POST',headers:{Origin:'https://evil.example','X-Admin-Token':token},body:'{}'});
  assert.equal(evil.status,403);assert.equal(saved,false);
  const missing=await fetch(origin+'/admin/config',{method:'POST',headers:{Origin:origin},body:'{}'});
  assert.equal(missing.status,403);assert.equal(saved,false);
  const valid=await fetch(origin+'/admin/config',{method:'POST',headers:{Origin:origin,'X-Admin-Token':token},body:'{}'});
  assert.equal(valid.status,200);assert.equal(saved,true);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
