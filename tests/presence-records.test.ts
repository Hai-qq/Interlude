import {it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {SimpleCycle} from '../src/main/simple-cycle';import {DailyRecords} from '../src/main/daily-records';import {simpleDefaults} from '../src/shared/simple';
function run(test:(t:ReturnType<typeof fixture>)=>void){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'interlude-presence-'));try{test(fixture(dir))}finally{fs.rmSync(dir,{recursive:true})}}
function fixture(dir:string){
 let now=0,input=0;const epoch=new Date(2026,8,7,23,55).getTime(),records=new DailyRecords(dir);
 const cycle=new SimpleCycle({mono:()=>now,wall:()=>epoch+now,activity:()=>({state:'active',screenAwake:true,idleSeconds:(now-input)/1000})},{...simpleDefaults},()=>{},{use:(ms,wall)=>records.use(ms,wall),rest:wall=>records.rest(wall)});cycle.active=true;
 return {records,cycle,dir,advance(ms:number,typing=false){for(let i=0;i<ms;i+=1000){now+=1000;if(typing)input=now;cycle.tick()}},flush:()=>records.flush()};
}
it('a twenty-minute work period and sixty-minute lunch record twenty minutes, including the longest interval',()=>run(t=>{
 t.advance(20*60000,true);t.advance(60*60000);t.flush();
 expect(t.records.days.reduce((n,d)=>n+d.totalSitMs,0)).toBe(20*60000);
 expect(t.records.days.map(d=>d.longestSitMs)).toEqual([5*60000,15*60000]);
 expect(t.records.days.reduce((n,d)=>n+d.rises,0)).toBe(1);
 expect(new DailyRecords(t.dir).days).toEqual(t.records.days);
 t.advance(60000,true);expect(t.cycle.usageMs).toBe(60000);
 expect(t.records.days.reduce((n,d)=>n+d.totalSitMs,0)).toBe(21*60000);
}));
it('scrolling confirms reading across midnight; a later absence cannot erase the earlier longest sitting interval',()=>run(t=>{
 for(let i=0;i<10;i++){t.advance(179000);t.advance(1000,true)}
 expect(t.records.days.reduce((n,d)=>n+d.totalSitMs,0)).toBe(30*60000);
 t.advance(9*60000);t.flush();expect(new DailyRecords(t.dir).days.reduce((n,d)=>n+d.totalSitMs,0)).toBe(30*60000);
 t.advance(2*60000);expect(t.cycle.usageMs).toBe(0);
 t.advance(2*60000,true);t.advance(20*60000);
 expect(t.records.days.at(-1)).toMatchObject({rises:2,totalSitMs:27*60000,longestSitMs:25*60000});
}));
it('no interaction after launching does not create a workday or a phantom rise',()=>run(t=>{
 t.advance(3*3600000);t.flush();expect(t.records.days).toEqual([]);expect(t.cycle.usageMs).toBe(0);
}));
it('a rolling week includes zero-rise days and keeps counting across a Monday',()=>run(t=>{
 const wall=(day:number)=>new Date(2026,8,day,12).getTime();
 t.records.use(1000,wall(6));t.records.rest(wall(6));
 t.records.use(1000,wall(7));t.records.rest(wall(7));t.records.rest(wall(7));
 t.records.use(1000,wall(9));
 expect(t.records.summary(wall(13))).toMatchObject({days:2,averageRises:1});
 expect(t.records.summary(wall(14))).toMatchObject({days:1,averageRises:0});
}));
