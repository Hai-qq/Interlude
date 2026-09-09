import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Brand} from './brand';
import {EditorialPanel} from './editorial-panel';
import type {BirdHandle} from '../shared/bird';
import type {Data} from './usage';
import type {SimpleSettings} from '../shared/simple';
import './tokens.css';import './style.css';import './scene.css';import './editorial.css';

declare global {interface Window {interlude:{draftChanged:(dirty:boolean)=>Promise<void>;onSettingsLeave:(cb:(destination:'hide'|'panel')=>void)=>()=>void;onVisibility:(cb:(visible:boolean)=>void)=>()=>void;snapshot:()=>Promise<Data>;command:(x:unknown)=>Promise<Data>;action:(name:string)=>Promise<Data>;subscribe:(cb:(x:Data)=>void)=>()=>void}}}
const view=new URLSearchParams(location.search).get('view')??'tray';
document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')??'light';
document.documentElement.dataset.view=view;
const friendlyError=()=> '操作未完成，请重试。设置没有保存时，请重新选择后保存。';

function App(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[starting,setStarting]=useState(false),[about,setAbout]=useState(false),[draftDirty,setDraftDirty]=useState(false),[leave,setLeave]=useState<'hide'|'panel'|null>(null),[leaving,setLeaving]=useState(false);
 const bird=useRef<BirdHandle>(null),preferences=useRef<PreferencesHandle>(null);
 const [openingSettings,setOpeningSettings]=useState(false);
 const [draftRevision,setDraftRevision]=useState(0);
 useEffect(()=>window.interlude.onSettingsLeave(setLeave),[]);
 useEffect(()=>{window.interlude.snapshot().then(setData).catch(()=>setError(friendlyError()));return window.interlude.subscribe(setData)},[]);
 useEffect(()=>window.interlude.onVisibility(visible=>{
  document.documentElement.classList.toggle('app-hidden',!visible);
  if(visible){document.documentElement.classList.remove('native-enter');void document.documentElement.offsetWidth;requestAnimationFrame(()=>document.documentElement.classList.add('native-enter'))}
 }),[]);
 useEffect(()=>{if(data)document.documentElement.dataset.theme=data.theme},[data?.theme]);
 useEffect(()=>{if(data?.panelPage==='companion'){setAbout(false);setLeave(null)}},[data?.panelPage]);
 const action=async(name:string)=>{if(name==='settings')setOpeningSettings(true);try{setData(await window.interlude.action(name))}catch{setError(friendlyError())}finally{if(name==='settings')setOpeningSettings(false)}};
 const run=async(type:string,extra:object={})=>{
  try{setError('');const next=await window.interlude.command({type,id:crypto.randomUUID(),...extra});setData(next);
   if(type==='start'&&next.phase!=='resting'){setError('当前无法开始休息，请回到电脑后重试。');return false}return true;
  }catch{setError(friendlyError());return false}
 };
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){if(about)setAbout(false);else if(view==='tray'&&data?.panelPage==='settings')void action('panel');else void action('hide')}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[about,data?.panelPage]);
 if(!data)return <main><Brand/>{error&&<p role="alert">{error}</p>}</main>;
 const start=async()=>{if(!await run('start'))throw Error('start failed');return true};
 const companion=<EditorialPanel data={data} card={view==='card'} bird={bird} error={error} busy={starting} openingSettings={openingSettings} action={action} run={run} start={start} onboard={async()=>{setStarting(true);await run('onboard');setStarting(false)}}/>;
 if(view==='card')return companion;

 const settingsPage=<main className="preferences-page"><header><div className="preferences-title"><h1>设置</h1>{draftDirty&&<span className="draft-note" role="status">未保存</span>}</div><button className="text-button" onClick={()=>action('panel')}>返回</button></header><Preferences ref={preferences} dirtyChanged={setDraftDirty} key={`${data.onboarded}-${draftRevision}`} data={data} error={error} save={async(settings,destination)=>{if(await run('settings',{settings})){await action(destination==='hide'?'discard-hide':'panel');return true}return false}} openAbout={()=>setAbout(true)}/>{about&&<About close={()=>setAbout(false)}/>}{leave&&<LeaveSettings error={error} busy={leaving} cancel={()=>setLeave(null)} discard={async()=>{const destination=leave;setLeave(null);setDraftDirty(false);setDraftRevision(v=>v+1);await action(`discard-${destination}`)}} save={async()=>{const destination=leave;setLeaving(true);try{if(await preferences.current?.save(destination))setLeave(null)}finally{setLeaving(false)}}}/>}</main>;
 return <div className="tray-surface">{data.panelPage!=='settings'&&companion}<div className="settings-surface" hidden={data.panelPage!=='settings'}>{settingsPage}</div></div>;
}

function Choices<T extends string|number>({label,value,options,change}:{label:string;value:T;options:{value:T;label:string}[];change:(value:T)=>void}){return <fieldset><legend>{label}</legend><div className={`choices${label==='使用时长'?' choices-work':''}`}>{options.map(o=><label className="choice" key={o.value}><input type="radio" name={label} value={o.value} checked={value===o.value} onChange={()=>change(o.value)}/><span>{o.label}</span></label>)}</div></fieldset>}
type PreferencesHandle={save:(destination?:'hide'|'panel')=>Promise<boolean>};
const Preferences=forwardRef<PreferencesHandle,{data:Data;error:string;save:(s:SimpleSettings,destination:'hide'|'panel')=>Promise<boolean>;openAbout:()=>void;dirtyChanged:(dirty:boolean)=>void}>(({data,error,save,openAbout,dirtyChanged},ref)=>{
 const [draft,setDraft]=useState({...data.settings}),[saving,setSaving]=useState(false);
 const dirty=JSON.stringify(draft)!==JSON.stringify(data.settings);
 useEffect(()=>{dirtyChanged(dirty);void window.interlude.draftChanged(dirty).catch(()=>{})},[dirty,dirtyChanged]);
 useEffect(()=>()=>{dirtyChanged(false);void window.interlude.draftChanged(false).catch(()=>{})},[dirtyChanged]);
 const submit=async(destination:'hide'|'panel'='panel')=>{setSaving(true);try{return await save(draft,destination)}finally{setSaving(false)}};
 useImperativeHandle(ref,()=>({save:submit}));
 const times=(presets:number[],current:number)=>[...new Set([...presets,current])].sort((a,b)=>a-b).map(value=>({value,label:`${value} 分钟`}));
 return <form className="preferences-form" onSubmit={e=>{e.preventDefault();void submit()}}><div className="preferences-scroll">
 <Choices label="使用时长" value={draft.workMinutes} options={times([25,30,40,45,60],data.settings.workMinutes)} change={workMinutes=>setDraft({...draft,workMinutes})}/><Choices label="休息时长" value={draft.restMinutes} options={times([1,3,5],data.settings.restMinutes)} change={restMinutes=>setDraft({...draft,restMinutes})}/>
 <Choices label="小窗位置" value={draft.placement} options={[{value:'top',label:'顶部中央'},{value:'corner',label:'屏幕角落'}]} change={placement=>setDraft({...draft,placement})}/>
 <Choices label="外观" value={draft.theme} options={[{value:'system',label:'跟随系统'},{value:'light',label:'浅色'},{value:'dark',label:'深色'}]} change={theme=>setDraft({...draft,theme})}/>
 <label className="switch-row"><span>登录后在后台运行</span><input type="checkbox" role="switch" checked={draft.openAtLogin} onChange={e=>setDraft({...draft,openAtLogin:e.target.checked})}/><span className="switch-track" aria-hidden="true"/></label>
 {data.warning&&<p role="status">{data.warning}</p>}{error&&<p className="error" role="alert">{error}</p>}</div><footer className="preferences-footer"><button type="button" className="text-button" onClick={openAbout}>关于间歇</button><button className="primary" type="submit" disabled={saving}>{saving?'正在保存…':'保存设置'}</button></footer></form>
});
function About({close}:{close:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const previous=document.activeElement as HTMLElement;const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close();previous?.focus()}},[]);return <dialog ref={ref} onCancel={e=>{e.preventDefault();close()}}><h2>关于间歇</h2><p>小歇在小窗里陪你偶尔离开屏幕。关闭小窗后，提醒继续在后台运行；点击菜单栏图标可以再次打开。</p><p>近期键鼠输入、媒体播放和前台切换参与使用估计；仅亮屏不会维持累计。休息中至少约八成时间连续没有输入，才记为有效间歇；这些信号不能识别站立或身体姿态。</p><p>每天仅在本机保存起来次数、最长连坐和总坐姿时长的估计值。</p><button className="primary" onClick={close}>知道了</button></dialog>}
function LeaveSettings({error,busy,cancel,discard,save}:{error:string;busy:boolean;cancel:()=>void;discard:()=>void;save:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus()}},[]);
 return <dialog ref={ref} className="leave-dialog" aria-labelledby="leave-title" onCancel={e=>{e.preventDefault();if(!busy)cancel()}}><h2 id="leave-title">设置还没有保存</h2><p>可以保存后离开，也可以继续编辑。</p>{error&&<p className="error" role="alert">{error}</p>}<div className="dialog-actions"><button className="secondary discard-button" disabled={busy} onClick={discard}>不保存</button><button className="secondary" disabled={busy} autoFocus onClick={cancel}>继续编辑</button><button className="primary" disabled={busy} onClick={save}>{busy?'正在保存…':'保存并离开'}</button></div></dialog>;
}
createRoot(document.getElementById('root')!).render(<App/>);
