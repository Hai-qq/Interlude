import {contextBridge,ipcRenderer} from 'electron';
let visible=true;const visibilityListeners=new Set<(visible:boolean)=>void>();ipcRenderer.on('window-visibility',(_event,value:boolean)=>{visible=value;for(const callback of visibilityListeners)callback(value)});
contextBridge.exposeInMainWorld('interlude',{
 onVisibility:(callback:(visible:boolean)=>void)=>{visibilityListeners.add(callback);callback(visible);return()=>visibilityListeners.delete(callback)},
 snapshot:()=>ipcRenderer.invoke('snapshot'),command:(payload:unknown)=>ipcRenderer.invoke('command',payload),
 action:(name:string)=>ipcRenderer.invoke('action',name),
 draftChanged:(dirty:boolean)=>ipcRenderer.invoke('draft-changed',dirty),
 onSettingsLeave:(callback:(destination:'hide'|'panel')=>void)=>{const listener=(_event:unknown,destination:'hide'|'panel')=>callback(destination);ipcRenderer.on('settings-leave-request',listener);return()=>ipcRenderer.removeListener('settings-leave-request',listener)},
 subscribe:(callback:(data:unknown)=>void)=>{const listener=(_event:unknown,data:unknown)=>callback(data);ipcRenderer.on('snapshot',listener);return()=>ipcRenderer.removeListener('snapshot',listener)}
});
