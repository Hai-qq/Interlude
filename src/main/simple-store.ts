import fs from 'node:fs';import path from 'node:path';
import {simpleSettingsSchema,simpleDefaults,type SimpleSettings} from '../shared/simple';
export function atomicJSON(file:string,value:unknown){
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);
}
export function loadSimple(dir:string):{settings:SimpleSettings;warning:string}{
 fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'simple-settings.json');
 if(fs.existsSync(file)){
  try{
   const old=JSON.parse(fs.readFileSync(file,'utf8'));
   const {soundEnabled:_retiredSound,...retained}=old;
   const current=old.schemaVersion===2||old.schemaVersion===3?{...retained,schemaVersion:4}:old;
   return {settings:simpleSettingsSchema.parse(current),warning:''};
  }catch{fs.renameSync(file,file+'.backup-'+Date.now());return {settings:{...simpleDefaults},warning:'设置文件无法读取，已备份并恢复默认。'}}
 }
 const legacy=path.join(dir,'settings.json');
 try{if(fs.existsSync(legacy)){
  const old=JSON.parse(fs.readFileSync(legacy,'utf8'));
  const migrated=simpleSettingsSchema.parse({...simpleDefaults,workMinutes:old.tracking?.shortWorkSec/60,restMinutes:old.tracking?.shortBreakSec/60,openAtLogin:old.startup?.openAtLogin??false,theme:old.theme??'system'});
  return {settings:migrated,warning:''};
 }}catch{/* Leave historical files untouched. */}
 return {settings:{...simpleDefaults},warning:''};
}
export function saveSimple(dir:string,settings:SimpleSettings){atomicJSON(path.join(dir,'simple-settings.json'),simpleSettingsSchema.parse(settings))}
