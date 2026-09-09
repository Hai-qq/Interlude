import {simpleDefaults,type SimpleSettings,type SimpleCommand} from '../shared/simple';
import {stageForProgress,type Stage} from '../shared/companion';
export type DesktopActivity={idleSeconds:number;state:'active'|'idle'|'locked'|'unknown';screenAwake?:boolean;mediaActive?:boolean;appSwitch?:boolean};
export const IDLE_THRESHOLD_SECONDS=600;
export const SNOOZE_STEPS=[5,8,12] as const;
export const SNOOZE_MS=SNOOZE_STEPS[0]*60000;
export function isPresent(sample:DesktopActivity){
 if(sample.state==='locked'||sample.screenAwake===false)return false;
 return sample.mediaActive===true||sample.appSwitch===true||
  (sample.state!=='unknown'&&Number.isFinite(sample.idleSeconds)&&sample.idleSeconds<IDLE_THRESHOLD_SECONDS);
}
type CycleEvents={use?:(ms:number,wall:number,continuousMs:number)=>void;rest?:(wall:number)=>void};

/** Presence estimates use; input absence verifies a break. Neither is a posture sensor. */
export class SimpleCycle {
 phase:'working'|'due'|'resting'='working';remaining:number;usageMs=0;reminderWindowMs:number;
 deferred:'none'|'snoozed'|'skipped'='none';snoozeCount=0;stage:Stage=0;stageAt=0;dueSequence=0;
 active=false;paused=false;blocked=new Set<string>();last:number;
 restEnd=0;restWallEnd=0;restDurationMs=0;restStarted=0;restQuietMs=0;restWatchful=false;restRound=0;
 grace=0;announced=false;seen=new Set<string>();idle=false;blockedSinceWall=0;private absentAt:number|null=null;
 restCompletion:{id:number;reason:'early'|'completed';credited:boolean}|null=null;private completionSequence=0;
 private workRemaining=0;private restQuietStart=0;private lastRestInput=-Infinity;
 private evidenceAt:number;private pending:{end:number;wall:number;ms:number;spent:number;continuous:number}[]=[];
 constructor(public clock:{mono():number;wall():number;activity?:()=>DesktopActivity},public settings:SimpleSettings={...simpleDefaults},public notify:()=>void=()=>{},public events:CycleEvents={}){
  this.remaining=this.reminderWindowMs=settings.workMinutes*60000;this.last=this.evidenceAt=clock.mono();
 }
 private schedule(ms:number,deferred:typeof this.deferred){
  this.phase='working';this.remaining=this.reminderWindowMs=ms;this.deferred=deferred;this.announced=false;this.last=this.clock.mono();
 }
 reset(){
  this.schedule(this.settings.workMinutes*60000,'none');this.usageMs=0;this.stage=0;this.stageAt=this.clock.mono();this.snoozeCount=0;
  this.restEnd=0;this.restWallEnd=0;this.restDurationMs=0;this.restQuietMs=0;this.restWatchful=false;
  this.pending=[];this.evidenceAt=this.clock.mono();
 }
 private credit(){if(this.usageMs>0)this.events.rest?.(this.clock.wall());this.reset()}
 private use(dt:number){this.usageMs+=dt;this.events.use?.(dt,this.clock.wall(),this.usageMs)}
 private confirmPending(){
  while(this.pending.length){
   const p=this.pending[0],part=Math.min(p.ms,Math.max(0,this.evidenceAt-(p.end-p.ms)));
   if(!part)break;
   this.events.use?.(part,p.wall-(p.ms-part),p.continuous-(p.ms-part));
   p.ms-=part;p.spent=Math.max(0,p.spent-part);
   if(!p.ms)this.pending.shift();else break;
  }
 }
 private discardPending(){
  for(const p of this.pending){this.usageMs-=p.ms;this.remaining+=p.spent}
  this.pending=[];this.usageMs=Math.max(0,this.usageMs);
  if(this.remaining>0)this.phase='working';
 }
 private work(dt:number,now:number){
  const spent=Math.min(dt,this.remaining);this.usageMs+=dt;this.remaining-=spent;
  // Input-only grace remains provisional until later activity confirms reading.
  this.pending.push({end:now,wall:this.clock.wall(),ms:dt,spent,continuous:this.usageMs});this.confirmPending();
  if(this.remaining===0)this.phase='due';
 }
 private advanceStage(now:number){
  const progress=Math.max(0,1-this.remaining/this.reminderWindowMs);
  const target=this.phase==='due'?4:this.deferred==='none'?stageForProgress(progress):Math.max(2,stageForProgress(progress));
  if(target>this.stage&&now-this.stageAt>=1200){this.stage=(this.stage+1) as Stage;this.stageAt=now}
 }
 private finishRest(reason:'early'|'completed'){
  if(this.phase!=='resting')return;
  const credited=this.restQuietMs>=this.restDurationMs*.8;
  if(credited)this.credit();
  else{
   this.remaining=this.workRemaining;this.phase=this.remaining<=0?'due':'working';
   this.restEnd=0;this.restWallEnd=0;this.restWatchful=false;
  }
  this.restCompletion={id:++this.completionSequence,reason,credited};
  if(reason==='early')this.paused=false;
 }
 tick(deliver=true){
  const now=this.clock.mono(),dt=Math.max(0,now-this.last);this.last=now;if(!this.active)return;
  const sample=this.clock.activity?.()??{idleSeconds:0,state:'active',screenAwake:true};
  const seconds=Number.isFinite(sample.idleSeconds)?Math.max(0,sample.idleSeconds):0;
  this.idle=!isPresent(sample);
  if(this.phase==='resting'){
   const until=Math.min(now,this.restEnd),inputAt=now-seconds*1000;
   const knownInput=sample.state!=='unknown'&&Number.isFinite(sample.idleSeconds);
   if(!this.blocked.size&&knownInput&&inputAt>this.restStarted+1000&&inputAt>this.lastRestInput+500){
    // Retain the longest completed quiet interval before starting another one.
    this.restQuietMs=Math.max(this.restQuietMs,Math.max(0,Math.min(inputAt,until)-this.restQuietStart));
    this.restQuietStart=Math.min(until,inputAt);this.lastRestInput=inputAt;
   }
   if(knownInput||this.blocked.size){this.restQuietMs=Math.max(this.restQuietMs,Math.max(0,until-this.restQuietStart))}
   this.restWatchful=!this.blocked.size&&now-this.restStarted>8000&&this.lastRestInput>this.restStarted+1000&&seconds<15;
   if(this.restWatchful&&!this.paused&&!this.idle&&dt<=15000){this.use(dt);this.workRemaining=Math.max(0,this.workRemaining-dt)}
   this.remaining=Math.max(0,this.restEnd-now);
   if(now>=this.restEnd)this.finishRest('completed');
  }else if(!this.blocked.size){
   const known=sample.state!=='unknown'&&Number.isFinite(sample.idleSeconds);
   if(!this.idle){
    this.evidenceAt=Math.max(this.evidenceAt,sample.mediaActive||sample.appSwitch?now:now-seconds*1000);
    this.confirmPending();
   }
   if(this.idle){
    if(known||sample.state==='locked'||sample.screenAwake===false){
     this.absentAt??=this.evidenceAt;this.discardPending();
     if(now-this.absentAt>=this.settings.restMinutes*60000&&this.usageMs>0)this.credit();
    }else this.absentAt=null;
   }else{
    this.absentAt=null;
    if(!this.paused&&dt>0&&dt<=15000)this.work(dt,now);
    this.advanceStage(now);
   }
  }
  if(deliver&&!this.idle&&!this.paused&&this.phase==='due'&&this.stage===4&&!this.announced&&!this.blocked.size&&now>=this.grace){
   this.announced=true;this.dueSequence++;this.notify();
  }
 }
 block(reason:string,on:boolean){
  this.tick(false);if(!on&&!this.blocked.has(reason))return;
  if(on){if(!this.blocked.size){this.blockedSinceWall=this.clock.wall();if(this.phase!=='resting')this.discardPending()}this.blocked.add(reason)}
  else{
   this.blocked.delete(reason);
   if(!this.blocked.size){
    const absent=Math.max(0,this.clock.wall()-this.blockedSinceWall);
    if(this.phase==='resting'){
     // Monotonic clocks may suspend; the wall deadline is used only for a known system block.
     if(this.clock.wall()>=this.restWallEnd){this.restQuietMs=Math.max(this.restQuietMs,Math.min(absent,this.restDurationMs));this.finishRest('completed')}
    }else if(absent>=this.settings.restMinutes*60000&&this.usageMs>0)this.credit();
    this.grace=this.clock.mono()+30000;this.absentAt=null;
   }
  }
  this.last=this.clock.mono();
 }
 command(c:SimpleCommand){
  if(this.seen.has(c.id))return;this.seen.add(c.id);if(this.seen.size>256)this.seen.delete(this.seen.values().next().value!);
  this.tick(false);
  switch(c.type){
   case 'pause':this.paused=true;break;
   case 'resume':this.paused=false;this.last=this.clock.mono();break;
   // Old callers of skip/later use the same bounded backoff; there is only one deferral behavior.
   case 'later':case 'skip':case 'snooze':
    if(this.phase==='due'){
     const minutes=SNOOZE_STEPS[Math.min(this.snoozeCount,SNOOZE_STEPS.length-1)];this.snoozeCount++;
     this.schedule(minutes*60000,'snoozed');this.stage=2;this.stageAt=this.clock.mono();
    }
    break;
   case 'onboard':this.active=true;this.reset();break;
   case 'return':this.finishRest('early');break;
   case 'start':
    if(!this.active||this.phase==='resting'||this.blocked.size||this.idle)return;
    this.restCompletion=null;this.restRound++;this.workRemaining=this.remaining;this.phase='resting';this.remaining=this.settings.restMinutes*60000;this.restDurationMs=this.remaining;
    this.restStarted=this.clock.mono();this.restEnd=this.restStarted+this.remaining;this.restWallEnd=this.clock.wall()+this.remaining;
    this.restQuietStart=this.restStarted;this.lastRestInput=this.restStarted;this.restQuietMs=0;this.restWatchful=false;break;
   case 'settings':{
    const elapsed=this.reminderWindowMs-(this.phase==='resting'?this.workRemaining:this.remaining);this.settings=c.settings;
    if(this.deferred==='none'){
     this.reminderWindowMs=c.settings.workMinutes*60000;
     if(this.phase==='resting')this.workRemaining=Math.max(0,this.reminderWindowMs-elapsed);
     else{this.remaining=Math.max(0,this.reminderWindowMs-elapsed);this.phase=this.remaining===0?'due':'working';if(this.phase==='working')this.announced=false}
    }
    break;
   }
  }
 }
 snapshot(){
  return {phase:this.phase,remainingMs:this.remaining,usageMs:this.usageMs,reminderWindowMs:this.reminderWindowMs,deferred:this.deferred,
   restDurationMs:this.restDurationMs,restCompletion:this.restCompletion,restWatchful:this.restWatchful,restRound:this.restRound,
   active:this.active,paused:this.paused,away:this.blocked.size>0||this.idle,settings:this.settings,stage:this.stage,snoozeCount:this.snoozeCount,dueSequence:this.dueSequence,
   nextSnoozeMinutes:SNOOZE_STEPS[Math.min(this.snoozeCount,SNOOZE_STEPS.length-1)]};
 }
}
