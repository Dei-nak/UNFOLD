const motions=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const attributes=(node,values)=>{
 for(const [name,value] of Object.entries(values))node.setAttribute(name,value);
};

function stopLiquid(indicator){
 const motion=motions.get(indicator);
 if(motion){
  cancelAnimationFrame(motion.frame);
  motion.layer.remove();
  motions.delete(indicator);
 }
 indicator.classList.remove('is-liquid');
 indicator.style.transform='';
}

function moveLiquid(group,indicator,from,to){
 const origin=group.getBoundingClientRect();
 const dx=to.left+to.width/2-from.left-from.width/2;
 const dy=to.top+to.height/2-from.top-from.height/2;
 const horizontal=Math.abs(dx)>Math.abs(dy);
 const direction=Math.sign(horizontal?dx:dy);
 const initialExtent=horizontal?from.width:from.height;
 const finalExtent=horizontal?to.width:to.height;
 const ns='http://www.w3.org/2000/svg';
 const layer=document.createElementNS(ns,'svg');
 layer.setAttribute('class','liquid-layer');
 layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<g filter="url(#unfold-goo)"><rect/><circle/><circle/><circle/></g>';
 const [capsule,...drops]=layer.firstElementChild.children;
 const motion={layer,frame:0};
 motions.set(indicator,motion);
 group.prepend(layer);
 indicator.classList.add('is-liquid');
 const start=performance.now(), duration=560;
 const tick=now=>{
  if(!indicator.isConnected){stopLiquid(indicator);return;}
  const phase=clamp((now-start)/duration);
  const travel=smooth((phase-.12)/.76);
  const stretch=.20*Math.sin(Math.PI*clamp(phase/.29));
  const split=.41*Math.sin(Math.PI*clamp((phase-.20)/.65));
  const width=mix(from.width,to.width,travel)*(horizontal?1+stretch-split:1);
  const height=mix(from.height,to.height,travel)*(horizontal?1:1+stretch-split);
  const x=mix(from.left+from.width/2,to.left+to.width/2,travel)+(horizontal?direction*stretch*initialExtent/2:0)-width/2;
  const y=mix(from.top+from.height/2,to.top+to.height/2,travel)+(horizontal?0:direction*stretch*initialExtent/2)-height/2;
  attributes(capsule,{x:x-origin.left,y:y-origin.top,width,height,rx:Math.min(width,height)/2});
  indicator.style.transform=`translate(${x-to.left+(width-to.width)/2}px,${y-to.top+(height-to.height)/2}px) scale(${width/to.width},${height/to.height})`;
  drops.forEach((drop,i)=>{
   const flight=clamp((phase-.16-i*.048)/(.61-i*.032));
   const t=smooth(flight), arc=Math.sin(Math.PI*flight);
   const along=direction*mix(initialExtent*(.44-i*.08),-finalExtent*(.30-i*.10),t);
   const cross=[-15,17,-24][i]*arc;
   const separation=smooth((flight-.13)/.26)*smooth((.91-flight)/.25);
   const leadingX=x+width/2+direction*(width/2+13+i*4);
   const leadingY=y+height/2+direction*(height/2+13+i*4);
   const pathX=mix(from.left+from.width/2,to.left+to.width/2,t);
   const pathY=mix(from.top+from.height/2,to.top+to.height/2,t);
   attributes(drop,{
    cx:(horizontal?mix(pathX+along,leadingX,separation):pathX+cross)-origin.left,
    cy:(horizontal?pathY+cross:mix(pathY+along,leadingY,separation))-origin.top,
    r:0.01+(6.6-i*.65)*Math.sin(Math.PI*flight)**.38
   });
  });
  if(phase===1)stopLiquid(indicator);
  else motion.frame=requestAnimationFrame(tick);
 };
 tick(start);
}

export {moveLiquid,stopLiquid};
