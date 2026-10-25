// The Halberd (DD-07): the navy's 400 m destroyer, built from primitives in "ship units" (about 14 long),
// scaled to metres by HALBERD.scale. Panel textures are drawn on a canvas at load (shared with transport.js).
import * as THREE from 'three';
import {HALBERD,UVS} from '../config.js';
const SHIP_SCALE=HALBERD.scale;
import {lin,rng,glowTex} from '../util.js';
import {ANISO} from '../engine.js';

export function panelTextures(){const SZ=1024;const c=document.createElement('canvas');c.width=c.height=SZ;const g=c.getContext('2d');const rc=document.createElement('canvas');rc.width=rc.height=SZ;const rg=rc.getContext('2d');
  const r=rng(9);
  g.fillStyle='#4f565d';g.fillRect(0,0,SZ,SZ);rg.fillStyle='#d0d0d0';rg.fillRect(0,0,SZ,SZ);
  function split(x,y,w,h,depth){
    if(depth>4||(w<90&&h<90)||(depth>1&&r()<0.18)){
      const v=Math.round(150*(0.88+r()*0.2));g.fillStyle='rgb('+v+','+Math.round(v*1.02)+','+Math.round(v*1.06)+')';g.fillRect(x+2,y+2,w-4,h-4);
      const rv=Math.round(80+r()*100);rg.fillStyle='rgb('+rv+','+rv+','+rv+')';rg.fillRect(x+2,y+2,w-4,h-4);
      if(r()<0.12&&w>60&&h>40){g.fillStyle='rgba(40,44,50,0.55)';for(let k=0;k<6;k++)g.fillRect(x+10,y+10+k*((h-20)/6),w-20,Math.max(2,(h-20)/14))}
      if(r()<0.25){g.fillStyle='rgba(50,55,60,0.5)';const n=Math.floor(w/22);for(let k=1;k<n;k++){g.beginPath();g.arc(x+k*22,y+7,2,0,6.28);g.fill();g.beginPath();g.arc(x+k*22,y+h-7,2,0,6.28);g.fill()}}
      return}
    if(w>h){const s=Math.round(w*(0.3+r()*0.4));split(x,y,s,h,depth+1);split(x+s,y,w-s,h,depth+1)}else{const s=Math.round(h*(0.3+r()*0.4));split(x,y,w,s,depth+1);split(x,y+s,w,h-s,depth+1)}}
  split(0,0,SZ,SZ,0);
  const id=g.getImageData(0,0,SZ,SZ),D=id.data;for(let i=0;i<D.length;i+=4){const n=(r()-0.5)*10;D[i]+=n;D[i+1]+=n;D[i+2]+=n}g.putImageData(id,0,0);
  const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=ANISO;
  const rough=new THREE.CanvasTexture(rc);rough.wrapS=rough.wrapT=THREE.RepeatWrapping;rough.anisotropy=ANISO;
  return{map,rough}}

export function boxUV(g,s=UVS){const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));let u,v;
    if(ax>=ay&&ax>=az){u=p.getZ(i);v=p.getY(i)}else if(ay>=az){u=p.getX(i);v=p.getZ(i)}else{u=p.getX(i);v=p.getY(i)}
    uv[i*2]=u/s;uv[i*2+1]=v/s}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g}
export function bbox(w,h,d,b=0.05,uv=UVS){const s=new THREE.Shape(),hw=w/2-b,hh=h/2-b;s.moveTo(-hw,-hh);s.lineTo(hw,-hh);s.lineTo(hw,hh);s.lineTo(-hw,hh);s.closePath();
  const dd=Math.max(0.001,d-2*b);const g=new THREE.ExtrudeGeometry(s,{depth:dd,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,steps:1});g.translate(0,0,-dd/2);return boxUV(g,uv)}
function textTex(lines,w,h,color){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=color;g.textBaseline='middle';
  lines.forEach(l=>{g.font=l.f;g.fillText(l.t,l.x,l.y)});const t=new THREE.CanvasTexture(c);t.anisotropy=ANISO;t.encoding=THREE.sRGBEncoding;return t}

const MAIN_PLAN=[[0,7.2],[1.0,4.2],[1.9,1.0],[2.1,-2.5],[1.9,-5.2],[-1.9,-5.2],[-2.1,-2.5],[-1.9,1.0],[-1.0,4.2]];
function sideAt(fwd){const pts=MAIN_PLAN.slice(0,5);for(let i=0;i<4;i++){const a=pts[i],b=pts[i+1];if(fwd<=a[1]&&fwd>=b[1]){const t=(a[1]-fwd)/(a[1]-b[1]);const x=a[0]+(b[0]-a[0])*t;const dx=b[0]-a[0],df=b[1]-a[1];const nx=-df,nz=-dx;const l=Math.hypot(nx,nz);return{x,nx:nx/l,nz:nz/l}}}return{x:pts[4][0],nx:1,nz:0}}

export function buildDestroyer(){
  const root=new THREE.Group(),vis=new THREE.Group();root.add(vis);root.scale.setScalar(SHIP_SCALE);
  const T=panelTextures();
  const std=(hex,metal,rough,extra)=>new THREE.MeshStandardMaterial(Object.assign({map:T.map,roughnessMap:T.rough,bumpMap:T.map,bumpScale:0.35,color:lin(hex),metalness:metal,roughness:rough},extra||{}));
  const hullM=std(0xb3b9c0,0.55,0.9),plateM=std(0x8d949c,0.55,0.9),darkM=std(0x444b54,0.6,0.8);
  const accentM=new THREE.MeshStandardMaterial({color:lin(0xffb14a),metalness:0.25,roughness:0.5,emissive:lin(0x3a2000)});
  const winM=new THREE.MeshStandardMaterial({color:lin(0x0a1420),emissive:lin(0x7fc0ee),emissiveIntensity:0.9,metalness:0.6,roughness:0.2});
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,parent=vis)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m};
  const plate=(pts,depth,bevel)=>{const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1});g.rotateX(-Math.PI/2);return boxUV(g)};
  add(plate(MAIN_PLAN,0.9,0.18),hullM,0,-0.75,0);
  add(plate([[0,5.5],[0.9,2],[1.1,-2],[0.9,-4.6],[-0.9,-4.6],[-1.1,-2],[-0.9,2]],0.5,0.1),darkM,0,-1.45,0);
  add(plate([[0,4.6],[0.8,2.4],[1.45,0],[1.55,-2.6],[1.4,-4.8],[-1.4,-4.8],[-1.55,-2.6],[-1.45,0],[-0.8,2.4]],0.45,0.1),plateM,0,0.35,0);
  [-1,1].forEach(s=>add(plate([[0,3.4],[s*0.25,1.0],[s*0.35,-3.6],[0,-3.9]],0.18,0.05),plateM,s*1.2,0.18,0));
  const DT=0.9,TB=DT+1.25;
  add(new THREE.BoxGeometry(0.9,0.02,0.08),accentM,0.36,DT+0.01,-4.25,0,-0.61,0);
  add(new THREE.BoxGeometry(0.9,0.02,0.08),accentM,-0.36,DT+0.01,-4.25,0,0.61,0);
  for(let r=0;r<2;r++)for(let k=0;k<4;k++)add(new THREE.BoxGeometry(0.18,0.03,0.16),darkM,-0.33+k*0.22,DT+0.015,-3.7-r*0.22);
  add(bbox(1.7,1.25,2.4,0.06),hullM,0,DT+0.625,1.5);
  add(new THREE.BoxGeometry(1.74,0.1,2.44),accentM,0,DT+1.05,1.5);
  add(bbox(1.6,1.17,0.1,0.03),plateM,0,DT+0.5,0.05,0.54,0,0);
  [-1,1].forEach(s=>add(bbox(0.25,0.55,1.3,0.04),plateM,s*0.98,DT+0.28,1.7));
  const towerHide=[];
  towerHide.push(add(bbox(1.35,0.55,1.2,0.05),hullM,0,TB+0.275,1.15));
  towerHide.push(add(new THREE.BoxGeometry(1.25,0.15,0.02),winM,0,TB+0.33,0.54));
  [-1,1].forEach(s=>towerHide.push(add(new THREE.BoxGeometry(0.02,0.12,0.8),winM,s*0.68,TB+0.33,1.1)));
  towerHide.push(add(bbox(1.0,0.1,0.9,0.03),plateM,0,TB+0.6,1.25));
  towerHide.push(add(new THREE.SphereGeometry(0.2,20,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:lin(0xe6e9ec),roughness:0.5,metalness:0.1}),0,TB+0.65,1.5));
  add(new THREE.CylinderGeometry(0.035,0.05,1.3,8),darkM,0,TB+1.2,1.75);
  add(new THREE.BoxGeometry(0.9,0.04,0.04),darkM,0,TB+1.5,1.75);
  [-0.35,0.35].forEach(x=>add(new THREE.CylinderGeometry(0.012,0.012,0.6,5),darkM,x,TB+1.8,1.75));
  const strobe=add(new THREE.SphereGeometry(0.06,8,6),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),0,TB+1.88,1.75);
  const dish=new THREE.Group();dish.position.set(0,TB+0.05,2.3);vis.add(dish);
  add(new THREE.CylinderGeometry(0.04,0.06,0.3,8),darkM,0,0.15,0,0,0,0,dish);
  const dm=add(new THREE.SphereGeometry(0.3,20,10,0,Math.PI*2,0,0.85),plateM,0,0.38,0,-Math.PI/2,0,0,dish);dm.material=plateM.clone();dm.material.side=THREE.DoubleSide;
  function turret(){const g=new THREE.Group();
    add(new THREE.CylinderGeometry(0.42,0.46,0.18,24),darkM,0,0.09,0,0,0,0,g);
    add(bbox(0.66,0.3,0.78,0.05),hullM,0,0.33,0.02,0,0,0,g);
    add(bbox(0.62,0.05,0.32,0.02),plateM,0,0.47,-0.2,-0.35,0,0,g);
    [-1,1].forEach(s=>{add(new THREE.CylinderGeometry(0.05,0.065,1.35,12),darkM,s*0.15,0.33,-0.95,-Math.PI/2,0,0,g);add(new THREE.CylinderGeometry(0.075,0.075,0.12,12),darkM,s*0.15,0.33,-1.6,-Math.PI/2,0,0,g)});
    return g}
  const tA=turret();tA.position.set(0,DT,-3.0);vis.add(tA);
  add(bbox(0.95,0.26,0.95,0.04),plateM,0,DT+0.13,-1.45);
  const tB=turret();tB.position.set(0,DT+0.26,-1.45);vis.add(tB);
  const tC=turret();tC.position.set(0,DT,3.55);tC.rotation.y=Math.PI;vis.add(tC);
  function ciws(x,z,ry){const g=new THREE.Group();g.position.set(x,DT,z);g.rotation.y=ry;vis.add(g);
    add(new THREE.CylinderGeometry(0.12,0.14,0.1,16),darkM,0,0.05,0,0,0,0,g);
    add(new THREE.SphereGeometry(0.12,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:lin(0xe6e9ec),roughness:0.45,metalness:0.2}),0,0.1,0,0,0,0,g);
    add(new THREE.CylinderGeometry(0.02,0.02,0.36,8),darkM,0,0.16,-0.24,-Math.PI/2,0,0,g)}
  ciws(1.2,-1.0,-Math.PI/2);ciws(-1.2,-1.0,Math.PI/2);ciws(1.15,2.95,-Math.PI/2);ciws(-1.15,2.95,Math.PI/2);
  const gr=rng(77);
  for(let i=0;i<30;i++){const s=gr()<0.5?-1:1,w=0.1+gr()*0.22,h=0.05+gr()*0.16,d=0.12+gr()*0.4,x=s*(1.0+gr()*0.32),z=-0.6+gr()*4.6;add(bbox(w,h,d,0.015),gr()<0.3?darkM:plateM,x,DT+h/2,z)}
  add(bbox(3.2,1.5,1.4,0.08),hullM,0,-0.2,5.6);
  add(new THREE.BoxGeometry(3.26,0.12,1.44),accentM,0,0.45,5.6);
  for(let k=0;k<6;k++)add(new THREE.BoxGeometry(0.36,0.04,0.7),darkM,-1.25+k*0.5,0.56,5.6);
  const flames=[],glows=[];
  const glowM=new THREE.MeshBasicMaterial({color:lin(0xbfeaff),toneMapped:false});
  const fade=(()=>{const c=document.createElement('canvas');c.width=4;c.height=128;const g=c.getContext('2d');const gr2=g.createLinearGradient(0,0,0,128);gr2.addColorStop(0,'#000');gr2.addColorStop(0.55,'#444');gr2.addColorStop(1,'#fff');g.fillStyle=gr2;g.fillRect(0,0,4,128);return new THREE.CanvasTexture(c)})();
  const glowT=glowTex([[0,'rgba(220,245,255,1)'],[0.2,'rgba(120,200,255,0.55)'],[0.6,'rgba(60,140,255,0.1)'],[1,'rgba(40,100,255,0)']]);
  function engine(x,y,r,len,flameLen){
    add(new THREE.CylinderGeometry(r,r*1.18,len,24),darkM,x,y,6.0+len/2,-Math.PI/2);
    add(new THREE.TorusGeometry(r*1.12,r*0.08,8,28),plateM,x,y,6.0+len,0,0,0);
    const z=6.0+len;add(new THREE.CircleGeometry(r*0.92,24),glowM,x,y,z+0.01);
    [[r*0.86,flameLen,0x6cc6ff,0.7],[r*0.42,flameLen*0.6,0xe2f6ff,0.85]].forEach(([fr,fl,fc,op])=>{
      const fg=new THREE.ConeGeometry(fr,fl,20,1,true);fg.translate(0,fl/2,0);
      const m=add(fg,new THREE.MeshBasicMaterial({color:lin(fc),alphaMap:fade,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),x,y,z+0.02,Math.PI/2);m.userData.op=op;flames.push(m)});
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false}));sp.position.set(x,y,z+0.15);sp.scale.set(r*3.6,r*3.6,1);sp.userData.base=r*3.6;vis.add(sp);glows.push(sp)}
  [-1.05,0,1.05].forEach(x=>engine(x,-0.25,0.42,1.1,3.2));
  [-0.6,0.6].forEach(x=>engine(x,0.4,0.2,0.8,1.8));
  const eLight=new THREE.PointLight(0x7cc8ff,2.5,7*SHIP_SCALE,2);eLight.position.set(0,-0.1,7.6);vis.add(eLight);
  const nav=[];
  [[-2.25,-0.3,-2.5,0xff3b30],[2.25,-0.3,-2.5,0x30ff7a],[0,-0.2,6.35,0xffffff]].forEach(([x,y,z,c])=>nav.push(add(new THREE.SphereGeometry(0.07,8,6),new THREE.MeshBasicMaterial({color:lin(c),toneMapped:false}),x,y,z)));
  const decal=textTex([{t:'DD-07',f:'700 78px "Michroma","Arial Black",sans-serif',x:16,y:58},{t:'HALBERD',f:'500 26px "IBM Plex Mono",monospace',x:20,y:112}],512,140,'rgba(225,230,236,0.9)');
  const decM=new THREE.MeshStandardMaterial({map:decal,emissive:0xffffff,emissiveMap:decal,emissiveIntensity:0.25,transparent:true,metalness:0.3,roughness:0.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  [1,-1].forEach(s=>{const sd=sideAt(2.5);add(new THREE.PlaneGeometry(1.7,0.46),decM,s*(sd.x+0.2),-0.32,-2.5,0,s*Math.atan2(sd.nx,-sd.nz),0)});
  const winPos=[];const wr=rng(19);
  [1,-1].forEach(s=>{for(const y of [0.06,-0.24])for(let f=3.6;f>-4.9;f-=0.21){if(wr()<0.3)continue;const sd=sideAt(f);winPos.push([s*(sd.x+0.185),y,-f,s*Math.atan2(sd.nx,-sd.nz)])}
    for(const y of [DT+0.35,DT+0.58,DT+0.81])for(let z=0.5;z<2.6;z+=0.17){if(wr()<0.25)continue;winPos.push([s*0.853,y,z,s*Math.PI/2])}});
  // Landing legs: struts hinged at the engine block. Stowed they fold forward along the hull (out of sight,
  // so the ship looks as before in orbit); deployed they swing out and back past the engine bells to stand on
  // HALBERD.legFeet. setLegs(k) moves them (0 stowed, 1 down).
  const legs=[],yToZ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  HALBERD.legHinges.forEach((h,i)=>{
    const H=new THREE.Vector3(...h),P=new THREE.Vector3(...HALBERD.legFeet[i]);P.z-=0.04; // pad centre, just above the contact point
    const d=P.sub(H),L=d.length();d.normalize();
    const axis=new THREE.Vector3(0,0,-1).cross(d).normalize(),ang=Math.acos(-d.z);
    const g=new THREE.Group();g.position.copy(H);vis.add(g);
    const strut=(r0,r1,a,b,mat)=>{const geo=new THREE.CylinderGeometry(r1,r0,(b-a)*L,10);geo.rotateX(-Math.PI/2);geo.translate(0,0,-(a+b)/2*L);add(geo,mat,0,0,0,0,0,0,g)};
    strut(0.13,0.11,0,0.62,darkM);strut(0.075,0.075,0.55,1,plateM);
    add(new THREE.CylinderGeometry(0.15,0.15,0.1,12),accentM,0,0,-0.6*L,Math.PI/2,0,0,g); // collar where the lower leg slides out
    const pad=add(new THREE.CylinderGeometry(0.3,0.36,0.08,20),plateM,0,0,-L,0,0,0,g);
    pad.quaternion.setFromAxisAngle(axis,ang).invert().multiply(yToZ); // flat on the ground when deployed
    add(bbox(0.36,0.32,0.42,0.04),darkM,h[0],h[1],h[2]+0.1); // hinge housing
    legs.push({g,axis,ang});
  });
  const setLegs=k=>{const e=k*k*(3-2*k);for(const l of legs){l.g.visible=k>0;l.g.quaternion.setFromAxisAngle(l.axis,l.ang*e)}};
  setLegs(0);
  const winI=new THREE.InstancedMesh(new THREE.BoxGeometry(0.1,0.045,0.02),new THREE.MeshBasicMaterial({color:new THREE.Color(1.0,0.78,0.5),toneMapped:false}),winPos.length);
  const o3=new THREE.Object3D();winPos.forEach((p,i)=>{o3.position.set(p[0],p[1],p[2]);o3.rotation.set(0,p[3],0);o3.updateMatrix();winI.setMatrixAt(i,o3.matrix)});vis.add(winI);
  vis.traverse(m=>{if(m.isMesh&&m.material&&m.material.isMeshStandardMaterial){m.castShadow=true;m.receiveShadow=true}});
  const mats=new Set();vis.traverse(m=>{if(m.isMesh&&m.material&&m.material.isMeshStandardMaterial)mats.add(m.material)});
  return{root,vis,flames,glows,towerHide,strobe,dish,nav,eLight,setLegs,mats:[...mats],eye:new THREE.Vector3(0,TB+0.32,0.72)};
}

