// Development preview: the production renderer and cycle, with no desktop side effects.
import {SimpleCycle} from '../main/simple-cycle';
import {simpleCommand,simpleDefaults} from '../shared/simple';
import type {Data} from './usage';
const listeners=new Set<(data:Data)=>void>();
const leaves=new Set<(destination:'hide'|'panel')=>void>();
let page:Data['panelPage']='companion',dirty=false;
const cycle=new SimpleCycle({mono:()=>performance.now(),wall:()=>Date.now(),activity:()=>({idleSeconds:0,state:'active'})},{...simpleDefaults,workMinutes:45},()=>emit());
cycle.active=true;cycle.remaining=18*60000;cycle.usageMs=27*60000;
function snapshot():Data{return {...cycle.snapshot(),panelPage:page,panelCompact:false,birdMotion:null,onboarded:cycle.active,warning:'',theme:cycle.settings.theme==='dark'?'dark':'light',summary:{averageRises:0,longestSitMinutes:27,days:1}}}
function emit(){const data=snapshot();listeners.forEach(cb=>cb(data));parent.postMessage({type:'interlude-size',height:page==='settings'?520:420},location.origin);return data}
window.interlude={snapshot:async()=>snapshot(),subscribe:cb=>{listeners.add(cb);return()=>{listeners.delete(cb)}},onVisibility:()=>()=>{},draftChanged:async value=>{dirty=value},onSettingsLeave:cb=>{leaves.add(cb);return()=>{leaves.delete(cb)}},command:async value=>{cycle.command(simpleCommand.parse(value));return emit()},action:async name=>{if(name==='settings')page='settings';else if(page==='settings'&&dirty&&!name.startsWith('discard-'))leaves.forEach(cb=>cb(name==='hide'?'hide':'panel'));else if(name==='panel'||name.startsWith('discard-')){dirty=false;page='companion'}return emit()}};
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;const mode=event.data?.mode;if(event.data?.type!=='interlude-preview')return;if(mode==='light'||mode==='dark')cycle.settings={...cycle.settings,theme:mode};if(mode==='reset'){cycle.reset();cycle.active=true;cycle.paused=false;cycle.restCompletion=null;cycle.remaining=18*60000;cycle.usageMs=27*60000;page='companion'}if(mode==='due'){cycle.phase='due';cycle.remaining=0;cycle.usageMs=45*60000;cycle.restCompletion=null;cycle.paused=false;page='companion'}emit()});
setInterval(()=>{cycle.tick();emit()},1000);
void import('./app');
