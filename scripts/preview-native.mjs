import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import electron from 'electron';

const root=process.cwd(),stateFile=path.join(root,'.local/live-preview.json');
fs.mkdirSync(path.dirname(stateFile),{recursive:true});
let previous;try{previous=JSON.parse(fs.readFileSync(stateFile,'utf8'))}catch{}
const dataDir=previous?.dataDir&&fs.existsSync(previous.dataDir)?previous.dataDir:fs.mkdtempSync(path.join(os.tmpdir(),'interlude-live-preview-'));
if(!fs.existsSync(path.join(dataDir,'onboarded'))){
 fs.writeFileSync(path.join(dataDir,'onboarded'),'1');
 fs.writeFileSync(path.join(dataDir,'simple-settings.json'),JSON.stringify({schemaVersion:4,workMinutes:45,restMinutes:3,openAtLogin:false,theme:'light',placement:'top'}));
}
// Only restart the preview process recorded by this checkout.
if(previous?.pid&&previous.appPath===electron&&process.platform==='darwin'){
 let command='';try{command=execFileSync('ps',['-p',String(previous.pid),'-o','command='],{encoding:'utf8'}).trim()}catch{}
 if(command.startsWith(electron)&&command.includes(root)){
  process.kill(previous.pid,'SIGTERM');await new Promise(resolve=>setTimeout(resolve,500));
 }
}
const child=spawn(electron,[root],{detached:true,stdio:'ignore',env:{...process.env,INTERLUDE_DATA_DIR:dataDir,INTERLUDE_PREVIEW_VISIBLE:'1'}});
child.unref();fs.writeFileSync(stateFile,JSON.stringify({pid:child.pid,dataDir,appPath:electron,previewVisible:true},null,2));
console.log('Native preview opened with isolated data. Click outside to keep reviewing; Escape or the menu hides it.');
