import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';import path from 'node:path';
export type EnvironmentSignals={screenAwake?:boolean;mediaActive?:boolean;appSwitch?:boolean;captureActive:boolean;fullscreenQuiet:boolean;reducedMotion:boolean};
export class DesktopEnvironment {
 value:EnvironmentSignals={captureActive:false,fullscreenQuiet:false,reducedMotion:false};
 private child:ChildProcessWithoutNullStreams|null=null;private closed=false;private retry:NodeJS.Timeout|undefined;
 constructor(private changed:()=>void){}
 start(){
  if(process.platform!=='darwin'||this.closed)return;
  const binary=path.join(__dirname,'native/environment').replace('app.asar/','app.asar.unpacked/');
  const child=spawn(binary,[],{stdio:['pipe','pipe','pipe']});this.child=child;let buffer='';
  child.stdout.on('data',chunk=>{
   buffer+=chunk.toString();if(buffer.length>16384){buffer='';return}
   let newline:number;while((newline=buffer.indexOf('\n'))!==-1){
    const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
    try{
     const object=JSON.parse(line),keys=['screenAwake','mediaActive','appSwitch','captureActive','fullscreenQuiet','reducedMotion'];
     if(!keys.every(k=>typeof object[k]==='boolean'))continue;
     this.value=Object.fromEntries(keys.map(k=>[k,object[k]])) as EnvironmentSignals;this.changed();
    }catch{/* Invalid helper output cannot affect app state. */}
   }
  });
  // The helper emits only booleans. Do not forward diagnostic or platform data to logs.
  child.stderr.resume();child.on('error',()=>{});
  child.once('close',()=>{
   if(this.child!==child)return;this.child=null;
   // Keep capture suppression if detection goes away during an active capture.
   this.value={captureActive:this.value.captureActive,fullscreenQuiet:false,reducedMotion:this.value.reducedMotion};this.changed();
   if(!this.closed)this.retry=setTimeout(()=>this.start(),10000);
  });
 }
 stop(){this.closed=true;clearTimeout(this.retry);this.child?.kill();this.child=null}
}
