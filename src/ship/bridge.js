// The cockpit: a separate small scene rendered over the world with its own camera,
// so its geometry is in local units (metres-ish, eye near the origin) and never touches world scale.
// Screens are canvases redrawn about 8 times a second from the flight state.
import * as THREE from 'three';
import {TAU,R,MOON_R,RING_IN,RING_OUT,RADAR_RANGE,WARPS,SHIP,MONO} from '../config.js';
import {clamp,fmt,lin,rng} from '../util.js';
import {ANISO,sunDir} from '../engine.js';
import {S,O,moonPos} from '../physics.js';

const zero=new THREE.Vector3(),tV=new THREE.Vector3(),mP=new THREE.Vector3(),invQ=new THREE.Quaternion();

export function buildBridge(env){
  const IS=new THREE.Scene();IS.environment=env;
  IS.add(new THREE.HemisphereLight(0x8fa6c8,0x1a1f28,0.9));
  const isun=new THREE.DirectionalLight(0xfff0dc,2.2);IS.add(isun);IS.add(isun.target);
  const glow=new THREE.PointLight(0x7cc4ff,0.6,1.4);glow.position.set(0,-0.3,-0.3);IS.add(glow);
  const frameM=new THREE.MeshStandardMaterial({color:lin(0x1c2027),roughness:0.7,metalness:0.4});
  const panelM=new THREE.MeshStandardMaterial({color:lin(0x2a3039),roughness:0.6,metalness:0.35});
  const trimM=new THREE.MeshStandardMaterial({color:lin(0x4a5461),roughness:0.42,metalness:0.6});
  const darkM=new THREE.MeshStandardMaterial({color:lin(0x111418),roughness:0.8,metalness:0.2});
  const amberM=new THREE.MeshStandardMaterial({color:lin(0xffb14a),roughness:0.4,metalness:0.2,emissive:lin(0x3a2200)});
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,parent=IS)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m};
  add(new THREE.BoxGeometry(2.8,0.1,0.14),frameM,0,0.41,-0.64);
  add(new THREE.BoxGeometry(2.8,0.07,0.16),trimM,0,-0.215,-0.63);
  [-0.42,0.42].forEach(x=>add(new THREE.BoxGeometry(0.05,0.62,0.07),frameM,x,0.095,-0.645));
  [-1,1].forEach(s=>{
    add(new THREE.BoxGeometry(0.07,0.62,0.08),frameM,s*1.08,0.095,-0.6,0,s*0.5,0);
    add(new THREE.BoxGeometry(0.06,0.06,0.8),frameM,s*1.22,0.38,-0.25);
    add(new THREE.BoxGeometry(0.06,0.06,0.8),frameM,s*1.22,-0.2,-0.25);
    add(new THREE.BoxGeometry(0.07,0.62,0.07),frameM,s*1.25,0.09,0.12);
    add(new THREE.BoxGeometry(0.04,1.4,0.5),panelM,s*1.3,-0.05,0.4);
    add(new THREE.BoxGeometry(0.04,0.55,0.8),panelM,s*1.24,-0.5,-0.25);
  });
  add(new THREE.BoxGeometry(2.8,0.04,1.4),panelM,0,0.47,-0.05);
  const stripM=new THREE.MeshBasicMaterial({color:lin(0xbfe0ff),toneMapped:false});
  [-0.35,0.35].forEach(x=>add(new THREE.BoxGeometry(0.025,0.012,1.0),stripM,x,0.448,-0.1));
  add(new THREE.BoxGeometry(2.8,1.4,0.04),panelM,0,-0.05,0.62);
  add(new THREE.BoxGeometry(2.8,0.04,1.5),darkM,0,-0.78,-0.05);
  add(new THREE.BoxGeometry(2.0,0.3,0.04),darkM,0,-0.68,-0.39);
  const con=new THREE.Group();con.position.set(0,-0.37,-0.5);con.rotation.x=-0.675;IS.add(con);
  add(new THREE.BoxGeometry(2.0,0.384,0.06),panelM,0,0,-0.03,0,0,0,con);
  add(new THREE.BoxGeometry(2.04,0.025,0.075),trimM,0,0.192,-0.02,0,0,0,con);
  function screen(w,h,cw,ch,x,y,parent){const c=document.createElement('canvas');c.width=cw;c.height=ch;const tex=new THREE.CanvasTexture(c);tex.anisotropy=ANISO;tex.encoding=THREE.sRGBEncoding;
    add(new THREE.BoxGeometry(w+0.03,h+0.03,0.012),darkM,x,y,0,0,0,0,parent);
    add(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}),x,y,0.0075,0,0,0,parent);
    return{c,g:c.getContext('2d'),tex}}
  const scrL=screen(0.32,0.2,512,320,-0.37,0.065,con);
  const scrR=screen(0.32,0.2,512,320,0.37,0.065,con);
  const radar=screen(0.24,0.24,384,384,0,0.055,con);
  const dials=[];
  function dial(x,y,label,sub,max){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
    g.fillStyle='#070d14';g.beginPath();g.arc(128,128,126,0,Math.PI*2);g.fill();
    g.strokeStyle='#cfe3f5';g.lineCap='round';
    for(let i=0;i<=20;i++){const a=(-225+i*13.5)*Math.PI/180,big=i%5===0;g.lineWidth=big?5:2.5;const r1=big?92:100;g.beginPath();g.moveTo(128+Math.cos(a)*r1,128+Math.sin(a)*r1);g.lineTo(128+Math.cos(a)*112,128+Math.sin(a)*112);g.stroke()}
    g.strokeStyle='#ff6b55';g.lineWidth=5;g.beginPath();g.arc(128,128,108,(-225+243)*Math.PI/180,(-225+270)*Math.PI/180);g.stroke();
    g.fillStyle='#ffb14a';g.font='600 30px '+MONO;g.textAlign='center';g.fillText(label,128,178);
    g.fillStyle='#7f9bb3';g.font='500 20px '+MONO;g.fillText(sub,128,206);g.fillText('0',62,200);g.fillText(String(max),196,200);
    const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
    add(new THREE.CircleGeometry(0.062,40),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}),x,y,0.004,0,0,0,con);
    add(new THREE.TorusGeometry(0.064,0.007,8,40),trimM,x,y,0.005,0,0,0,con);
    const ng=new THREE.BoxGeometry(0.004,0.05,0.003);ng.translate(0,0.022,0);
    const needle=add(ng,new THREE.MeshBasicMaterial({color:lin(0xffb14a),toneMapped:false}),x,y,0.009,0,0,0,con);
    add(new THREE.CylinderGeometry(0.007,0.007,0.006,12),trimM,x,y,0.011,Math.PI/2,0,0,con);
    const d={needle,v:0,max};dials.push(d);return d}
  const dSpeed=dial(-0.78,0.1,'SPEED','km/s',12),dAlt=dial(-0.78,-0.06,'ALT','x100 km',10),dThr=dial(0.78,0.1,'THRUST','%',100),dRea=dial(0.78,-0.06,'REACTOR','%',100);
  const buttons=[],palette=[0x30ff7a,0xffb14a,0x6fc8ff,0xff5a4a,0x6fc8ff,0x30ff7a];const br=rng(41);
  const btnMat=hex=>new THREE.MeshBasicMaterial({color:lin(hex),toneMapped:false});
  for(let i=0;i<21;i++){const col=palette[Math.floor(br()*palette.length)];const m=btnMat(col);
    add(new THREE.BoxGeometry(0.032,0.018,0.01),m,-0.6+i*0.06,-0.118,0.006,0,0,0,con);buttons.push({m,col:lin(col),on:true,rate:0.3+br()*2.2,phase:br()*6})}
  for(let i=0;i<14;i++)add(new THREE.BoxGeometry(0.03,0.02,0.012),trimM,-0.39+i*0.06,-0.155,0.006,0,0,0,con);
  [-1,1].forEach(s=>{const w=new THREE.Group();w.position.set(s*1.1,-0.34,-0.34);w.rotation.set(-0.7,-s*0.88,0,'YXZ');IS.add(w);
    add(new THREE.BoxGeometry(0.56,0.38,0.05),panelM,0,0,-0.025,0,0,0,w);
    const sc=screen(0.3,0.16,384,208,s*0.06,0.07,w);drawWing(sc,s);
    for(let r=0;r<3;r++)for(let k=0;k<6;k++){const col=palette[Math.floor(br()*palette.length)];const m=btnMat(col);
      add(new THREE.BoxGeometry(0.028,0.018,0.01),m,-0.2+k*0.05+s*0.03,-0.06-r*0.04,0.006,0,0,0,w);buttons.push({m,col:lin(col),on:true,rate:0.2+br()*1.5,phase:br()*6})}
  });
  add(new THREE.CylinderGeometry(0.035,0.04,0.025,16),trimM,0,-0.55,-0.27);
  const stickP=new THREE.Group();stickP.position.set(0,-0.54,-0.27);stickP.scale.setScalar(0.8);IS.add(stickP);
  const sg=new THREE.CylinderGeometry(0.011,0.013,0.15,10);sg.translate(0,0.075,0);add(sg,trimM,0,0,0,0,0,0,stickP);
  add(new THREE.CylinderGeometry(0.02,0.018,0.075,12),darkM,0,0.18,0,0,0,0,stickP);
  add(new THREE.SphereGeometry(0.009,10,8),btnMat(0xff3b30),0,0.22,-0.008,0,0,0,stickP);
  add(new THREE.BoxGeometry(0.07,0.03,0.16),trimM,0.34,-0.5,-0.3);
  const leverP=new THREE.Group();leverP.position.set(0.34,-0.485,-0.3);IS.add(leverP);
  const lg=new THREE.CylinderGeometry(0.009,0.009,0.12,8);lg.translate(0,0.06,0);add(lg,trimM,0,0,0,0,0,0,leverP);
  add(new THREE.BoxGeometry(0.05,0.03,0.036),amberM,0,0.125,0,0,0,0,leverP);
  const ret=new THREE.Group();ret.position.set(0,0.16,-0.6);IS.add(ret);
  const retM=new THREE.MeshBasicMaterial({color:lin(0xffb14a),transparent:true,opacity:0.7,depthWrite:false,toneMapped:false});
  add(new THREE.RingGeometry(0.016,0.0185,40),retM,0,0,0,0,0,0,ret);
  [[0.028,0,0.012,0.002],[-0.028,0,0.012,0.002],[0,0.028,0.002,0.012],[0,-0.028,0.002,0.012]].forEach(([x,y,w,h])=>add(new THREE.PlaneGeometry(w,h),retM,x,y,0,0,0,0,ret));
  return{IS,isun,scrL,scrR,radar,dSpeed,dAlt,dThr,dRea,dials,buttons,stickP,leverP};
}

function drawWing(sc,s){const g=sc.g,W=sc.c.width,H=sc.c.height;g.fillStyle='#05101a';g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(120,200,255,.3)';g.lineWidth=2;g.strokeRect(5,5,W-10,H-10);
  g.fillStyle='#ffb14a';g.font='600 22px '+MONO;g.fillText(s<0?'NAV':'COMMS',18,36);
  g.fillStyle='#8fb2cc';g.font='500 18px '+MONO;
  const rows=s<0?['SYSTEM  VEYRA','BODIES  2 + RING','JUMP    OFFLINE']:['CHANNEL  OPEN','CONTACTS NONE','BEACON   ACTIVE'];
  rows.forEach((r,i)=>g.fillText(r,18,80+i*34));sc.tex.needsUpdate=true}


function reactorPct(){return clamp(18+(S.aMain+S.aLift)/SHIP.aBoost*80,0,100)}
function frameBox(g,W,H,title,color){g.fillStyle='#05101a';g.fillRect(0,0,W,H);g.strokeStyle='rgba(120,200,255,.28)';g.lineWidth=2;g.strokeRect(6,6,W-12,H-12);
  g.fillStyle=color||'#ffb14a';g.font='600 20px '+MONO;g.textAlign='left';g.fillText(title,22,38);g.fillStyle='rgba(120,200,255,.18)';g.fillRect(22,50,W-44,2)}
function bar(g,x,y,w,h,v,col){g.fillStyle='rgba(120,200,255,.14)';g.fillRect(x,y,w,h);g.fillStyle=col;g.fillRect(x,y,w*clamp(v,0,1),h)}
function kmTxt(m){return m===Infinity?'ESCAPE':(m<0?'−':'')+fmt(Math.abs(m)/1000)}
function drawFlight(sc){const g=sc.g,W=512,H=320;frameBox(g,W,H,'FLIGHT · '+O.name.toUpperCase());
  const w=WARPS[S.warpIdx];const tag=w>1?'WARP '+fmt(w)+'×':(S.boostAmt>0.4?'BOOST':(S.heat>0.05?'HEATING':null));
  if(tag){g.fillStyle=S.heat>0.05&&w===1?'#ff6b55':'#ffb14a';g.fillRect(W-170,20,148,26);g.fillStyle='#2a1700';g.font='600 16px '+MONO;g.fillText(tag,W-160,39)}
  g.fillStyle='#7f9bb3';g.font='500 16px '+MONO;g.fillText('SPEED M/S',22,80);g.fillText('ALT KM',300,80);
  g.fillStyle='#e3f2ff';g.font='500 42px '+MONO;g.fillText(fmt(O.speed),22,124);g.font='500 30px '+MONO;g.fillText(fmt(O.alt/1000),300,122);
  g.fillStyle='#7f9bb3';g.font='500 16px '+MONO;g.fillText('VERT',22,166);g.fillText('AP KM',190,166);g.fillText('PE KM',350,166);
  g.font='500 22px '+MONO;g.fillStyle='#e3f2ff';g.fillText((O.vv<0?'−':'+')+fmt(Math.abs(O.vv)),22,196);g.fillText(kmTxt(O.ap),190,196);g.fillStyle=O.pe<0?'#ff6b55':'#e3f2ff';g.fillText(kmTxt(O.pe),350,196);
  g.fillStyle='#7f9bb3';g.font='500 16px '+MONO;g.fillText((S.hover?'LIFT ':'THRUST ')+Math.round(S.throttle*100)+'%',22,246);bar(g,22,258,W-44,16,(S.aMain+S.aLift)/SHIP.aBoost,'#ffb14a');
  sc.tex.needsUpdate=true}
function drawShip(sc){const g=sc.g,W=512,H=320;frameBox(g,W,H,SHIP.name.toUpperCase());
  const rows=[['HULL','100%',1,'#30ff7a'],['REACTOR',Math.round(reactorPct())+'%',reactorPct()/100,'#6fc8ff']];
  rows.forEach((r,i)=>{const y=86+i*50;g.fillStyle='#7f9bb3';g.font='500 17px '+MONO;g.fillText(r[0],22,y);g.fillStyle='#e3f2ff';g.textAlign='right';g.fillText(r[1],W-22,y);g.textAlign='left';bar(g,22,y+10,W-44,10,r[2],r[3])});
  g.font='500 17px '+MONO;
  const st=[['SUNLIGHT',S.lit>0.5?'DAY':'ECLIPSE',S.lit>0.5?'#e3f2ff':'#ffb14a'],['HOLD',S.hold==='pro'?'PROGRADE':S.hold==='retro'?'RETROGRADE':S.hold==='planet'?'VEYRA':S.hold==='moon'?'TAL':'OFF',S.hold?'#b9f06e':'#7f9bb3'],['SHIELDS','STANDBY','#ffb14a']];
  st.forEach((r,i)=>{const y=200+i*34;g.fillStyle='#7f9bb3';g.fillText(r[0],22,y);g.fillStyle=r[2];g.textAlign='right';g.fillText(r[1],W-22,y);g.textAlign='left'});
  sc.tex.needsUpdate=true}
const rp=new THREE.Vector3();
function drawRadar(sc,rt){const g=sc.g,W=384,c=192,r=172;
  g.fillStyle='#04101a';g.fillRect(0,0,W,W);g.strokeStyle='rgba(111,200,255,.25)';g.lineWidth=2;
  for(let i=1;i<=3;i++){g.beginPath();g.arc(c,c,r*i/3,0,TAU);g.stroke()}
  g.beginPath();g.moveTo(c-r,c);g.lineTo(c+r,c);g.moveTo(c,c-r);g.lineTo(c,c+r);g.stroke();
  const sw=rt*1.4;for(let i=0;i<14;i++){const a=sw-i*0.05;g.strokeStyle='rgba(111,220,255,'+(0.5-i*0.035)+')';g.beginPath();g.moveTo(c,c);g.lineTo(c+Math.cos(a)*r,c+Math.sin(a)*r);g.stroke()}
  invQ.copy(S.quat).invert();
  const toScope=w=>{rp.copy(w).sub(S.pos).applyQuaternion(invQ);let x=rp.x/RADAR_RANGE*r,y=rp.z/RADAR_RANGE*r;const l=Math.hypot(x,y);let edge=false;if(l>r-8){x*=(r-8)/l;y*=(r-8)/l;edge=true}return{x:c+x,y:c+y,edge}};
  const pp2=toScope(zero);
  g.setLineDash([6,6]);g.strokeStyle='rgba(180,170,150,.45)';g.beginPath();g.arc(pp2.x,pp2.y,(RING_IN+RING_OUT)/2/RADAR_RANGE*r,0,TAU);g.stroke();g.setLineDash([]);
  const drawBody=(p,rad,col,name)=>{const pr=Math.max(4,rad/RADAR_RANGE*r);g.fillStyle=col;g.strokeStyle=col;g.lineWidth=2;
    if(p.edge){g.beginPath();g.arc(p.x,p.y,6,0,TAU);g.stroke()}else{g.beginPath();g.arc(p.x,p.y,pr,0,TAU);g.fill()}
    g.font='500 16px '+MONO;g.textAlign='center';g.fillText(name,p.x,p.y-(p.edge?10:pr+8));g.textAlign='left'};
  drawBody(pp2,R,'#4f9fd6','VEYRA');drawBody(toScope(moonPos(S.t,mP)),MOON_R,'#b9b5aa','TAL');
  const sp=toScope(tV.copy(S.pos).addScaledVector(sunDir,RADAR_RANGE*3));g.fillStyle='#ffd27a';g.beginPath();g.arc(sp.x,sp.y,7,0,TAU);g.fill();
  g.fillStyle='#ffb14a';g.beginPath();g.moveTo(c,c-11);g.lineTo(c+8,c+8);g.lineTo(c-8,c+8);g.closePath();g.fill();
  g.fillStyle='#7f9bb3';g.font='500 15px '+MONO;g.fillText('RANGE '+fmt(RADAR_RANGE/1e6)+'K KM',14,W-14);
  sc.tex.needsUpdate=true}

let screenT=0,blinkT=0;const offCol=lin(0x1a2028);
export function updateBridge(b,dt,rt){
  invQ.copy(S.quat).invert();
  b.isun.position.copy(sunDir).applyQuaternion(invQ).multiplyScalar(5);b.isun.intensity=2.2*S.lit;
  const vals=[[b.dSpeed,O.speed/1000],[b.dAlt,O.alt/1e5],[b.dThr,(S.aMain+S.aLift)/SHIP.aMain*100],[b.dRea,reactorPct()]];
  for(const [d,v] of vals){const target=clamp(v/d.max,0,1);d.v+=(target-d.v)*(1-Math.exp(-dt*5));d.needle.rotation.z=2.356-d.v*4.712}
  const sk=1-Math.exp(-dt*10);
  b.stickP.rotation.x+=(S.inPitch*0.32-b.stickP.rotation.x)*sk;b.stickP.rotation.z+=(-S.inYaw*0.32-b.stickP.rotation.z)*sk;
  b.leverP.rotation.x+=((0.55-S.throttle*1.1)-b.leverP.rotation.x)*sk;
  blinkT+=dt;if(blinkT>0.12){blinkT=0;for(const btn of b.buttons){const on=Math.sin(rt*btn.rate+btn.phase)>-0.6;if(on!==btn.on){btn.on=on;btn.m.color.copy(on?btn.col:offCol)}}}
  screenT+=dt;if(screenT>0.12){screenT=0;drawFlight(b.scrL);drawShip(b.scrR);drawRadar(b.radar,rt)}
}

