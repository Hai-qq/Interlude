import {GearSix,X} from '@phosphor-icons/react';
import {HandDrawnNumber} from './hand-drawn-number';
import {BirdScene} from './bird-scene';
import type {BirdHandle} from '../shared/bird';
import type {RefObject} from 'react';
import {time,unavailableReason,type Data} from './usage';
import type {BirdMood} from './graphite-bird';

type Props={data:Data;card:boolean;bird:RefObject<BirdHandle|null>;error:string;busy:boolean;openingSettings:boolean;action:(name:string)=>Promise<void>;run:(type:string)=>Promise<boolean>;start:()=>Promise<boolean>;onboard:()=>Promise<void>};
export function EditorialPanel({data,card,bird,error,busy,openingSettings,action,run,start,onboard}:Props){
 const rest=data.phase==='resting',due=data.phase==='due',welcome=!data.onboarded&&!card;
 const returned=(card||data.panelCompact)&&!rest&&!!data.restCompletion&&data.birdMotion?.kind==='return';
 const remaining=Math.max(0,Math.ceil(data.remainingMs/60000)),used=Math.floor(data.usageMs/60000);
 const minutes=rest?time(data.remainingMs):due||welcome||returned?String(data.settings.restMinutes):String(remaining);
 const heading=welcome?'给自己一点间歇':rest?'这几分钟，留给自己':returned?(data.restCompletion?.credited?'这一段间歇，刚刚好':'这次好像没走开'):data.paused?'提醒已暂停':due?'该起来走走了':'距离下一次休息';
 const unit=rest?'慢慢来，不着急':returned?(data.restCompletion?.credited?'分钟的休息':'分钟，再试一次'):due||welcome?'分钟的间歇':'分钟';
 const mood:BirdMood=data.paused||data.away?'still':returned||welcome?'idle':due?'due':data.remainingMs/data.reminderWindowMs<=.15?'near':data.remainingMs/data.reminderWindowMs<=.4?'attentive':'idle';
 const primary=welcome?'开启提醒':rest?'提前结束':returned?'继续做事':data.paused?'继续提醒':'现在休息';
 const secondary=rest?'收起计时':returned?'设置':data.paused?'收起':due?`稍后 ${data.nextSnoozeMinutes} 分钟`:'暂停提醒';
 const primaryClick=()=>{if(welcome)void onboard();else if(rest)void run('return');else if(returned)void action('hide');else if(data.paused)void run('resume');else bird.current?.release()};
 const secondaryClick=()=>{if(rest||data.paused)void action('hide');else if(returned)void action('settings');else void run(due?'snooze':'pause')};
 return <main className={['editorial-panel',card||data.panelCompact?'gentle-card':'quiet-panel',rest&&'resting',returned&&'returned',welcome&&'welcome-panel',data.paused&&'is-paused'].filter(Boolean).join(' ')}>
  <header className="editorial-header"><span className="editorial-wordmark">间歇</span>{card||rest||returned?<button className="editorial-icon" aria-label="收起提醒" onClick={()=>action('hide')}><X size={22} weight="regular"/></button>:<button className="editorial-icon" aria-label="设置" title="设置" disabled={openingSettings} aria-busy={openingSettings} onClick={()=>action('settings')}><GearSix size={25} weight="regular"/></button>}</header>
  <section className={`editorial-hero${rest?' is-rest':''}${minutes.length>2&&!rest?' many-digits':''}`} aria-label={rest?'休息计时':'休息提醒'}>
   <h1>{heading}</h1>
   <div className="editorial-number" role={rest?'timer':undefined} aria-label={rest?'休息剩余时间':`${minutes} 分钟`}><HandDrawnNumber value={minutes}/></div>
   <p className="editorial-unit">{unit}</p>
   <div className="editorial-bird"><BirdScene ref={bird} theme={data.theme} resting={rest} decorative={welcome} mood={mood} disabled={data.away||busy} disabledReason={data.away?unavailableReason:undefined} start={start}/></div>
  </section>
  <div className="editorial-actions"><button className="primary" disabled={busy||(!welcome&&!rest&&!returned&&!data.paused&&data.away)} title={data.away&&!rest?unavailableReason:undefined} aria-label={rest?'召回小歇，提前结束休息':undefined} onClick={primaryClick}>{busy?'正在开启…':primary}</button>{!welcome&&<button className="secondary" onClick={secondaryClick}>{secondary}</button>}</div>
  <p className="editorial-footer" title={`近 7 天 · 日均起来 ${data.summary.averageRises} 次 · 最长连坐约 ${data.summary.longestSitMinutes} 分钟。本机活动估计。`}>{error?<span role="alert">{error}</span>:welcome?`每使用 ${data.settings.workMinutes} 分钟，起来走走。`:rest?'放下键鼠，离开屏幕一会儿。':returned?(data.restCompletion?.credited?'这段间歇已记下。':'累计使用继续保留。'):data.away?unavailableReason:`本轮已用 ${used} 分钟`}</p>
 </main>;
}
