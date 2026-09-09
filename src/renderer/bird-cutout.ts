/** Remove only connected exterior paper from a complete drawing at render time.
 * The dark drawing shares its silhouette with the corresponding light source.
 * No pixels in the source atlases are changed and no anatomy is composited.
 */
export function paperCutout(light:HTMLCanvasElement,color:HTMLCanvasElement):HTMLCanvasElement{
 const width=light.width,height=light.height,mask=light.getContext('2d')!.getImageData(0,0,width,height).data;
 const ctx=color.getContext('2d')!,pixels=ctx.getImageData(0,0,width,height),outside=new Uint8Array(width*height),queue=new Int32Array(width*height);let read=0,write=0;
 const visit=(index:number)=>{if(outside[index])return;const i=index*4;if((mask[i]+mask[i+1]+mask[i+2])/3<238)return;outside[index]=1;queue[write++]=index};
 for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x)}
 for(let y=1;y<height-1;y++){visit(y*width);visit(y*width+width-1)}
 while(read<write){const p=queue[read++],x=p%width,y=Math.floor(p/width);if(x>0)visit(p-1);if(x<width-1)visit(p+1);if(y>0)visit(p-width);if(y<height-1)visit(p+width)}
 for(let p=0;p<outside.length;p++)if(outside[p])pixels.data[p*4+3]=0;
 ctx.putImageData(pixels,0,0);return color;
}
