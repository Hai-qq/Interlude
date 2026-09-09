import {useEffect,useRef} from 'react';
import {paperCutout} from './bird-cutout';
import metadata from '../../assets/graphite-bird/registration.json';
export type BirdMood='idle'|'attentive'|'near'|'due'|'rest'|'still';
type Clip='idle'|'attentive'|'greeting';
const art=import.meta.glob('../../assets/graphite-bird/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const clips={idle:{frames:Array.from({length:16},(_,i)=>i),fps:16,rest:0},attentive:{frames:[0,1,2,3,4,5,6,7,7,7,6,5,4,3,2,1,0],fps:16,rest:5000},greeting:{frames:[0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1,0],fps:18,rest:4200}};
const choose=(mood:BirdMood):Clip=>mood==='due'?'greeting':mood==='attentive'||mood==='near'?'attentive':'idle';
const cache=new Map<string,Promise<HTMLImageElement>>();
function load(theme:string,clip:Clip){const key=`${clip}-${theme==='dark'?'dark':'light'}`;if(!cache.has(key)){const image=new Image();image.src=art[`../../assets/graphite-bird/${key}.png`];cache.set(key,image.decode().then(()=>image))}return cache.get(key)!}
/** Direct playback of the approved complete drawings, including their measured atlas registration. */
export function GraphiteBird({theme,mood}:{theme:string;mood:BirdMood}){
 const canvas=useRef<HTMLCanvasElement>(null),current=useRef(mood);current.current=mood;
 useEffect(()=>{
  const element=canvas.current!,ctx=element.getContext('2d')!;let disposed=false,request=0,epoch=0,last='',clip=choose(current.current),visible=!document.hidden;
  const media=matchMedia('(prefers-reduced-motion: reduce)');let frames:Record<Clip,Map<number,HTMLCanvasElement>>|null=null;
  element.dataset.art='loading';ctx.clearRect(0,0,448,448);
  const draw=(name:Clip,frame:number)=>{
   if(!frames||last===`${name}:${frame}`)return;
   const image=frames[name].get(frame)!,entry=metadata[name].frames[frame] as {baseline:number;offsetX?:number};
   const size=448*.9;ctx.clearRect(0,0,448,448);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(image,448*.05+(entry.offsetX??0)*size,448*.825-entry.baseline*size,size,size);
   element.dataset.clip=name;element.dataset.frame=String(frame);last=`${name}:${frame}`;
  };
  const tick=(now:number)=>{
   request=0;
   if(disposed||!visible||document.hidden||!frames)return;
   const state=current.current;
   if(media.matches||state==='still'){draw('idle',0);epoch=now;clip=choose(state);return}
   const action=clips[clip],speed=state==='rest'?.65:1,length=action.frames.length/action.fps*1000/speed,elapsed=Math.max(0,now-epoch),hold=clip==='idle'?0:state==='near'?2200:action.rest;
   if(elapsed>=length+hold){clip=choose(state);epoch=now;draw(clip,0)}
   else if(elapsed>=length){draw(clip,0);if(choose(state)!==clip){clip=choose(state);epoch=now}}
   else draw(clip,action.frames[Math.min(action.frames.length-1,Math.floor(elapsed*action.fps*speed/1000))]);
   request=requestAnimationFrame(tick);
  };
  const resume=()=>{cancelAnimationFrame(request);epoch=performance.now();last='';tick(epoch)};
  const changed=()=>{visible=!document.hidden;resume()};
  const unsubscribe=window.interlude.onVisibility(shown=>{visible=shown;resume()});
  document.addEventListener('visibilitychange',changed);media.addEventListener('change',resume);
  // Mood changes wake a paused canvas without reloading art or restarting active clips.
  const wake=()=>{if(!request||media.matches||current.current==='still')resume()};
  element.addEventListener('bird-mood-change',wake);
  Promise.all((Object.keys(clips) as Clip[]).map(async name=>{
   const [light,color]=await Promise.all([load('light',name),load(theme,name)]),prepared=new Map<number,HTMLCanvasElement>();
   for(const frame of new Set(clips[name].frames)){
    const entry=metadata[name].frames[frame] as {source?:{x:number;y:number;width:number;height:number}},cell=light.naturalWidth/4;
    const src=entry.source??{x:frame%4*cell,y:Math.floor(frame/4)*cell,width:cell,height:cell};
    const crop=(image:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=Math.round(src.width);c.height=Math.round(src.height);c.getContext('2d')!.drawImage(image,src.x,src.y,src.width,src.height,0,0,c.width,c.height);return c};
    prepared.set(frame,paperCutout(crop(light),crop(color)));
   }
   return [name,prepared] as const;
  })).then(entries=>{if(disposed)return;frames=Object.fromEntries(entries) as Record<Clip,Map<number,HTMLCanvasElement>>;element.dataset.art='ready';resume()}).catch(error=>{if(!disposed){element.dataset.art='error';console.error('Bird art failed to load',error)}});
  return()=>{disposed=true;cancelAnimationFrame(request);unsubscribe();document.removeEventListener('visibilitychange',changed);media.removeEventListener('change',resume);element.removeEventListener('bird-mood-change',wake)};
 },[theme]);
 useEffect(()=>{canvas.current?.dispatchEvent(new Event('bird-mood-change'))},[mood]);
 return <canvas ref={canvas} className="graphite-bird" width="448" height="448" role="img" aria-label="石墨胖雀" data-mood={mood}/>;
}
