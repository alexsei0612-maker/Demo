'use strict';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const hero = document.querySelector('.hero');
const hit = document.querySelector('.hit');
const logo = new Image();
logo.src = document.querySelector('#brand-art').src;
const status = document.querySelector('#status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const tau = Math.PI * 2;
const faces = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]];
const vertices = [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]];
let seed = 641;
function rand() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

const snow = Array.from({length:170}, () => [rand(),rand(),rand(),rand()]);
const frost = Array.from({length:260}, () => {
  const edge = Math.floor(rand()*4), along = rand(), inset = rand()**3*.32;
  return [[along,inset],[1-inset,along],[along,1-inset],[inset,along]][edge].concat(rand(),rand());
});
const shards = Array.from({length:95}, () => [rand()*tau,rand(),rand(),rand(),rand()]);
const rayAngles = Array.from({length:24}, () => [rand()*tau,rand(),rand()]);
const festive = [[.15,.25,.91],[.83,.23,.67],[.09,.53,.74],[.91,.54,1],
  [.22,.78,.69],[.77,.79,.85],[.12,.87,.52],[.89,.88,.55]];
const goldGlints = [[.11,.37,1],[.85,.31,.6],[.91,.43,.78],[.13,.67,.68],[.87,.72,.83],[.35,.84,.55]];
const fracture = Array.from({length:3}, (_, stage) => {
  const x = [.48,.69,.28][stage], y = [.49,.28,.65][stage];
  return Array.from({length:3+stage}, (_, index) => {
    const a = index*tau/(3+stage) + rand()*.7 + stage*.52;
    const points = [[x,y]];
    for(let step=1;step<=8;step++) {
      const r = step*.073;
      points.push([x+Math.cos(a)*r+(rand()-.5)*.043,y+Math.sin(a)*r+(rand()-.5)*.043]);
    }
    const p = points[3], q = points[5];
    return [points,[p,[p[0]+Math.cos(a+.73)*.12,p[1]+Math.sin(a+.73)*.12],
      [p[0]+Math.cos(a+.83)*.24,p[1]+Math.sin(a+.83)*.24]],
      [q,[q[0]+Math.cos(a-.56)*.19,q[1]+Math.sin(a-.56)*.19]]];
  }).flat();
});

const texture = document.createElement('canvas');
texture.width = texture.height = 320;
const tex = texture.getContext('2d');
const pixels = tex.createImageData(320,320);
const lattice = Float32Array.from({length:4096}, rand);
function noise(x,y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let u = x-ix, v = y-iy;
  u = u*u*(3-2*u); v = v*v*(3-2*v);
  const at = (a,b) => lattice[(a&63)+64*(b&63)];
  return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
}
for(let y=0;y<320;y++) for(let x=0;x<320;x++) {
  const u=(x-159.5)/157, v=(y-159.5)/157, r=u*u+v*v;
  if(r>1) continue;
  const z=Math.sqrt(1-r), a=Math.atan2(u,z)*18+24, b=Math.asin(v)*18+24;
  const flow=noise(a*.22,b*.22), grain=noise(a*3+b*.24,b*3+flow*6);
  const cells=noise(a+flow*3,b+flow*4);
  const brightness=Math.min(1,.17+cells*.45+grain*.22+flow*.28+z*.12);
  const filament=Math.pow(Math.abs(Math.sin((cells+grain*.24)*14)),13)*.15;
  const i=(y*320+x)*4;
  pixels.data.set([255,55+(brightness+filament)*179,5+Math.pow(brightness+filament,3)*152,Math.min(255,z*1950)],i);
}
tex.putImageData(pixels,0,0);
const ice=createIce(texture);
logo.addEventListener('load',()=>ice?.setLogo(logo),{once:true});
const sky=document.createElement('canvas');
sky.width=400;sky.height=240;
const skyContext=sky.getContext('2d');
const clouds=skyContext.createImageData(sky.width,sky.height);
for(let y=0;y<sky.height;y++) for(let x=0;x<sky.width;x++) {
  const u=x/sky.width, v=y/sky.height;
  const flow=noise(u*4,v*5);
  const band=noise(u*7,v*19+flow*3)*.56+noise(u*18,v*35)*.29+noise(u*34,v*72)*.15;
  const haze=Math.exp(-((v-.68+.13*Math.sin(u*5))**2)*7);
  const light=Math.max(0,band-.27)*haze;
  clouds.data.set([47+light*66,111+light*119,168+light*95,Math.min(160,light*285)],(y*sky.width+x)*4);
}
skyContext.putImageData(clouds,0,0);
// Bake the snow once. Short, wind-combed ridges gain definition nearer the camera.
const snowfield=document.createElement('canvas');
snowfield.width=720;
snowfield.height=210;
const ground=snowfield.getContext('2d');
const grains=ground.createImageData(snowfield.width,snowfield.height);
for(let row=0;row<snowfield.height;row++) {
  const v=row/(snowfield.height-1);
  for(let col=0;col<snowfield.width;col++) {
    const u=col/(snowfield.width-1);
    const drift=noise(u*4+8,v*3+7);
    const ripple=noise(u*15+3,v*48+drift*11);
    const flank=noise(u*15+3,v*48+drift*11+.14)-ripple;
    const fine=noise(u*180,v*185);
    const pool=Math.exp(-((u-.5)**2)*15-v*2.9);
    const diffuse=.34+drift*.44+flank*.88+fine*.12;
    const shimmer=Math.pow(fine,17)*160;
    const haze=Math.max(0,Math.min(1,(v-.045-drift*.125)*6));
    grains.data.set([
      19+diffuse*56+pool*80+shimmer,
      18+diffuse*50+pool*36+shimmer*.91,
      26+diffuse*55+pool*12+shimmer*.83,
      haze*(138+pool*66)*(1-v*.42)
    ],(row*snowfield.width+col)*4);
  }
}
ground.putImageData(grains,0,0);

let width,height,cx,cy,scale,count=0,lastHit=-10;
let orbit=.55,tilt=.31,previousFrame=0;
let yawSpeed=0,pitchSpeed=0,gesture=null,skipClick=false;
const pickaxe=document.querySelector('.pickaxe');
const tool=pickaxe.getContext('2d');
tool.scale(2,2);
function toolShape(outline,colors) {
  const shape=new Path2D(outline);
  const finish=tool.createLinearGradient(14,6,35,43);
  colors.forEach((color,index)=>finish.addColorStop(index/(colors.length-1),color));
  tool.fillStyle=finish;
  tool.fill(shape);
  tool.lineWidth=1.2;
  tool.strokeStyle='#3d272b';
  tool.stroke(shape);
}
toolShape('M19 17 Q18 15 23 12 L57 52 Q60 57 54 59 Z',['#ffca68','#bb6937','#79402a']);
toolShape('M44 44 L49 40 L59 53 Q61 57 54 60 Z',['#273743','#64504a','#243340']);
toolShape('M2 36 Q6 17 19 10 L24 7 Q39 2 53 7 Q37 9 27 17 L22 19 Q12 22 2 36 Z',['#efffff','#85cae0','#406584','#d5f3ff']);
toolShape('M18 12 L24 7 L31 15 L24 21 Z',['#ffde76','#d28b29','#fff2ab']);
tool.strokeStyle='#f3ffff';
tool.beginPath();
tool.moveTo(5,29);tool.quadraticCurveTo(12,15,19,13);tool.stroke();
let swing;
function equipPickaxe(event) {
  if(event.pointerType!=='mouse'||count===4) return;
  const bounds=hero.getBoundingClientRect();
  pickaxe.style.left=(event.clientX-bounds.left-2)+'px';
  pickaxe.style.top=(event.clientY-bounds.top-36)+'px';
  pickaxe.hidden=false;
  hit.classList.add('armed');
}
function putAwayPickaxe() {
  swing?.cancel();
  pickaxe.hidden=true;
  hit.classList.remove('armed');
}
hit.addEventListener('pointerenter',equipPickaxe);
hit.addEventListener('pointermove',equipPickaxe);
hit.addEventListener('pointerleave',putAwayPickaxe);
hit.addEventListener('pointercancel',putAwayPickaxe);
function swingPickaxe() {
  if(pickaxe.hidden) return;
  swing?.cancel();
  if(!reduced.matches) swing=pickaxe.animate([
    {transform:'rotate(0deg)'},
    {transform:'rotate(32deg)',offset:.32},
    {transform:'rotate(0deg)',offset:.58},
    {transform:'rotate(-5deg)',offset:.72},
    {transform:'rotate(0deg)'}
  ],{duration:230,easing:'ease-out'});
}
pickaxe.style.transformOrigin='54px 56px';
const start=performance.now();
const now = () => (performance.now()-start)/1000;
function resize() {
  const bounds=hero.getBoundingClientRect(), box=hit.getBoundingClientRect();
  width=bounds.width; height=hero.clientHeight;
  cx=box.left-bounds.left+box.width/2;
  cy=box.top-bounds.top+box.height*.56;
  scale=width*.175;
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe(hero);
resize();

function activate() {
  if(count===4) {
    count=0;
    lastHit=-10;
    hit.setAttribute('aria-label','Golpear el cubo de hielo de Solcasino');
    status.textContent='Toca el cubo cuatro veces para liberar el sol.';
    return;
  }
  count++;
  lastHit=now();
  void iceSound.hit(count);
  const messages=[
    'Primer golpe. Quedan tres.',
    'Segundo golpe. Quedan dos.',
    'Solo queda un golpe.',
    'Has liberado el sol. Tócalo para volver a empezar.'
  ];
  status.textContent=messages[count-1];
  if(count===4) {
    hit.setAttribute('aria-label','Volver a empezar');
    putAwayPickaxe();
  }
}
hit.addEventListener('click',event=>{
  if(event.detail && skipClick) return;
  if(count<4 && event.detail) swingPickaxe();
  activate();
});
hit.addEventListener('pointerdown',event=>{
  if(event.button!==0 || !event.isPrimary || gesture) return;
  skipClick=false;
  if(count===4) return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp,dragged:false};
  yawSpeed=pitchSpeed=0;
  hit.setPointerCapture(event.pointerId);
});
function trackDrag(event) {
  if(!gesture || gesture.id!==event.pointerId) return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!dx && !dy) return;
  if(!gesture.dragged && Math.hypot(dx,dy)<7) return;
  gesture.dragged=true;
  const elapsed=Math.max(.008,(event.timeStamp-gesture.time)/1000);
  const radians=1.9/scale;
  const horizontal=dx*radians,vertical=-dy*radians;
  orbit+=horizontal;
  tilt+=vertical;
  const blend=1-Math.exp(-elapsed*32);
  const speed=angle=>Math.max(-8,Math.min(8,angle/elapsed));
  yawSpeed+=(speed(horizontal)-yawSpeed)*blend;
  pitchSpeed+=(speed(vertical)-pitchSpeed)*blend;
  Object.assign(gesture,{x:event.clientX,y:event.clientY,time:event.timeStamp});
}
hit.addEventListener('pointermove',trackDrag);
function finishDrag(event) {
  if(!gesture || gesture.id!==event.pointerId) return;
  if(event.type==='pointerup') trackDrag(event);
  skipClick=gesture.dragged || event.type!=='pointerup';
  const coast=event.type==='pointerup' && !reduced.matches
    ? Math.exp(-Math.max(0,event.timeStamp-gesture.time-25)/65) : 0;
  yawSpeed*=coast;
  pitchSpeed*=coast;
  gesture=null;
}
hit.addEventListener('pointerup',finishDrag);
hit.addEventListener('pointercancel',finishDrag);
hit.addEventListener('lostpointercapture',finishDrag);
function glow(x,y,r,stops) {
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  stops.forEach(([offset,color])=>g.addColorStop(offset,color));
  ctx.fillStyle=g;
  ctx.fillRect(x-r,y-r,2*r,2*r);
}
function path(points,close=false) {
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  if(close) ctx.closePath();
}
function winter(t, warmth, pulse) {
  ctx.save();
  ctx.globalAlpha=.20;
  ctx.drawImage(sky,0,0,width,height);
  ctx.restore();
  glow(width*.5,height*.48,width*.53,[[0,'rgba(255,217,104,.46)'],[.46,'rgba(255,115,30,.23)'],[1,'transparent']]);
  ctx.save();
  ctx.translate(width*.5,height*.69);
  ctx.scale(1,.16);
  glow(0,0,width*.59,[[0,'rgba(255,174,105,.24)'],[.4,'rgba(189,86,53,.12)'],[1,'transparent']]);
  ctx.restore();
  ctx.save();
  ctx.translate(width*.46,height*.76);
  ctx.scale(1,.18);
  glow(0,0,width*.72,[[0,'rgba(162,79,49,.13)'],[.48,'rgba(88,42,42,.09)'],[1,'transparent']]);
  ctx.restore();
  glow(width*.5,height*.58,width*.65,[[0,`rgba(246,150,65,${warmth*.22})`],[1,'transparent']]);
  ctx.save();
  ctx.globalAlpha=.74;
  ctx.drawImage(snowfield,0,height*.70,width,height*.30);
  ctx.restore();
  ctx.save();
  ctx.translate(cx,height*.785);
  ctx.scale(1,.12);
  glow(0,0,width*.30,[[0,`rgba(255,183,103,${.27+pulse*.22+warmth*.24})`],[.46,'rgba(245,133,57,.10)'],[1,'transparent']]);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation='screen';
  for(const [u,v,size] of goldGlints) {
    const x=width*u,y=height*v;
    const shine=.56+.38*Math.sin(t*2.9+u*19+v*14);
    const r=width*.021*size*(.75+shine*.55);
    glow(x,y,r*4,[[0,`rgba(255,182,43,${shine*.84})`],[1,'transparent']]);
    path([[x-r,y],[x-r*.13,y-r*.14],[x,y-r*1.42],[x+r*.13,y-r*.14],
      [x+r,y],[x+r*.13,y+r*.14],[x,y+r*1.42],[x-r*.13,y+r*.14]],true);
    ctx.fillStyle=`rgba(255,245,182,${shine})`;
    ctx.fill();
  }
  ctx.restore();
  snowLayer(t,false);
  for(const [u,v,size] of festive) {
    const twinkle=.57+.38*Math.sin(t*2.25+u*27);
    const r=width*(.016+size*.012)*(.79+twinkle*.48);
    const x=width*u+Math.sin(t*.43+v*10)*width*.012;
    const y=height*v+Math.cos(t*.51+u*8)*height*.013;
    glow(x,y,r*3,[[0,`rgba(255,151,58,${twinkle*.25})`],[1,'transparent']]);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(t*.13+u*5);
    ctx.lineWidth=Math.max(.65,width*.00135);
    ctx.strokeStyle=`rgba(255,222,158,${twinkle*.64})`;
    for(let arm=0;arm<6;arm++) {
      path([[0,0],[r,0]]);
      ctx.moveTo(r*.58,-r*.25);ctx.lineTo(r*.78,0);ctx.lineTo(r*.58,r*.25);
      ctx.stroke();
      ctx.rotate(tau/6);
    }
    ctx.restore();
  }
}
function snowLayer(t,foreground) {
  for(const [u,v,depth,drift] of snow) {
    if((depth>.73)!==foreground) continue;
    const x=((u+t*(.021+depth*.021)+Math.sin(t*.7+drift*28)*.016+1)%1)*width;
    const y=((v+t*(.028+depth*.06))%1)*height;
    const r=width*(.00055+depth**3*.004);
    ctx.fillStyle=`rgba(216,241,255,${.16+drift*.56})`;
    if(foreground) {
      glow(x,y,r*2.1,[[0,`rgba(221,247,255,${.28+drift*.47})`],[1,'transparent']]);
    } else {
      ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fill();
    }
  }
}
function draw(time) {
  const still=reduced.matches, t=still?0:time;
  const dt=Math.min(.05,Math.max(0,time-previousFrame));
  previousFrame=time;
  if(!still && !gesture) {
    const drag=Math.exp(-dt*1.65);
    const distance=(1-drag)/1.65;
    orbit+=dt*.16+yawSpeed*distance;
    tilt+=pitchSpeed*distance;
    yawSpeed*=drag;
    pitchSpeed*=drag;
  }
  const age=Math.max(0,time-lastHit);
  const open=count===4?1:0;
  const release=open*(still?1:1-Math.exp(-age*3.5));
  const impact=still?0:Math.exp(-age*8);
  const pulse=still?0:Math.pow(.5+.5*Math.sin(t*2.8),3)*(1-release);
  const cheer=open&&!still?release*Math.exp(-age*1.65):0;
  const hop=cheer*Math.abs(Math.sin(age*7.2));
  const flare=open?(still?.62:.52+.38*Math.sin(age*3.3)**2):0;
  const struggle=pulse*Math.sin(t*26);
  const x=cx+scale*(Math.sin(age*49)*impact*.078+struggle*.038+cheer*Math.sin(age*8)*.13);
  const y=cy+scale*(-release*.17+Math.sin(t*1.5)*.023-pulse*.046-hop*.68);
  const radius=scale*(.57+release*.59+pulse*.14+hop*.19);
  ctx.clearRect(0,0,width,height);
  winter(t,release,pulse);
  ctx.globalCompositeOperation='screen';
  glow(x,y,scale*(3.5+pulse*.55+flare*.42),[[0,`rgba(255,162,58,${.13+release*.26+pulse*.32+flare*.09})`],[.58,'rgba(185,63,24,.08)'],[1,'transparent']]);
  ctx.save();
  ctx.translate(x,cy+scale*1.42);
  ctx.scale(1,.15);
  glow(0,0,scale*2.6,[[0,`rgba(149,217,255,${.42-release*.14})`],[.45,'rgba(84,162,212,.16)'],[1,'transparent']]);
  ctx.restore();
  for(const [angle,length,spread] of rayAngles) {
    const a=angle+t*.045;
    const beam=release*flare*(.76+.24*Math.cos(t*2+angle*3));
    const distance=radius*(1.07+pulse*.26+release*(1.2+length*4.6)+beam*1.25+impact*.18);
    const endX=x+Math.cos(a)*distance, endY=y+Math.sin(a)*distance;
    const g=ctx.createLinearGradient(x,y,endX,endY);
    g.addColorStop(0,`rgba(255,186,70,${.06+release*(.13+spread*.42)+beam*.13})`);
    g.addColorStop(.38,`rgba(255,172,52,${release*spread*.18+beam*.08})`);
    g.addColorStop(1,'transparent');
    const w=.009+spread*.062;
    path([[x,y],[x+Math.cos(a-w)*distance,y+Math.sin(a-w)*distance],
      [x+Math.cos(a+w)*distance,y+Math.sin(a+w)*distance]],true);
    ctx.fillStyle=g; ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';

  const yaw=orbit+struggle*.048, pitch=tilt+Math.sin(t*.62)*.065+struggle*.021;
  const sinYaw=Math.sin(yaw), cosYaw=Math.cos(yaw);
  const sinPitch=Math.sin(pitch), cosPitch=Math.cos(pitch);
  function project([vx,vy,vz]) {
    const xx=vx*cosYaw+vz*sinYaw, zz=vz*cosYaw-vx*sinYaw;
    const yy=vy*cosPitch-zz*sinPitch, depth=zz*cosPitch+vy*sinPitch;
    const f=4.6/(4.6-depth)*scale;
    return [x+xx*f,y+yy*f,depth];
  }
  const cubes=faces.map((face,id)=>{
    const corners=face.map(i=>vertices[i]), points=corners.map(project);
    const depth=points.reduce((sum,p)=>sum+p[2],0)/4;
    return {corners,points,depth,id};
  }).sort((a,b)=>a.depth-b.depth);
  const iceVisible=release<.96 && ice?.render(yaw,pitch,radius/scale,t,count,impact);
  function surfaceCracks() {
    const visible=cubes.filter(face=>face.depth>.24).sort((a,b)=>b.depth-a.depth);
    visible.slice(0,2).forEach(({corners},faceIndex)=>{
      const [a,b,,d]=corners;
      const inset=.062;
      const onFace=(u,v)=>project(a.map((n,i)=>n+(b[i]-n)*u+(d[i]-n)*v));
      ctx.save();
      ctx.globalAlpha=(1-release)**2*(faceIndex===0?1:.66);
      path([[inset,inset],[1-inset,inset],[1-inset,1-inset],[inset,1-inset]]
        .map(([u,v])=>onFace(u,v)),true);
      ctx.clip();
      ctx.lineJoin='round';
      ctx.lineCap='round';
      for(let level=faceIndex;level<Math.min(count,3);level++) {
        fracture[level].forEach((line,index)=>{
          const points=line.map(([u,v])=>onFace(faceIndex?1-u:u,v));
          path(points);
          ctx.lineWidth=scale*(index%3===0?.032:.019);
          ctx.strokeStyle='rgba(19,13,16,.58)';
          ctx.stroke();
          ctx.lineWidth=scale*(index%3===0?.014:.008);
          ctx.strokeStyle=`rgba(229,248,255,${(index%3===0?.70:.47)+impact*.20})`;
          ctx.stroke();
        });
      }
      ctx.restore();
    });
  }
  function glass({corners,points,depth,id}) {
    ctx.save();
    ctx.globalAlpha=(1-release)**2;
    const [a,b,,d]=corners;
    const onFace=(u,v,shrink=1)=>project(a.map((n,i)=>(n+(b[i]-n)*u+(d[i]-n)*v)*shrink));
    path(points,true);
    ctx.clip();
    const reflection=ctx.createLinearGradient(x-scale,y-scale,x+scale,y+scale);
    reflection.addColorStop(0,'rgba(208,246,255,.49)');
    reflection.addColorStop(.29,'rgba(64,145,198,.19)');
    reflection.addColorStop(.48,'rgba(165,226,254,.23)');
    reflection.addColorStop(.58,'rgba(35,112,174,.13)');
    reflection.addColorStop(.81,'rgba(64,145,205,.16)');
    reflection.addColorStop(1,'rgba(199,247,255,.44)');
    ctx.fillStyle=reflection;ctx.fillRect(x-2*scale,y-2*scale,4*scale,4*scale);
    path([[0,.05],[1,.23],[1,.31],[0,.1]].map(([u,v])=>onFace(u,v)),true);
    ctx.fillStyle=`rgba(217,233,255,${.045+Math.max(0,depth)*.075})`;ctx.fill();
    for(const [u,v,grain,variation] of frost) {
      const [px,py]=onFace(u,v);
      const flake=scale*(.003+grain**3*.02);
      ctx.fillStyle=`rgba(208,245,255,${.065+variation*.34})`;
      ctx.beginPath();ctx.ellipse(px,py,flake,flake*(.35+variation*.57),id*.85,0,tau);ctx.fill();
    for(let layer=0;layer<3;layer++) {
      const inset=.028+layer*.024;
      path([[inset,inset],[1-inset,inset],[1-inset,1-inset],[inset,1-inset]]
        .map(([u,v])=>onFace(u,v)),true);
      ctx.lineWidth=scale*(.044-layer*.008);
      ctx.strokeStyle=`rgba(184,237,255,${.14-layer*.036})`;ctx.stroke();
    }
    }
    if(count>0&&depth>0) {
      ctx.lineJoin='round';
      for(let level=0;level<Math.min(count,3);level++) {
        if(level>0 && (id+level)%4===0) continue;
        for(const line of fracture[level]) {
          path(line.map(([u,v])=>onFace(u,v)));
          ctx.lineWidth=scale*.033;ctx.strokeStyle='rgba(7,33,60,.72)';ctx.stroke();
          ctx.lineWidth=scale*(level===0?.013:.008);ctx.strokeStyle=`rgba(217,248,255,${.68+impact*.28})`;ctx.stroke();
        }
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=(1-release)**2;
    const edge=ctx.createLinearGradient(x-scale,y-scale,x+scale,y+scale);
    edge.addColorStop(0,'#d8faff');edge.addColorStop(.44,'#557da4');
    edge.addColorStop(.7,'#eefbff');edge.addColorStop(1,'#6cbfe4');
    path(points,true);ctx.lineWidth=scale*(depth>0?.062:.038);ctx.strokeStyle='rgba(141,217,250,.28)';ctx.stroke();
    ctx.lineWidth=scale*(depth>0?.018:.009);ctx.strokeStyle=edge;ctx.stroke();
    path([[.028,.028],[.972,.028],[.972,.972],[.028,.972]].map(([u,v])=>onFace(u,v,.993)),true);
    ctx.lineWidth=.75;ctx.strokeStyle='rgba(225,212,206,.46)';ctx.stroke();
    ctx.restore();
  }
  if(!iceVisible) cubes.filter(face=>face.depth<=0).forEach(face=>glass(face));

  ctx.globalCompositeOperation='screen';
  glow(x,y,radius*1.7,[[.48,'rgba(255,121,11,.32)'],[.59,'rgba(255,80,12,.38)'],[.72,'rgba(255,61,6,.14)'],[1,'transparent']]);
  ctx.globalCompositeOperation='source-over';
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(t*.057);
  ctx.globalAlpha=iceVisible?release:1;
  ctx.drawImage(texture,-radius,-radius,radius*2,radius*2);
  ctx.restore();
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<30;i++) {
    const a=i*2.399+t*.08, length=radius*(.025+.106*(.5+.5*Math.sin(i*9.1+t*2)));
    ctx.beginPath();
    ctx.ellipse(x+Math.cos(a)*radius*.948,y+Math.sin(a)*radius*.948,length,radius*.022,a+1.57,0,Math.PI);
    ctx.lineWidth=.85;ctx.strokeStyle='rgba(255,152,51,.46)';ctx.stroke();
  }
  ctx.globalCompositeOperation='source-over';
  if(iceVisible) {
    const half=scale*1.9;
    ctx.save();
    ctx.globalAlpha=(1-release)**2;
    ctx.drawImage(ice.layer,x-half,y-half,half*2,half*2);
    ctx.restore();
    if(count) surfaceCracks();
  } else if(release<.99) {
    cubes.filter(face=>face.depth>0).forEach(face=>glass(face));
  }
  if(logo.complete && logo.naturalWidth && (open || !iceVisible)) {
    const logoWidth=radius*(open?1.72:1.39);
    const logoHeight=logoWidth*logo.naturalHeight/logo.naturalWidth;
    ctx.save();
    ctx.globalAlpha=open?release:.22+count*.18;
    if(open) {
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(1,.72);
      glow(0,0,radius*.98,[[0,'rgba(45,8,2,.87)'],[.63,'rgba(49,9,2,.78)'],[1,'transparent']]);
      ctx.restore();
    }
    ctx.shadowColor='#300702';
    ctx.shadowBlur=radius*.18;
    ctx.translate(x,y);
    ctx.rotate(cheer*Math.sin(age*10)*.25);
    ctx.drawImage(logo,-logoWidth/2,-logoHeight/2,logoWidth,logoHeight);
    ctx.restore();
  }
  if(open && age<3 && !still) {
    const ribbons=['#ffda57','#a4ff52','#ff6547','#b6f8ff'];
    shards.slice(0,44).forEach(([angle,s,p,q,k],index)=>{
      const elapsed=age-q*.24;
      if(elapsed<0 || elapsed>2.2) return;
      const distance=scale*(.84+(1-Math.exp(-elapsed*1.5))*(.64+s*2.14));
      const px=cx+Math.cos(angle)*distance;
      const py=cy+Math.sin(angle)*distance+scale*(elapsed*elapsed*.36-elapsed*.54);
      const size=scale*(.025+p*.038);
      ctx.save();
      ctx.translate(px,py);
      ctx.rotate(angle+elapsed*(k-.5)*9);
      ctx.globalAlpha=Math.min(1,elapsed*18,(2.2-elapsed)*1.6);
      ctx.fillStyle=ribbons[index%ribbons.length];
      ctx.fillRect(-size/2,-size*.19,size,size*(.26+.28*Math.abs(Math.cos(elapsed*8+q*5))));
      ctx.restore();
    });
    for(const [a,s,p,q,k] of shards) {
      const distance=scale*(.85+age*(1+s*3));
      const px=x+Math.cos(a)*distance, py=y+Math.sin(a)*distance+age*age*24;
      const size=scale*(.025+p*.16), alpha=Math.max(0,1-age/2.5);
      ctx.save();
      ctx.translate(px,py);ctx.rotate(q*9+age*(k-.5)*15);
      ctx.globalAlpha=alpha;
      path([[-size,-size*.4],[size,0],[size*.2,size*.71]],true);
      ctx.fillStyle='rgba(167,225,255,.35)';ctx.fill();
      ctx.lineWidth=scale*.007;ctx.strokeStyle=k>.5?'#ffe2af':'#b5efff';ctx.stroke();
      ctx.restore();
    }
  }
  if(impact>.03) {
    ctx.globalCompositeOperation='screen';
    glow(x,y,scale*(open?3.8:2),[[0,`rgba(255,233,188,${impact*(open?.9:.26)})`],[1,'transparent']]);
    ctx.globalCompositeOperation='source-over';
  }
  snowLayer(t,true);
  requestAnimationFrame(()=>draw(now()));
}

draw(0);


