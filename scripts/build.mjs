import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/background.ts','src/offscreen.ts','src/popup.ts'],outdir:'dist',bundle:true,minify:true,legalComments:'eof',format:'esm',target:'chrome116'});
for(const f of ['manifest.json','popup.html','popup.css','offscreen.html','pcm-worklet.js']) await copyFile('public/'+f,'dist/'+f);
