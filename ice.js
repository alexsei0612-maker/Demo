'use strict';

function createIce(surface) {
  const layer=document.createElement('canvas');
  layer.width=layer.height=480;
  const gl=layer.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
  if(!gl) return null;
  const vertex=`
    attribute vec2 position;
    varying vec2 uv;
    void main(){uv=position;gl_Position=vec4(position,0.,1.);}
  `;
  const fragment=`
    precision highp float;
    varying vec2 uv;
    uniform vec2 orientation;
    uniform float solarRadius;
    uniform float phase;
    uniform float damage;
    uniform float impact;
    uniform sampler2D solar;
    uniform sampler2D brand;

    float hash(vec3 p){
      return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);
    }
    float noise(vec3 p){
      vec3 i=floor(p),f=fract(p);
      f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                     mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                     mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    vec3 local(vec3 p){
      float a=orientation.x,b=orientation.y;
      float y=p.y*cos(b)+p.z*sin(b);
      float z=p.z*cos(b)-p.y*sin(b);
      return vec3(p.x*cos(a)-z*sin(a),y,z*cos(a)+p.x*sin(a));
    }
    float shell(vec3 p){
      vec3 q=abs(p)-vec3(.88);
      return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-.114
        +(noise(p*8.)-.5)*.028+(noise(p*23.)-.5)*.009;
    }
    vec3 normal(vec3 p){
      vec2 e=vec2(.004,0.);
      return normalize(vec3(shell(p+e.xyy)-shell(p-e.xyy),
        shell(p+e.yxy)-shell(p-e.yxy),shell(p+e.yyx)-shell(p-e.yyx)));
    }
    vec3 lightThrough(vec3 p,vec3 ray,vec3 right,vec3 down,float radius){
      vec3 closest=p+max(0.,-dot(p,ray))*ray;
      float d=length(closest);
      vec2 st=.5+vec2(dot(closest,right),dot(closest,down))*.49/radius;
      float angle=phase*.09;
      st=.5+mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*(st-.5);
      vec3 image=texture2D(solar,clamp(st,0.,1.)).rgb;
      float corona=exp(-max(0.,d-radius)*12.)*(1.-smoothstep(radius*.8,radius*1.7,d));
      return image*(1.-smoothstep(radius*.91,radius,d))*(.30+min(damage,3.)*.105) +
        vec3(1.,.32,.032)*corona*.41;
    }
    // Each sheet opens inside the ice and tapers away from the impact.
    vec2 fissure(vec3 p,vec3 ray,vec3 origin,vec3 along,vec3 across,float span,float twist){
      vec3 n=normalize(cross(along,across));
      float facing=dot(ray,n);
      float t=dot(origin-p,n)/(abs(facing)<.01?.01:facing);
      vec3 hit=p+t*ray-origin;
      float u=dot(hit,along);
      float v=dot(hit,across);
      float limit=abs(u)/span;
      float envelope=(1.-smoothstep(.57,1.,limit))*step(-.018,t)*step(t,.98);
      float kink=(noise(vec3(u*11.,twist,0.))-.5)*.17
        +(noise(vec3(u*43.,twist,1.))-.5)*.044;
      float seam=v-kink;
      float width=.006+.017*envelope;
      float hollow=(1.-smoothstep(width,width+.014,abs(seam)))*envelope;
      float glint=(1.-smoothstep(.004,.021,abs(seam-width*.83)))*envelope;
      return vec2(hollow,glint*(.38+.62*abs(facing)));
    }
    void main(){
      vec3 eye=local(vec3(0,0,4.6));
      vec3 ray=normalize(local(vec3(uv.x*1.9,-uv.y*1.9,-4.6)));
      vec3 safeRay=sign(ray+vec3(.000001))*max(abs(ray),vec3(.000001));
      vec3 t0=(-vec3(1.035)-eye)/safeRay,t1=(vec3(1.035)-eye)/safeRay;
      vec3 nearPlane=min(t0,t1),farPlane=max(t0,t1);
      float t=max(max(nearPlane.x,nearPlane.y),nearPlane.z);
      float end=min(min(farPlane.x,farPlane.y),farPlane.z);
      if(t>end) discard;
      float d=1.;
      for(int i=0;i<26;i++){
        d=shell(eye+t*ray);
        if(d<.003||t>end) break;
        t+=d*.70;
      }
      if(d>.006||t>end) discard;
      vec3 p=eye+t*ray,n=normal(p);
      float face=clamp(dot(-ray,n),0.,1.);
      float fresnel=.026+.974*pow(1.-face,4.);
      vec3 inside=refract(ray,n,1./1.31);
      vec3 right=local(vec3(1,0,0)),down=local(vec3(0,1,0));
      vec3 axes=abs(p);
      float seam=axes.x+axes.y+axes.z-max(axes.x,max(axes.y,axes.z))-min(axes.x,min(axes.y,axes.z));
      float rim=smoothstep(.70,1.0,seam);
      float grain=noise(p*41.);
      float veins=pow(1.-abs(sin((p.y*2.6+noise(p*5.)*.72)*23.)),6.);
      float snow=smoothstep(.56,.87,noise(p*18.)*.72+grain*.28)*rim;
      vec3 entryLight=lightThrough(p,inside,right,down,solarRadius);
      vec3 exitT=(sign(inside)*.975-p)/mix(vec3(.0001),inside,step(vec3(.0001),abs(inside)));
      exitT=mix(vec3(10.),exitT,step(vec3(.02),exitT));
      float travel=min(min(exitT.x,exitT.y),exitT.z);
      vec3 exitPoint=p+inside*travel;
      vec3 exitNormal=step(exitT,vec3(travel+.001))*sign(inside);
      vec3 rebound=reflect(inside,exitNormal);
      vec3 reflectedLight=lightThrough(exitPoint,rebound,right,down,solarRadius*1.11);
      float bubbles=smoothstep(.77,.96,noise(p*72.+inside*4.));
      vec3 blue=vec3(.055,.40,.78);
      vec3 color=blue*(.15+.39*noise(p*8.)+.24*veins*rim)
        +vec3(.47,.88,1.)*(fresnel*.77+snow*.65+bubbles*.21+rim*.23)
        +entryLight*vec3(1.16,.97,.76)+reflectedLight*(.29+rim*.64);
      vec3 forward=local(vec3(0,0,1));
      vec3 logoRay=normalize(mix(ray,inside,.52));
      float logoTime=-dot(p,forward)/min(-.08,dot(logoRay,forward));
      vec3 logoHit=p+max(0.,logoTime)*logoRay;
      vec2 logoUV=.5+vec2(dot(logoHit,right)/.88,dot(logoHit,down)/.5626);
      vec4 ink=texture2D(brand,clamp(logoUV,0.,1.));
      vec2 bounds=step(vec2(0.),logoUV)*step(logoUV,vec2(1.));
      float through=step(0.,logoTime)*step(logoTime,travel)*bounds.x*bounds.y*ink.a*(.24+min(damage,3.)*.18);
      color=mix(color,ink.rgb*(.73+face*.41),through);
      vec2 splits=vec2(0.);
      if(damage>=1.){
        splits=fissure(p,inside,vec3(.46,-.12,.80),normalize(vec3(.37,.92,-.12)),
          normalize(vec3(.82,-.28,.49)),.70,4.);
        splits=max(splits,.65*fissure(p,inside,vec3(.37,-.41,.78),normalize(vec3(.77,-.53,-.13)),
          normalize(vec3(.38,.74,.45)),.48,9.));
      }
      if(damage>=2.){
        splits=max(splits,fissure(p,inside,vec3(.05,.56,.82),normalize(vec3(.92,-.35,-.10)),
          normalize(vec3(.27,.76,.49)),.73,13.));
        splits=max(splits,.58*fissure(p,inside,vec3(-.33,.70,.82),normalize(vec3(-.36,-.89,-.12)),
          normalize(vec3(.79,-.26,.54)),.44,31.));
      }
      if(damage>=3.){
        splits=max(splits,fissure(p,inside,vec3(-.62,.02,.68),normalize(vec3(-.30,.87,.39)),
          normalize(vec3(.46,.48,-.74)),.86,24.));
        splits=max(splits,.62*fissure(p,inside,vec3(.78,.16,.17),normalize(vec3(-.13,-.56,.81)),
          normalize(vec3(.45,.72,.58)),.73,37.));
      }
      color*=1.-splits.x*.72;
      color+=splits.y*(vec3(.65,.92,1.)+vec3(1.,.47,.07)*entryLight.r)*(1.28+impact*.54);
      float lit=max(color.r,max(color.g,color.b));
      float alpha=clamp(.43+fresnel*.49+rim*.41+snow*.40+lit*.24+through*.60+splits.y*.38,.0,1.);
      gl_FragColor=vec4(color,alpha*(1.-smoothstep(.001,.006,d)));
    }
  `;
  function compile(type,source) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) return null;
    return shader;
  }
  const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs) return null;
  const program=gl.createProgram();
  gl.attachShader(program,vs);
  gl.attachShader(program,fs);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,surface);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'solar'),0);
  gl.uniform1i(gl.getUniformLocation(program,'brand'),1);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const orientation=gl.getUniformLocation(program,'orientation');
  const solarRadius=gl.getUniformLocation(program,'solarRadius');
  const phase=gl.getUniformLocation(program,'phase');
  const damage=gl.getUniformLocation(program,'damage');
  const impact=gl.getUniformLocation(program,'impact');
  return {
    layer,
    setLogo(image) {
      if(gl.isContextLost()) return;
      const decal=document.createElement('canvas');
      decal.width=320;
      decal.height=205;
      decal.getContext('2d').drawImage(image,0,0,decal.width,decal.height);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,decal);
    },
    render(yaw,pitch,radius,time,hits,flash) {
      if(gl.isContextLost()) return false;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(orientation,yaw,pitch);
      gl.uniform1f(solarRadius,radius);
      gl.uniform1f(phase,time);
      gl.uniform1f(damage,hits);
      gl.uniform1f(impact,flash);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      return true;
    }
  };
}

