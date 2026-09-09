import {useEffect,useRef,useState} from 'react';
import atlasUrl from '../../assets/editorial/digits-handdrawn-white.png';

type Glyph={canvas:HTMLCanvasElement;width:number};
let atlas:Promise<Map<string,Glyph>>|undefined;
function glyphs(){
 if(!atlas)atlas=(async()=>{
  const image=new Image();image.src=atlasUrl;await image.decode();
  const source=document.createElement('canvas');source.width=image.width;source.height=image.height;
  const ctx=source.getContext('2d')!;ctx.drawImage(image,0,0);
  const cellW=image.width/6,cellH=image.height/2,result=new Map<string,Glyph>();
  for(const [index,char] of [...'0123456789:'].entries()){
   const pixels=ctx.getImageData(Math.round(index%6*cellW),Math.floor(index/6)*cellH,cellW,cellH);
   let x0=cellW,y0=cellH,x1=0,y1=0;
   for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++){
    const i=(y*cellW+x)*4,light=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;
    if(light<170&&pixels.data[i+3]>128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
   }
   if(x1<=x0||y1<=y0)throw Error(`Missing drawn digit ${char}`);
   const canvas=document.createElement('canvas');canvas.width=x1-x0+1;canvas.height=y1-y0+1;
   const cropped=ctx.getImageData(Math.round(index%6*cellW)+x0,Math.floor(index/6)*cellH+y0,canvas.width,canvas.height);
   // Source drawing stays intact on disk. At display time, turn white paper into alpha.
   for(let i=0;i<cropped.data.length;i+=4){const light=(cropped.data[i]+cropped.data[i+1]+cropped.data[i+2])/3;cropped.data[i]=52;cropped.data[i+1]=52;cropped.data[i+2]=48;cropped.data[i+3]=Math.round(Math.min(1,Math.max(0,(250-light)/202))*255)}
   canvas.getContext('2d')!.putImageData(cropped,0,0);result.set(char,{canvas,width:canvas.width/canvas.height});
  }
  return result;
 })();
 return atlas;
}
/** Compose the actual clock value from original, individually drawn glyphs. */
export function HandDrawnNumber({value}:{value:string}){
 const ref=useRef<HTMLCanvasElement>(null),[ready,setReady]=useState(false);
 useEffect(()=>{let disposed=false;void glyphs().then(map=>{
  if(disposed)return;
  const h=480,gap=value.includes(':')?22:4,items=[...value].map(char=>({char,glyph:map.get(char)!}));
  const widths=items.map(({char,glyph})=>char===':'?h*.16:glyph.width*h);
  const canvas=ref.current!;canvas.width=Math.ceil(widths.reduce((a,b)=>a+b,0)+gap*(items.length-1));canvas.height=h;
  const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';let x=0;
  items.forEach(({char,glyph},i)=>{const glyphH=char===':'?h*.5:h;ctx.drawImage(glyph.canvas,x,(h-glyphH)/2,widths[i],glyphH);x+=widths[i]+gap});
  canvas.style.aspectRatio=`${canvas.width}/${canvas.height}`;canvas.dataset.glyphs=value;setReady(true);
 }).catch(()=>setReady(false));return()=>{disposed=true}},[value]);
 return <><canvas ref={ref} className="hand-drawn-number" aria-hidden="true" hidden={!ready}/><span className={ready?'number-accessible':'number-fallback'}>{value}</span></>;
}
