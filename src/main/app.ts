import {app,BrowserWindow,Tray,Menu,nativeImage,nativeTheme,powerMonitor,screen,ipcMain,session,dialog,systemPreferences} from 'electron';
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';import {randomUUID} from 'node:crypto';
import {SimpleCycle,IDLE_THRESHOLD_SECONDS} from './simple-cycle';import {loadSimple,saveSimple} from './simple-store';import {simpleCommand,type SimpleCommand} from '../shared/simple';
import {BIRD_NAME,COMPACT_AFTER_MS,type BirdMotion} from '../shared/bird';
import {DailyRecords} from './daily-records';import {DesktopEnvironment} from './environment';
if(require('electron-squirrel-startup'))app.quit();
if(process.env.INTERLUDE_DATA_DIR)app.setPath('userData',path.resolve(process.env.INTERLUDE_DATA_DIR));
let panel:BrowserWindow|null=null,card:BrowserWindow|null=null,panelPage:'companion'|'settings'='companion',tray:Tray,cycle:SimpleCycle,dir:string,warning='';
let restSurface:'tray'|'card'='card';
const previewVisible=process.env.INTERLUDE_PREVIEW_VISIBLE==='1';
let quitting=false,backgroundLaunch=process.argv.includes('--background'),startupComplete=false,settingsDirty=false,quitPending=false,panelCompact=false;
let tick:NodeJS.Timeout,flush:NodeJS.Timeout,autoHide:NodeJS.Timeout|undefined,restTransition:NodeJS.Timeout|undefined,motionEnd:NodeJS.Timeout|undefined;
let environment:DesktopEnvironment,records:DailyRecords;
let handledReturn=0,pendingReturn:SimpleCycle['restCompletion']=null;
let birdMotion:(Omit<BirdMotion,'ageMs'>&{started:number})|null=null;
const renderer=path.join(__dirname,'renderer/index.html'),url=pathToFileURL(renderer).href;
const PANEL_WIDTH=320,PANEL_SCALE=PANEL_WIDTH/420;
const HOME_HEIGHT=320,REST_HEIGHT=320,SETTINGS_HEIGHT=396;
const resolvedTheme=(): 'light'|'dark'=>cycle.settings.theme==='system'?(nativeTheme.shouldUseDarkColors?'dark':'light'):cycle.settings.theme;
const payload=()=>({...cycle.snapshot(),onboarded:cycle.active,panelPage,panelCompact,warning,theme:resolvedTheme(),summary:records.summary(Date.now()),
 birdMotion:birdMotion?{id:birdMotion.id,kind:birdMotion.kind,reason:birdMotion.reason,ageMs:Math.max(0,performance.now()-birdMotion.started)}:null});
const suppressed=()=>!!cycle?.blocked.size||(!previewVisible&&environment?.value.captureActive===true);
const automaticSuppressed=()=>suppressed()||environment?.value.fullscreenQuiet===true;
function motion(kind:'depart'|'return',reason?:'early'|'completed'){
 birdMotion={id:randomUUID(),kind,reason,started:performance.now()};clearTimeout(motionEnd);
 motionEnd=setTimeout(()=>{birdMotion=null;publish()},kind==='return'?7200:1500);
}
function publish(){
 if(!cycle)return;
 const completed=cycle.restCompletion;if(completed&&completed.id!==handledReturn){handledReturn=completed.id;pendingReturn=completed}
 if(pendingReturn&&!automaticSuppressed()){const done=pendingReturn;pendingReturn=null;showReturn(done)}
 if(tray)updateTray();
 for(const w of [panel,card])if(w&&!w.isDestroyed()&&w.isVisible())w.webContents.send('snapshot',payload());
}
function make(kind:'tray'|'card'){
 const area=screen.getPrimaryDisplay().workArea;
 const w=new BrowserWindow({width:Math.min(PANEL_WIDTH,area.width),height:Math.min(kind==='tray'?HOME_HEIGHT:REST_HEIGHT,area.height),minWidth:300,minHeight:180,show:false,alwaysOnTop:previewVisible,frame:false,resizable:false,transparent:true,
  ...(process.platform==='darwin'?{vibrancy:'popover' as const,visualEffectState:'active' as const,roundedCorners:true}:{}),backgroundColor:'#00000000',skipTaskbar:true,title:'间歇 · Interlude',
  webPreferences:{zoomFactor:PANEL_SCALE,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 w.loadFile(renderer,{query:{view:kind,theme:resolvedTheme()}});w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());
 w.on('close',e=>{if(!quitting){e.preventDefault();if(w===panel&&requestSettingsLeave('hide'))return;hideWindow(w)}});
 w.on('hide',()=>releaseHiddenWindow(w));w.on('show',()=>visibility(w,true));w.on('minimize',()=>visibility(w,false));w.on('restore',()=>visibility(w,true));
 w.on('closed',()=>{clearTimeout(releases.get(w));if(panel===w){panel=null;settingsDirty=false}if(card===w)card=null});
 if(kind==='tray'&&!previewVisible)w.on('blur',()=>{if(panelPage!=='settings'&&!panelCompact&&cycle.phase!=='resting')hideWindow(w)});
 return w;
}
const releases=new WeakMap<BrowserWindow,NodeJS.Timeout>(),visibilities=new WeakMap<BrowserWindow,boolean>();
function visibility(w:BrowserWindow,visible:boolean){
 if(visible){clearTimeout(releases.get(w));releases.delete(w)}if(visibilities.get(w)===visible)return;
 visibilities.set(w,visible);w.webContents.send('window-visibility',visible);
}
function showWindow(w:BrowserWindow,inactive=false){
 for(const other of [panel,card])if(other!==w)hideWindow(other);
 if(inactive)w.showInactive();else w.show();if(w.isVisible())visibility(w,true);
}
function releaseHiddenWindow(w:BrowserWindow){
 if(w.isDestroyed()||releases.has(w))return;visibility(w,false);app.dock?.hide();if(w===panel&&settingsDirty)return;
 releases.set(w,setTimeout(()=>{releases.delete(w);if(!w.isDestroyed()&&!w.isVisible())w.destroy()},5000));
}
function hideWindow(w:BrowserWindow|null){if(!w||w.isDestroyed())return;if(w===panel)clearTimeout(restTransition);w.hide();releaseHiddenWindow(w)}
function ready(w:BrowserWindow,show:()=>void){if(w.webContents.isLoading())w.once('ready-to-show',show);else show()}
function requestSettingsLeave(destination:'hide'|'panel'){
 if(!settingsDirty||panelPage!=='settings'||!panel||panel.isDestroyed()||(!panel.isVisible()&&!panel.isMinimized()))return false;
 if(panel.isMinimized())panel.restore();showWindow(panel);panel.focus();panel.webContents.send('settings-leave-request',destination);return true;
}
async function requestQuit(){
 if(quitPending)return;quitPending=true;
 try{const result=await dialog.showMessageBox({type:'question',title:'退出间歇',message:'退出间歇？',detail:'退出后将停止提醒，重新打开后恢复。'+(settingsDirty?' 尚有未保存的设置。':''),buttons:['取消','退出间歇'],defaultId:0,cancelId:0,noLink:true});if(result.response===1)app.quit()}
 finally{quitPending=false}
}
function panelBounds(height:number,source:BrowserWindow|null=panel){
 const display=source&&!source.isDestroyed()&&source.isVisible()?screen.getDisplayMatching(source.getBounds()):screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
 const a=display.workArea,width=Math.min(PANEL_WIDTH,a.width),top=cycle.settings.placement==='top';height=Math.min(height,a.height-(top?8:32));
 const x=top?display.bounds.x+(display.bounds.width-width)/2:a.x+a.width-width-16,y=top?a.y+8:a.y+a.height-height-16;
 return {x:Math.round(Math.max(a.x,Math.min(x,a.x+a.width-width))),y:Math.max(a.y,y),width,height};
}
function resizePanel(target:BrowserWindow,height:number,animate:boolean){target.setBounds(panelBounds(height,target),animate&&process.platform==='darwin'&&!systemPreferences.getAnimationSettings().prefersReducedMotion)}
function openSettings(){
 clearTimeout(restTransition);clearTimeout(autoHide);if(!panel||panel.isDestroyed())panel=make('tray');const target=panel;
 ready(target,()=>{
  if(!target.isVisible())target.setBounds(panelBounds(HOME_HEIGHT,card?.isVisible()?card:null));
  panelPage='settings';cycle.tick(false);app.dock?.hide();if(process.platform==='darwin')app.show();if(target.isMinimized())target.restore();showWindow(target);target.focus();publish();resizePanel(target,SETTINGS_HEIGHT,true);
 });
}
function openRestCard(depart=false,fromPanel=false){
 clearTimeout(restTransition);restSurface=fromPanel?'tray':'card';let target:BrowserWindow;
 if(fromPanel){if(!panel||panel.isDestroyed())panel=make('tray');target=panel}
 else{if(!card||card.isDestroyed())card=make('card');target=card}
 app.dock?.hide();
 ready(target,()=>{
  if(cycle.phase!=='resting'||target.isDestroyed()||suppressed())return;
  const visible=target.isVisible(),animate=depart&&target===panel&&visible&&!systemPreferences.getAnimationSettings().prefersReducedMotion;
  if(target===panel){panelPage='companion';panelCompact=!animate}
  if(!visible)target.setBounds(panelBounds(REST_HEIGHT));
  showWindow(target,true);publish();
  if(target===panel&&visible){
   const compact=()=>{if(target.isDestroyed()||!target.isVisible()||cycle.phase!=='resting'||panelPage!=='companion')return;panelCompact=true;publish();resizePanel(target,REST_HEIGHT,true)};
   if(animate)restTransition=setTimeout(compact,COMPACT_AFTER_MS);else compact();
  }
  clearTimeout(autoHide);autoHide=setTimeout(()=>hideWindow(target),8000);
 });
}
function showReturn(completed:NonNullable<SimpleCycle['restCompletion']>){
 clearTimeout(restTransition);clearTimeout(autoHide);
 if(automaticSuppressed()){pendingReturn=completed;return}
 if(panelPage==='settings'&&panel?.isVisible())restSurface='card';
 let target:BrowserWindow;
 if(restSurface==='tray'){if(!panel||panel.isDestroyed())panel=make('tray');target=panel}
 else{if(!card||card.isDestroyed())card=make('card');target=card}
 ready(target,()=>{
  if(target.isDestroyed()||cycle.phase==='resting'||cycle.restCompletion?.id!==completed.id)return;
  if(automaticSuppressed()){pendingReturn=completed;return}
  if(target===panel){panelPage='companion';panelCompact=true}
  target.setBounds(panelBounds(REST_HEIGHT,target));motion('return',completed.reason);
  showWindow(target,true);publish();autoHide=setTimeout(()=>hideWindow(target),6500);
 });
}
function openPanel(toggle=false){
 if(requestSettingsLeave('panel'))return;
 if(cycle.phase==='resting'){
  const target=restSurface==='tray'?panel:card;
  if(toggle&&target?.isVisible()){clearTimeout(autoHide);hideWindow(target)}else openRestCard(false,restSurface==='tray');return;
 }
 clearTimeout(autoHide);app.dock?.hide();if(!panel||panel.isDestroyed())panel=make('tray');const target=panel;
 if(toggle&&target.isVisible()){hideWindow(target);return}
 ready(target,()=>{
  const visible=target.isVisible();panelPage='companion';panelCompact=false;cycle.tick(false);if(!visible)target.setBounds(panelBounds(HOME_HEIGHT));
  if(process.platform==='darwin')app.show();showWindow(target);publish();if(visible)resizePanel(target,HOME_HEIGHT,true);
 });
}
function remind(){
 if(automaticSuppressed()){cycle.announced=false;return}
 if(!card||card.isDestroyed())card=make('card');const target=card;
 ready(target,()=>{
  cycle.tick(false);
  if(target.isDestroyed()||cycle.phase!=='due'||automaticSuppressed()||cycle.idle||cycle.paused){cycle.announced=false;return}
  clearTimeout(motionEnd);birdMotion=null;
  target.setBounds(panelBounds(REST_HEIGHT,target));showWindow(target,true);publish();clearTimeout(autoHide);
  autoHide=setTimeout(()=>{
   hideWindow(target);
   if(cycle.phase==='due')cycle.command({type:'snooze',id:randomUUID()});
   publish();
  },12000);
 });
}
let trayState='';
function updateTray(){
 const state=cycle.snapshot(),minutes=Math.floor(state.usageMs/60000),seconds=Math.max(0,Math.ceil(state.remainingMs/1000));
 const restText=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 const title=!state.active?'':state.phase==='resting'?restText:state.paused?'暂停':state.phase==='due'?'歇歇':`${minutes}′`;
 const hint=!state.active?`打开间歇，认识${BIRD_NAME}`:state.phase==='resting'?`和${BIRD_NAME}休息 · 还剩 ${restText}`:state.paused?'提醒已暂停':state.phase==='due'?'该出去走走了':`已使用 ${minutes} 分钟 · 再使用 ${Math.ceil(state.remainingMs/60000)} 分钟后提醒${state.away?' · 暂停累计':''}`;
 const next=title+'|'+hint;if(next===trayState)return;trayState=next;
 if(process.platform==='darwin')tray.setTitle(title,{fontType:'monospacedDigit'});tray.setToolTip('间歇 · '+hint);
}
function contextMenu(){return Menu.buildFromTemplate([
 {label:'打开小窗',click:()=>openPanel()},
 {label:`稍后 ${cycle.snapshot().nextSnoozeMinutes} 分钟`,enabled:cycle.phase==='due',click:()=>perform({type:'snooze',id:randomUUID()})},
 {label:'设置',click:openSettings},{type:'separator'},{label:'退出间歇…',click:()=>void requestQuit()}
 ])}
function perform(c:SimpleCommand,sender:BrowserWindow|null=null){
 const old=cycle.settings.openAtLogin,wasResting=cycle.phase==='resting';if(c.type==='settings')saveSimple(dir,c.settings);cycle.command(c);
 if(c.type==='settings'){
  settingsDirty=false;nativeTheme.themeSource=cycle.settings.theme;
  if(old!==cycle.settings.openAtLogin)app.setLoginItemSettings({openAtLogin:cycle.settings.openAtLogin,...(process.platform==='win32'?{args:['--background']}:{})});
 }
 if(c.type==='onboard'){fs.writeFileSync(path.join(dir,'onboarded'),'1');openPanel()}
 if(['later','snooze','skip','pause'].includes(c.type)){clearTimeout(autoHide);hideWindow(card)}
 if(c.type==='start'&&!wasResting&&cycle.phase==='resting'){
  motion('depart');
  if(sender)openRestCard(true,sender===panel&&panelPage==='companion');
 }
 publish();return payload();
}
function check(e:Electron.IpcMainInvokeEvent){const w=BrowserWindow.fromWebContents(e.sender);if(!w||![panel,card].includes(w)||e.senderFrame!==e.sender.mainFrame||e.senderFrame?.url.split('?')[0]!==url)throw Error('拒绝不可信来源')}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',(_e,args)=>{if(args.includes('--background'))return;backgroundLaunch=false;app.whenReady().then(()=>openPanel())});
 app.on('activate',()=>{if(!startupComplete)return;if(panelPage==='settings'&&panel?.isVisible()){app.show();panel.focus();return}openPanel()});app.on('window-all-closed',()=>{});
 app.whenReady().then(()=>{
  backgroundLaunch||=app.getLoginItemSettings().wasOpenedAtLogin;dir=app.getPath('userData');const loaded=loadSimple(dir);records=new DailyRecords(dir);warning=[loaded.warning,records.warning].filter(Boolean).join(' ');
  cycle=new SimpleCycle({mono:()=>performance.now(),wall:()=>Date.now(),activity:()=>{
   try{return {...environment?.value,idleSeconds:powerMonitor.getSystemIdleTime(),state:powerMonitor.getSystemIdleState(IDLE_THRESHOLD_SECONDS) as 'active'|'idle'|'locked'|'unknown'}}
   catch{return {idleSeconds:Infinity,state:'unknown' as const}}
  }},loaded.settings,remind,{use:(ms,wall)=>records.use(ms,wall),rest:wall=>records.rest(wall)});
  cycle.active=fs.existsSync(path.join(dir,'onboarded'));nativeTheme.themeSource=cycle.settings.theme;saveSimple(dir,cycle.settings);
  session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith('file:')&&!d.url.startsWith('devtools:')}));
  environment=new DesktopEnvironment(()=>{
   if(environment.value.captureActive&&!previewVisible){hideWindow(card);if(panelPage==='companion')hideWindow(panel)}
   publish();
  });
  const image=nativeImage.createFromPath(path.join(__dirname,'../assets/menuTemplate.png'));
  image.addRepresentation({scaleFactor:2,buffer:fs.readFileSync(path.join(__dirname,'../assets/menuTemplate@2x.png'))});image.setTemplateImage(process.platform==='darwin');
  tray=new Tray(image);tray.on('click',()=>openPanel(true));tray.on('right-click',()=>tray.popUpContextMenu(contextMenu()));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Interlude',submenu:[
   {label:'打开小窗',accelerator:'CmdOrCtrl+Shift+I',click:()=>openPanel()},
   {label:'设置',accelerator:'CmdOrCtrl+,',click:openSettings},{label:'退出间歇…',accelerator:'CmdOrCtrl+Q',click:()=>void requestQuit()}
  ]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]));
  for(const [on,off,reason] of [['lock-screen','unlock-screen','lock'],['suspend','resume','sleep'],['user-did-resign-active','user-did-become-active','session']]){
   powerMonitor.on(on as any,()=>{cycle.block(reason,true);hideWindow(card);if(panelPage==='companion')hideWindow(panel);publish()});powerMonitor.on(off as any,()=>{cycle.block(reason,false);publish()});
  }
  if(powerMonitor.getSystemIdleState(300)==='locked')cycle.block('lock',true);
  screen.on('display-removed',()=>{for(const w of [panel,card])if(w&&!w.isDestroyed()){const b=w.getBounds(),a=screen.getDisplayMatching(b).workArea;w.setPosition(Math.max(a.x,Math.min(b.x,a.x+a.width-b.width)),Math.max(a.y,Math.min(b.y,a.y+a.height-b.height)))}});nativeTheme.on('updated',publish);
 ipcMain.handle('snapshot',e=>{check(e);cycle.tick(false);return payload()});
  ipcMain.handle('draft-changed',(e,dirty)=>{check(e);if(BrowserWindow.fromWebContents(e.sender)!==panel||typeof dirty!=='boolean')throw Error('无效的设置状态');settingsDirty=dirty});
  ipcMain.handle('command',(e,input)=>{check(e);const parsed=simpleCommand.safeParse(input);if(!parsed.success)throw Error('设置格式不正确，请重新选择后保存。');return perform(parsed.data,BrowserWindow.fromWebContents(e.sender))});
  ipcMain.handle('action',(e,name)=>{
   check(e);const sender=BrowserWindow.fromWebContents(e.sender);
   switch(name){
    case 'hide':if(sender===panel&&requestSettingsLeave('hide'))break;clearTimeout(autoHide);hideWindow(sender);if(sender===card&&cycle.phase==='due'){cycle.command({type:'snooze',id:randomUUID()});publish()}break;
    case 'settings':openSettings();break;
    case 'home':case 'open':case 'panel':openPanel();break;
    case 'discard-home':case 'discard-hide':case 'discard-panel':
     if(sender!==panel)throw Error('仅设置所在小窗可确认离开');settingsDirty=false;if(name==='discard-hide')hideWindow(panel);else openPanel();break;
    case 'quit':void requestQuit();break;
    default:throw Error('未知操作');
   }
   return payload();
  });
  environment.start();tick=setInterval(()=>{cycle.tick();if(cycle.idle&&cycle.phase==='due')hideWindow(card);publish()},1000);flush=setInterval(()=>records.flush(),60000);updateTray();
  if(!cycle.active||!backgroundLaunch)openPanel();else app.dock?.hide();setTimeout(()=>{startupComplete=true},500);
 });
 app.on('before-quit',()=>{quitting=true;clearInterval(tick);clearInterval(flush);clearTimeout(autoHide);clearTimeout(restTransition);clearTimeout(motionEnd);environment?.stop();records?.flush();tray?.destroy()});
}
// Main-process fixtures only; no testing bypasses in renderer IPC.
export {cycle,tray,environment,records};
