import {createRequire} from 'node:module';
createRequire(import.meta.url)('electron');
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
await build({entryPoints:['src/main/app.ts'],bundle:true,platform:'node',format:'cjs',external:['electron','electron-squirrel-startup'],outfile:'dist/main.cjs'});
await build({entryPoints:['src/preload.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:'dist/preload.cjs'});

fs.mkdirSync('assets/legal',{recursive:true});
for(const name of ['LICENSE','LICENSES.chromium.html']){const p='node_modules/electron/dist/'+name;if(fs.existsSync(p))fs.copyFileSync(p,'assets/legal/'+name);else throw new Error('Missing Electron license: '+p);}

if(process.platform==='darwin'){fs.mkdirSync('dist/native',{recursive:true});execFileSync('xcrun',['swiftc','-O','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macosx13.0`,'src/native/environment.swift','-o','dist/native/environment'],{stdio:'inherit'});}

fs.copyFileSync('assets/fonts/LXGWWenKaiLite-OFL.txt','assets/legal/LXGWWenKaiLite-OFL.txt');
