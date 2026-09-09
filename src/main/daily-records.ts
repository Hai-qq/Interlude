import fs from 'node:fs';import path from 'node:path';import {z} from 'zod';import {atomicJSON} from './simple-store';
const daySchema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),rises:z.number().int().min(0),longestSitMs:z.number().min(0),totalSitMs:z.number().min(0)}).strict();
const recordsSchema=z.object({schemaVersion:z.literal(1),days:z.array(daySchema)}).strict();
export type DailyRecord=z.infer<typeof daySchema>;
export const localDate=(wall:number)=>{const d=new Date(wall);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export class DailyRecords {
 days:DailyRecord[]=[];dirty=false;warning='';private sessionDay='';private dayContinuous=0;
 constructor(private dir:string){
  const file=this.file;
  if(fs.existsSync(file))try{this.days=recordsSchema.parse(JSON.parse(fs.readFileSync(file,'utf8'))).days}
  catch{fs.renameSync(file,file+'.backup-'+Date.now());this.warning='本地记录无法读取，原文件已备份。'}
 }
 private get file(){return path.join(this.dir,'daily-records.json')}
 private day(wall:number){
  const date=localDate(wall);let day=this.days.find(d=>d.date===date);
  if(!day){day={date,rises:0,longestSitMs:0,totalSitMs:0};this.days.push(day);this.days.sort((a,b)=>a.date.localeCompare(b.date));this.dirty=true}
  return day;
 }
 use(ms:number,wall:number){
  if(ms<=0||ms>15000)return;
  // Split a real sampling interval at local midnight; DST days need not be 24 hours.
  let start=wall-ms;
  while(start<wall){
   const d=new Date(start),midnight=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime(),end=Math.min(wall,midnight),part=end-start;
   const day=this.day(start);
   if(this.sessionDay!==day.date){this.sessionDay=day.date;this.dayContinuous=0}
   this.dayContinuous+=part;day.totalSitMs+=part;day.longestSitMs=Math.max(day.longestSitMs,this.dayContinuous);this.dirty=true;start=end;
  }
 }
 rest(wall:number){this.day(wall).rises++;this.dayContinuous=0;this.dirty=true;this.flush()}
 flush(){if(this.dirty){atomicJSON(this.file,{schemaVersion:1,days:this.days});this.dirty=false}}
 summary(wall:number){
  // A rolling week, so the only long-term feedback never resets to zero on a Monday morning.
  const today=new Date(wall),start=new Date(today.getFullYear(),today.getMonth(),today.getDate()-6);
  const from=localDate(start.getTime()),until=localDate(wall),week=this.days.filter(d=>d.date>=from&&d.date<=until);
  const measured=week.length;
  return {averageRises:measured?Math.round(week.reduce((n,d)=>n+d.rises,0)/measured*10)/10:0,
   longestSitMinutes:Math.floor(Math.max(0,...week.map(d=>d.longestSitMs))/60000),days:measured};
 }
}
