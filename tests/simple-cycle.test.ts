import {it,expect} from 'vitest';import {randomUUID} from 'node:crypto';
import {SimpleCycle,isPresent,type DesktopActivity} from '../src/main/simple-cycle';import {simpleDefaults,simpleCommand} from '../src/shared/simple';
function setup(){
 let mono=0,wall=new Date(2026,8,6,9).getTime(),input=0,calls=0,credits=0;let sample:Partial<DesktopActivity>={screenAwake:true};
 const c=new SimpleCycle({mono:()=>mono,wall:()=>wall,activity:()=>({idleSeconds:(mono-input)/1000,state:'active',...sample})},{...simpleDefaults},()=>calls++,{rest:()=>credits++});c.active=true;
 return {c,get calls(){return calls},get credits(){return credits},sample(value:Partial<DesktopActivity>){sample=value},
  advance(ms:number,typing=false){while(ms>0){const dt=Math.min(1000,ms);mono+=dt;wall+=dt;if(typing)input=mono;c.tick();ms-=dt}},
  gap(ms:number,typing=false){mono+=ms;wall+=ms;if(typing)input=mono;c.tick()},wall(ms:number){wall+=ms},
  cmd(type:'start'|'return'|'snooze'|'skip'|'later'|'onboard'|'pause'|'resume'){input=mono;c.command({type,id:randomUUID()})}};
}
it('two hours of reading with a scroll every three minutes count and notify once',()=>{const t=setup();for(let i=0;i<40;i++){t.advance(179000);t.advance(1000,true)}expect(t.c.usageMs).toBe(120*60000);expect(t.c.phase).toBe('due');expect(t.calls).toBe(1);expect(t.c.stage).toBe(4)});
it('typing, passive meetings, and video each reach the same threshold',()=>{for(const [sample,typing] of [[{screenAwake:true},true],[{screenAwake:true,mediaActive:true},false],[{mediaActive:true},false]] as const){const t=setup();t.sample(sample);t.advance(30*60000,typing);expect(t.calls).toBe(1);expect(t.c.usageMs).toBe(30*60000)}});
it('without screen signals, a ten-minute input grace also accepts app switching',()=>{const t=setup();t.sample({});t.advance(599000);expect(t.c.usageMs).toBe(599000);t.advance(2000);expect(t.c.idle).toBe(true);const before=t.c.usageMs;t.sample({appSwitch:true});t.advance(1000);expect(t.c.usageMs).toBe(before+1000)});
it('screen asleep overrides media and a real absence starts a fresh cycle once',()=>{const t=setup();t.advance(20*60000,true);t.sample({screenAwake:false,mediaActive:true});t.advance(181000);expect(t.c.usageMs).toBe(0);expect(t.credits).toBe(1);t.advance(60000);expect(t.credits).toBe(1)});
it('an uninterrupted three-minute break clears use and is credited exactly once',()=>{const t=setup();t.advance(30*60000,true);t.cmd('start');t.advance(179000);expect(t.c.phase).toBe('resting');t.advance(1000);expect(t.c.snapshot()).toMatchObject({phase:'working',usageMs:0,remainingMs:30*60000,restCompletion:{id:1,reason:'completed',credited:true}});expect(t.credits).toBe(1);t.advance(5000);expect(t.credits).toBe(1)});
it('typing throughout a fake break retains usage and the original due schedule',()=>{const t=setup();t.advance(30*60000,true);t.cmd('start');t.advance(20000,true);expect(t.c.restWatchful).toBe(true);t.advance(160000,true);expect(t.c.phase).toBe('due');expect(t.c.usageMs).toBeGreaterThan(32*60000);expect(t.c.restCompletion?.credited).toBe(false);expect(t.credits).toBe(0);expect(t.calls).toBe(1)});
it('fake breaks before the deadline consume only observed input time and do not grant a new interval',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');t.advance(3*60000,true);expect(t.c.remaining).toBeLessThan(10*60000);expect(t.c.remaining).toBeGreaterThan(7*60000);expect(t.c.restCompletion?.credited).toBe(false)});
it('a short recall cannot reset the usage clock or obtain credit',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');t.advance(17000);t.cmd('return');expect(t.c.snapshot()).toMatchObject({phase:'working',usageMs:20*60000,remainingMs:10*60000,restCompletion:{reason:'early',credited:false}});expect(t.credits).toBe(0)});
it('return after enough uninterrupted quiet can be credited while still marked early',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');t.advance(150000);t.cmd('return');expect(t.c.restCompletion).toMatchObject({reason:'early',credited:true});expect(t.c.usageMs).toBe(0)});
it('scattered quiet minutes do not substitute for one continuous quiet interval',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');for(let i=0;i<3;i++){t.advance(50000);t.advance(10000,true)}expect(t.c.restCompletion?.credited).toBe(false);expect(t.credits).toBe(0)});
it('an input followed by a long quiet stretch moves the bird away and earns credit',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');t.advance(20000,true);expect(t.c.restWatchful).toBe(true);t.advance(20000);expect(t.c.restWatchful).toBe(false);t.advance(140000);expect(t.c.restCompletion?.credited).toBe(true)});
it('snooze uses 5, 8, then 12 minutes, retaining cumulative use and anxious stage',()=>{const t=setup();t.advance(30*60000,true);for(const minutes of [5,8,12,12]){const before=t.c.usageMs;t.cmd('snooze');expect(t.c.snapshot()).toMatchObject({stage:2,remainingMs:minutes*60000,usageMs:before});t.advance(minutes*60000,true);expect(t.c.phase).toBe('due')}expect(t.c.snoozeCount).toBe(4);expect(t.calls).toBe(5)});
it('a credited rest clears deferral history, while an uncredited one retains it',()=>{const t=setup();t.advance(30*60000,true);t.cmd('snooze');t.advance(5*60000,true);t.cmd('start');t.advance(3*60000,true);expect(t.c.snoozeCount).toBe(1);t.cmd('start');t.advance(3*60000);expect(t.c.snoozeCount).toBe(0);expect(t.c.stage).toBe(0)});
it('all four pre-departure stages appear in order and never regress within a round',()=>{const t=setup(),seen:number[]=[0];for(let i=0;i<1800;i++){t.advance(1000,true);if(seen.at(-1)!==t.c.stage)seen.push(t.c.stage)}expect(seen).toEqual([0,1,2,3,4]);t.c.command({type:'settings',id:randomUUID(),settings:{...simpleDefaults,workMinutes:60}});t.advance(1000);expect(t.c.stage).toBe(4)});
it('a threshold change progresses through intervening stages instead of jumping',()=>{const t=setup();t.advance(11*60000,true);expect(t.c.stage).toBe(0);t.c.command({type:'settings',id:randomUUID(),settings:{...simpleDefaults,workMinutes:15}});t.advance(1000);expect(t.c.stage).toBe(1);t.advance(2000);expect(t.c.stage).toBe(2)});
it('duplicate start and return commands neither extend rest nor duplicate completion',()=>{const t=setup();t.advance(60000);const start={type:'start' as const,id:randomUUID()};t.c.command(start);const end=t.c.restEnd;t.advance(10000);t.c.command(start);t.cmd('start');expect(t.c.restEnd).toBe(end);t.cmd('return');const done=t.c.restCompletion;t.cmd('return');expect(t.c.restCompletion).toEqual(done)});
it('a duplicate snooze or another snooze during work does not postpone twice',()=>{const t=setup();t.advance(30*60000,true);const command={type:'snooze' as const,id:randomUUID()};t.c.command(command);t.advance(60000);t.c.command(command);t.cmd('snooze');expect(t.c.remaining).toBe(240000);expect(t.c.snoozeCount).toBe(1)});
it('pause preserves progress, has no repeat notification, and does not extend a rest',()=>{const t=setup();t.advance(60000);t.cmd('pause');t.advance(30*60000,true);expect(t.c.usageMs).toBe(60000);t.cmd('resume');t.advance(29*60000,true);expect(t.calls).toBe(1);t.cmd('pause');t.cmd('resume');t.advance(5000);expect(t.calls).toBe(1);t.cmd('start');t.cmd('pause');t.advance(3*60000);expect(t.c.restCompletion?.credited).toBe(true)});
it('nested lock/sleep blocks exclude use and count a single inferred break on return',()=>{const t=setup();t.advance(20*60000,true);t.c.block('lock',true);t.c.block('sleep',true);t.advance(10*60000);t.c.block('sleep',false);expect(t.c.usageMs).toBe(20*60000);t.c.block('lock',false);expect(t.c.usageMs).toBe(0);expect(t.credits).toBe(1);expect(t.calls).toBe(0)});
it('a known sleep can complete a rest even when monotonic time was suspended',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');t.c.block('sleep',true);t.wall(10*60000);t.c.block('sleep',false);expect(t.c.restCompletion).toMatchObject({reason:'completed',credited:true});expect(t.c.phase).toBe('working')});
it('wall-clock changes do not affect ordinary timers and unexplained stalls do not count as use',()=>{const t=setup();t.advance(30000,true);t.wall(3600000);t.advance(1000,true);expect(t.c.usageMs).toBe(31000);t.gap(600000,true);expect(t.c.usageMs).toBe(31000)});
it('changing settings preserves elapsed work and both ongoing rest and snooze deadlines',()=>{const t=setup();t.advance(20*60000,true);t.c.command({type:'settings',id:randomUUID(),settings:{...simpleDefaults,workMinutes:40}});expect(t.c.remaining).toBe(20*60000);t.advance(20*60000,true);t.cmd('snooze');t.c.command({type:'settings',id:randomUUID(),settings:{...simpleDefaults,workMinutes:45}});expect(t.c.remaining).toBe(5*60000);t.cmd('start');const end=t.c.restEnd;t.c.command({type:'settings',id:randomUUID(),settings:{...simpleDefaults,restMinutes:5}});expect(t.c.restEnd).toBe(end)});
it('no onboarding means no accumulation, history credit or due event',()=>{const t=setup();t.c.active=false;t.advance(2*3600000);expect(t.c.usageMs).toBe(0);expect(t.calls).toBe(0);t.cmd('onboard');t.advance(1000);expect(t.c.usageMs).toBe(1000)});
it('unknown input measurements cannot certify a break',()=>{const t=setup();t.advance(20*60000,true);t.cmd('start');t.sample({state:'unknown',screenAwake:true});t.advance(3*60000);expect(t.c.restCompletion?.credited).toBe(false)});
it('commands and settings remain strictly validated, with 40 minutes supported',()=>{expect(simpleCommand.safeParse({type:'settings',id:randomUUID(),settings:{...simpleDefaults,workMinutes:40}}).success).toBe(true);expect(simpleCommand.safeParse({type:'settings',id:randomUUID(),settings:{...simpleDefaults,workMinutes:0}}).success).toBe(false);expect(simpleCommand.safeParse({type:'mute',id:randomUUID()}).success).toBe(false)});

const truthTable:[string,DesktopActivity,boolean][]=[
 ['typing',{state:'active',screenAwake:true,idleSeconds:0},true],
 ['passive meeting / video',{state:'idle',screenAwake:true,idleSeconds:7200,mediaActive:true},true],
 ['reading with a scroll every three minutes',{state:'idle',screenAwake:true,idleSeconds:170},true],
 ['lunch for forty minutes',{state:'idle',screenAwake:true,idleSeconds:2400},false],
 ['walking for twenty minutes',{state:'idle',screenAwake:true,idleSeconds:1200},false],
 ['away for three hours',{state:'idle',screenAwake:true,idleSeconds:10800},false],
 ['locked',{state:'locked',screenAwake:true,idleSeconds:0,mediaActive:true,appSwitch:true},false],
 ['display asleep',{state:'active',screenAwake:false,idleSeconds:0,mediaActive:true,appSwitch:true},false]
];
it.each(truthTable)('presence truth table: %s',(_name,sample,expected)=>expect(isPresent(sample)).toBe(expected));
it('presence boundary, unavailable input and app switching are handled explicitly',()=>{
 expect(isPresent({state:'idle',screenAwake:true,idleSeconds:599.999})).toBe(true);
 expect(isPresent({state:'idle',screenAwake:true,idleSeconds:600})).toBe(false);
 expect(isPresent({state:'unknown',screenAwake:true,idleSeconds:0})).toBe(false);
 for(const idleSeconds of [NaN,Infinity])expect(isPresent({state:'active',screenAwake:true,idleSeconds})).toBe(false);
 expect(isPresent({state:'idle',idleSeconds:7200,appSwitch:true})).toBe(true);
});
it.each([20,40,180])('twenty-five minutes of work then %i minutes away credits once and restarts on return',minutes=>{
 const t=setup();t.advance(25*60000,true);t.advance(minutes*60000);
 expect(t.c.usageMs).toBe(0);expect(t.credits).toBe(1);expect(t.c.snoozeCount).toBe(0);
 const calls=t.calls;t.advance(60000,true);expect(t.c.usageMs).toBe(60000);expect(t.calls).toBe(calls);
});
it('twenty minutes working then lunch neither rings at thirty minutes nor burns backoff',()=>{
 const t=setup();t.advance(20*60000,true);t.advance(60*60000);
 expect(t.c.snapshot()).toMatchObject({usageMs:0,stage:0,snoozeCount:0,away:true});expect(t.calls).toBe(0);expect(t.credits).toBe(1);
});
it('media ending after a long meeting starts absence from media end, not the last keystroke',()=>{
 const t=setup();t.sample({screenAwake:true,mediaActive:true});t.advance(2*3600000);
 t.sample({screenAwake:true});t.advance(179000);expect(t.credits).toBe(0);
 t.advance(1000);expect(t.credits).toBe(1);expect(t.c.usageMs).toBe(0);
});
it('unknown samples cannot award an inferred natural break',()=>{
 const t=setup();t.advance(20*60000,true);t.sample({state:'unknown',screenAwake:true});t.advance(60*60000);
 expect(t.credits).toBe(0);expect(t.c.usageMs).toBe(20*60000);expect(t.calls).toBe(0);
});
