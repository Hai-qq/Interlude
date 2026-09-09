import {forwardRef,useImperativeHandle,useRef,useState} from 'react';
import type {BirdHandle} from '../shared/bird';
import {BIRD_NAME,type BirdMotion} from '../shared/bird';
import {GraphiteBird,type BirdMood} from './graphite-bird';

export const BirdScene=forwardRef<BirdHandle,{theme:string;resting?:boolean;motion?:BirdMotion|null;small?:boolean;decorative?:boolean;disabled?:boolean;disabledReason?:string;mood?:BirdMood;start?:()=>Promise<boolean|void>;recall?:()=>Promise<boolean>}>(({theme,resting=false,small=false,decorative=false,disabled=false,disabledReason,mood='idle',start,recall},ref)=>{
 const pending=useRef(false),[busy,setBusy]=useState(false);
 const launch=async()=>{if(pending.current||resting||disabled||decorative)return;pending.current=true;setBusy(true);try{await start?.()}finally{pending.current=false;setBusy(false)}};
 const finish=async()=>{if(pending.current||!resting)return;pending.current=true;setBusy(true);try{await recall?.()}finally{pending.current=false;setBusy(false)}};
 useImperativeHandle(ref,()=>({release:()=>{void launch().catch(()=>{})}}));
 return <div className={`graphite-scene${small?' graphite-scene-small':''}`}>
  <button className="graphite-bird-button paper-bird" data-pose="perched" aria-label={`和${BIRD_NAME}一起出发，开始休息`} title={disabled?disabledReason:`和${BIRD_NAME}一起去休息`} disabled={decorative||disabled||resting||busy} onClick={()=>{void launch().catch(()=>{})}}>
   <GraphiteBird theme={theme} mood={resting?'rest':mood}/>
  </button>
  {resting&&recall&&<button className="text-button graphite-recall" aria-label={`召回${BIRD_NAME}，提前结束休息`} disabled={busy} onClick={()=>{void finish().catch(()=>{})}}>提前结束</button>}
 </div>;
});
