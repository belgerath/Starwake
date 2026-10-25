// GLSL sources. Bake passes render cube maps once at load; the *_FRAG shaders draw every frame.
// Planet surface detail comes from these noise functions. noise.js is a JS port used for terrain
// meshes and collision: change NOISE or MOON_H and you must change noise.js / tal.js to match
// (npm run check:tal compares them on a real GPU).

export const NOISE=`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
float mod289(float x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
float permute(float x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
// Simplex noise. The gradient flip (sh) is an exact integer test that gives the same answer as
// IEEE float32 sign(h): "h<=0" sits right on the rounding edge for 7 of the 49 gradients.
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(14.5,abs(4.0*x_-13.0)+abs(4.0*y_-13.0)+0.5*step(10.0,x_+y_));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p,int oct){float s=0.0,a=0.5;for(int i=0;i<10;i++){if(i>=oct)break;s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.4);a*=0.5;}return s;}
float ridged(vec3 p,int oct){float s=0.0,a=0.5,w=1.0;for(int i=0;i<10;i++){if(i>=oct)break;float n=1.0-abs(snoise(p));n*=n;n*=w;w=clamp(n*1.6,0.0,1.0);s+=a*n;p=p*2.1+vec3(3.1,1.7,8.3);a*=0.5;}return s;}
// Cell hash in [0,1)^3. With WebGL2 it is pcg3d (Jarzynski and Olano 2020) in exact integer arithmetic,
// so every GPU and noise.js agree. WebGL1 has no integers and falls back to the permutation polynomial.
// (The usual fract(sin(x)*43758.5) depends on how each GPU computes sin, which moved Tal's craters.)
#if __VERSION__ >= 300
vec3 hash3(vec3 p){uvec3 v=uvec3(ivec3(p))*1664525u+1013904223u;
  v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;v^=v>>16u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;
  return vec3(v>>8u)*(1.0/16777216.0);}
#else
vec3 hash3(vec3 p){p=mod289(p);float a=permute(permute(permute(p.x)+p.y)+p.z);float b=permute(a+101.0);float c=permute(b+37.0);return vec3(a,b,c)*(1.0/289.0);}
#endif
// Shallow bowl (floor -0.9 rad) with a steep inner wall up to the rim crest (+0.35 rad), which falls
// away gently outside. Continuous at the rim: no cliff up close, and the JS port agrees with the GPU.
float craters(vec3 p,float density){vec3 i=floor(p);vec3 f=fract(p);float h=0.0;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(float(x),float(y),float(z));vec3 o=hash3(i+g);if(o.z>density)continue;vec3 r=g+o-f;float dd=length(r);float rad=0.18+0.3*o.x;float t=dd/rad;
    if(t<1.0){float t2=t*t,t4=t2*t2,t8=t4*t4;h+=(1.25*(0.3*t2+0.7*t8*t8)-0.9)*rad;}else h+=rad*0.35*exp(-(t-1.0)*(t-1.0)*12.0);}
  return h;}
`;
export const BAKE_HEAD=`
uniform float face;uniform float res;
vec3 faceDir(vec2 uv){vec2 p=uv*2.0-1.0;
  if(face<0.5)return normalize(vec3(1.0,-p.y,-p.x));
  if(face<1.5)return normalize(vec3(-1.0,-p.y,p.x));
  if(face<2.5)return normalize(vec3(p.x,1.0,p.y));
  if(face<3.5)return normalize(vec3(p.x,-1.0,-p.y));
  if(face<4.5)return normalize(vec3(p.x,-p.y,1.0));
  return normalize(vec3(-p.x,-p.y,-1.0));}
vec2 encodeH(float h){float v=clamp(h*0.5+0.5,0.0,1.0)*65535.0;float hi=floor(v/256.0);float lo=floor(v-hi*256.0);return vec2(hi/255.0,lo/255.0);}
float decodeH(vec4 t){return((floor(t.r*255.0+0.5)*256.0+floor(t.g*255.0+0.5))/65535.0)*2.0-1.0;}
`+NOISE;
export const PLANET_H=`uniform vec3 seed;uniform float bias;
void main(){vec3 d=faceDir(gl_FragCoord.xy/res);
  vec3 q=d*1.15+seed;
  vec3 w=vec3(fbm(q+vec3(1.7,9.2,3.1),4),fbm(q+vec3(8.3,2.8,5.4),4),fbm(q+vec3(4.1,6.3,7.7),4));
  float c=fbm(q+w*0.75,7)+bias;
  float m=ridged(d*3.0+seed*1.31,6);
  float h=c+m*0.55*smoothstep(0.02,0.3,c);
  h+=fbm(d*22.0+seed,4)*0.03;
  float moist=clamp(fbm(d*2.4+seed+vec3(5.0,1.0,3.0),5)*0.9+0.5,0.0,1.0);
  gl_FragColor=vec4(encodeH(h),moist,1.0);}`;
export const PLANET_ALB=`uniform samplerCube H;uniform vec3 seed;
void main(){vec3 d=faceDir(gl_FragCoord.xy/res);vec4 t=textureCube(H,d);float h=decodeH(t);float moist=t.b;float lat=abs(d.y);
  float n=snoise(d*40.0+seed)*0.5+snoise(d*130.0)*0.25;
  float hl=max(h,0.0);
  vec3 desert=vec3(0.70,0.60,0.42),grass=vec3(0.34,0.46,0.22),forest=vec3(0.14,0.27,0.12),rock=vec3(0.40,0.36,0.31),snow=vec3(0.93,0.95,0.97),sand=vec3(0.76,0.70,0.54),tundra=vec3(0.44,0.43,0.35);
  float m=clamp(moist+n*0.08,0.0,1.0);
  vec3 col=mix(desert,grass,smoothstep(0.36,0.55,m));col=mix(col,forest,smoothstep(0.58,0.74,m));
  col=mix(col,tundra,smoothstep(0.6,0.75,lat+n*0.05));
  col=mix(col,rock,smoothstep(0.26,0.48,hl+n*0.04));
  col=mix(sand,col,smoothstep(0.0,0.02,hl));
  float sl=0.62-lat*0.55+n*0.05;col=mix(col,snow,smoothstep(sl,sl+0.06,hl));
  col=mix(col,snow,smoothstep(0.84,0.9,lat+n*0.04));
  col*=0.92+n*0.12;
  float ice=smoothstep(0.88,0.92,lat+n*0.03);
  gl_FragColor=vec4(col,ice);}`;
export const NORMAL_PASS=`uniform samplerCube H;uniform float k;uniform float flatSea;
float hs(vec3 dir){float h=decodeH(textureCube(H,dir));return flatSea>0.5?max(h,0.0):h;}
void main(){vec2 uv=gl_FragCoord.xy/res;float e=1.0/res;vec3 d=faceDir(uv);
  vec3 a1=faceDir(uv+vec2(e,0.0)),a0=faceDir(uv-vec2(e,0.0)),b1=faceDir(uv+vec2(0.0,e)),b0=faceDir(uv-vec2(0.0,e));
  vec3 n=normalize(cross(a1*(1.0+hs(a1)*k)-a0*(1.0+hs(a0)*k),b1*(1.0+hs(b1)*k)-b0*(1.0+hs(b0)*k)));
  if(dot(n,d)<0.0)n=-n;
  gl_FragColor=vec4(clamp((n-d)*2.0,-1.0,1.0)*0.5+0.5,clamp(decodeH(textureCube(H,d))*0.5+0.5,0.0,1.0));}`;
export const CLOUD_PASS=`uniform vec3 seed;
void main(){vec3 d=faceDir(gl_FragCoord.xy/res);vec3 q=d*2.0+seed;
  vec3 w=vec3(fbm(q,3),fbm(q+vec3(3.1,1.2,7.4),3),fbm(q+vec3(9.1,4.2,1.3),3));
  float c=fbm(q*1.6+w*1.3,7);float lat=abs(d.y);
  c+=-0.06+0.12*smoothstep(0.15,0.55,lat)*(1.0-smoothstep(0.75,0.95,lat));
  float dens=smoothstep(0.04,0.42,c)*(0.75+0.25*(snoise(d*45.0)*0.5+0.5));
  gl_FragColor=vec4(dens,dens,dens,1.0);}`;
export const MOON_H=`uniform vec3 seed;
void main(){vec3 d=faceDir(gl_FragCoord.xy/res);
  float h=fbm(d*1.8+seed,6)*0.25+craters(d*3.0+seed,0.5)*0.8+craters(d*7.0+seed*1.7,0.6)*0.45+craters(d*16.0+seed*2.3,0.7)*0.22+craters(d*38.0,0.75)*0.1;
  float mare=fbm(d*1.2+seed+vec3(7.0),4);
  gl_FragColor=vec4(encodeH(h*0.6),clamp(mare*0.8+0.5,0.0,1.0),1.0);}`;
export const MOON_ALB=`uniform samplerCube H;
void main(){vec3 d=faceDir(gl_FragCoord.xy/res);vec4 t=textureCube(H,d);float h=decodeH(t);float m=t.b;
  float n=snoise(d*60.0)*0.5+snoise(d*180.0)*0.25;
  vec3 col=mix(vec3(0.62,0.60,0.57),vec3(0.29,0.29,0.30),smoothstep(0.5,0.62,m));
  col*=0.9+n*0.12+h*0.2;
  gl_FragColor=vec4(col,m);}`; // alpha: the mare factor, which the terrain shader uses to rebuild this colour per pixel

export const SURF_VERT=`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj;varying vec3 vW;
void main(){vObj=position;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;
#include <logdepthbuf_vertex>
}`;
export const PLANET_FRAG=`#include <logdepthbuf_pars_fragment>
uniform samplerCube albedoMap;uniform samplerCube normalMap;uniform samplerCube cloudMap;
uniform float hasClouds;uniform float hasOcean;uniform float cloudDelta;uniform float sunI;uniform float atmoStrength;uniform vec3 sunDir;uniform vec3 atmoColor;uniform mat3 objRot;
varying vec3 vObj;varying vec3 vW;
`+NOISE+`
vec3 rotY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
void main(){
#include <logdepthbuf_fragment>
  vec3 d=normalize(vObj);vec4 A=textureCube(albedoMap,d);vec4 Nt=textureCube(normalMap,d);
  vec3 nObj=normalize(d+(Nt.xyz*2.0-1.0)*0.5);
  float px=length(fwidth(d));float detF=1.0-smoothstep(0.0005,0.002,px);
  float n1=0.0;if(detF>0.0){n1=snoise(d*900.0)*0.65+snoise(d*2700.0)*0.35;}
  float hh=Nt.a*2.0-1.0;
  float land=hasOcean>0.5?smoothstep(-0.003,0.003,hh+n1*0.01*detF):1.0;
  vec3 landC=pow(A.rgb,vec3(2.2))*(1.0+n1*0.08*detF);
  float depth=clamp(-hh/0.35,0.0,1.0);
  vec3 oceanC=pow(mix(vec3(0.16,0.46,0.58),vec3(0.03,0.10,0.24),pow(depth,0.55)),vec3(2.2));
  float ice=hasOcean>0.5?A.a*(1.0-land):0.0;
  oceanC=mix(oceanC,vec3(0.72,0.79,0.84),ice);
  vec3 alb=mix(oceanC,landC,land);
  float specMask=hasOcean>0.5?(1.0-land)*(1.0-ice):0.0;
  vec3 N=normalize(objRot*mix(d,nObj,land)),Ng=normalize(objRot*d);
  vec3 L=normalize(sunDir),V=normalize(cameraPosition-vW);float geo=dot(Ng,L);
  float diff=max(dot(N,L),0.0)*smoothstep(-0.06,0.1,geo);
  if(hasClouds>0.5){float cs=textureCube(cloudMap,rotY(d,cloudDelta)).r;diff*=1.0-cs*0.6;}
  float nh=max(dot(N,normalize(L+V)),0.0);
  float spec=(pow(nh,900.0)*1.6+pow(nh,60.0)*0.08)*specMask*smoothstep(0.0,0.15,geo);
  vec3 sunC=vec3(1.0,0.97,0.92)*sunI;
  vec3 col=alb*diff*sunC+spec*sunC+alb*0.003;
  float mu=max(dot(Ng,V),0.0);float fres=pow(1.0-mu,3.0);float dayA=smoothstep(-0.3,0.3,geo);
  col=mix(col,atmoColor*sunI*0.35*dayA,clamp(fres*0.85,0.0,1.0)*atmoStrength)+atmoColor*0.05*dayA*atmoStrength;
  gl_FragColor=vec4(col,1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
export const CLOUD_FRAG=`#include <logdepthbuf_pars_fragment>
uniform samplerCube cloudMap;uniform vec3 sunDir;uniform float sunI;uniform mat3 objRot;
varying vec3 vObj;varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
  vec3 d=normalize(vObj);float c=textureCube(cloudMap,d).r;vec3 Ng=normalize(objRot*d);
  float lit=smoothstep(-0.1,0.3,dot(Ng,normalize(sunDir)));vec3 V=normalize(cameraPosition-vW);float edge=smoothstep(0.0,0.25,abs(dot(Ng,V)));
  gl_FragColor=vec4(vec3(1.0,0.985,0.96)*sunI*0.8*lit+vec3(0.002),c*0.92*edge);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
export const ATMO_FRAG=`#include <logdepthbuf_pars_fragment>
uniform vec3 center;uniform vec3 sunDir;uniform vec3 cDay;uniform vec3 cSet;uniform float Rp;uniform float Ra;uniform float intensity;
varying vec3 vObj;varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
  vec3 o=cameraPosition;vec3 dir=normalize(vW-o);float t=max(dot(center-o,dir),0.0);vec3 p=o+dir*t;float d=length(p-center);
  float x=clamp((d-Rp)/(Ra-Rp),0.0,1.0);float dens=exp(-x*4.0)*(1.0-x);
  float s=dot(normalize(p-center),normalize(sunDir));float day=smoothstep(-0.3,0.2,s);
  gl_FragColor=vec4(mix(cSet,cDay,smoothstep(-0.05,0.3,s))*day*dens*intensity,1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
export const RING_FRAG=`#include <logdepthbuf_pars_fragment>
uniform vec3 center;uniform vec3 L;uniform vec3 ringN;uniform float Rp;uniform float Rin;uniform float Rout;uniform float sunI;uniform float fade;
varying vec3 vObj;varying vec3 vW;
float ringDens(float u,float fw){
  if(u<0.0||u>1.0)return 0.0;
  float edge=smoothstep(0.0,0.04,u)*(1.0-smoothstep(0.95,1.0,u));
  float prof=mix(0.16,0.95,smoothstep(0.22,0.3,u));prof=mix(prof,0.55,smoothstep(0.585,0.6,u));
  float b=prof*(0.78+0.12*sin(u*91.0+0.4)*(1.0-smoothstep(0.004,0.02,fw))+0.1*sin(u*233.0+2.1)*(1.0-smoothstep(0.0015,0.008,fw))+0.08*sin(u*577.0)*(1.0-smoothstep(0.0006,0.003,fw))+0.06*sin(u*1531.0+1.0)*(1.0-smoothstep(0.0002,0.001,fw)));
  float gap=1.0-0.95*exp(-pow((u-0.615)/0.013,2.0))-0.8*exp(-pow((u-0.88)/0.003,2.0));
  return clamp(edge*b*gap,0.0,1.0);}
void main(){
#include <logdepthbuf_fragment>
  float r=length(vObj.xz);float u=(r-Rin)/(Rout-Rin);
  float dens=ringDens(u,fwidth(u));
  vec3 p=vW-center;float s=dot(p,L);float perp=length(p-s*L);
  float sh=s<0.0?smoothstep(Rp*0.995,Rp*1.01,perp):1.0;
  vec3 V=normalize(cameraPosition-vW);float cv=max(abs(dot(ringN,V)),0.02);
  float same=(dot(ringN,L)*dot(ringN,V))>0.0?1.0:0.3;
  vec3 col=mix(vec3(0.62,0.56,0.47),vec3(0.80,0.73,0.62),dens)*sunI*0.34*same*sh+vec3(0.002);
  float a=min(1.0-pow(1.0-dens*0.55,1.0/cv),0.8);
  gl_FragColor=vec4(col,a*fade);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;

// Tal's ground (terrain.js). Chunk vertices are relative to the chunk centre; modelViewMatrix is
// composed in doubles by three.js, so positions near the camera stay precise. Normals and vDir are in
// Tal's body frame: vDir picks the baked colour and normal maps. The ship's shadow comes from the sun's
// shadow map (three.js chunks; the material has lights on).
export const TERRAIN_VERT=`#include <common>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
uniform vec3 moonC;uniform mat3 objRot;uniform float moonR;
varying vec3 vDir;varying vec3 vN;varying vec3 vW;varying float vH;
void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec3 b=(w.xyz-moonC)*objRot;vDir=b;vH=length(b)-moonR;vN=normal;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
#include <logdepthbuf_vertex>
#if defined(USE_SHADOWMAP)&&NUM_DIR_LIGHT_SHADOWS>0
  vDirectionalShadowCoord[0]=directionalShadowMatrix[0]*(w+vec4(normalize(objRot*normal)*directionalLightShadows[0].shadowNormalBias,0.0));
#endif
}`;
// Lighting as Tal always had. The baked maps have texels about 5 km across, so up close they would be
// blocky: there the colour is worked out per pixel from the bake's own formula (MOON_ALB), the shape
// comes from the mesh (with detail down to small craters), and fine noise varies the colour as you get
// closer. Bump-mapped lighting was tried: at grazing angles it sparkles along triangle edges.
// mpp is metres per pixel, from distance and viewing angle (pixAng is one pixel's angle) rather than
// screen derivatives, which jump at triangle edges and would switch detail on and off along them.
export const TERRAIN_FRAG=`#include <common>
#include <logdepthbuf_pars_fragment>
#include <packing>
#include <shadowmap_pars_fragment>
uniform samplerCube albedoMap;uniform samplerCube normalMap;uniform float sunI;uniform float relief;uniform float pixAng;uniform vec3 sunDir;uniform mat3 objRot;
varying vec3 vDir;varying vec3 vN;varying vec3 vW;varying float vH;
`+NOISE+`
void main(){
#include <logdepthbuf_fragment>
  vec3 d=normalize(vDir),Ng=normalize(objRot*d),V=cameraPosition-vW;float dist=length(V);
  float mpp=dist*pixAng/max(abs(dot(Ng,V/dist)),0.2);
  vec4 A=textureCube(albedoMap,d);vec3 col=A.rgb;float tex=smoothstep(1500.0,5000.0,mpp);
  if(tex<1.0){float n=snoise(d*60.0)*0.5+snoise(d*180.0)*0.25;
    vec3 c=mix(vec3(0.62,0.60,0.57),vec3(0.29,0.29,0.30),smoothstep(0.5,0.62,A.a))*(0.9+n*0.12+vH/relief*0.2);
    col=mix(c,A.rgb,tex);}
  // Five octaves, 1.8 km down to 22 m across; each fades in once it spans more than a few pixels.
  float cd=0.0,lam=1800.0,f=900.0;
  for(int k=0;k<5;k++){float w=1.0-smoothstep(lam*0.1,lam*0.3,mpp);
    if(w>0.0)cd+=snoise(d*f+vec3(float(k)*31.7))*w;
    lam/=3.0;f*=3.0;}
  col*=1.0+cd*0.06;
  vec3 Nm=normalize(objRot*normalize(vN)),Nt=normalize(objRot*normalize(d+(textureCube(normalMap,d).xyz*2.0-1.0)*0.5));
  vec3 N=normalize(mix(Nm,Nt,smoothstep(300.0,1200.0,mpp)));
  vec3 L=normalize(sunDir);
  float diff=max(dot(N,L),0.0)*smoothstep(-0.06,0.1,dot(Ng,L));
#if defined(USE_SHADOWMAP)&&NUM_DIR_LIGHT_SHADOWS>0
  // The ship's shadow. Not black: sunlit ground all around bounces some light into it.
  diff*=mix(0.12,1.0,getShadow(directionalShadowMap[0],directionalLightShadows[0].shadowMapSize,directionalLightShadows[0].shadowBias,directionalLightShadows[0].shadowRadius,vDirectionalShadowCoord[0]));
#endif
  vec3 alb=pow(col,vec3(2.2));
  gl_FragColor=vec4(alb*diff*vec3(1.0,0.97,0.92)*sunI+alb*0.003,1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;

// ---- sky (sky.js) ----
// Stars as round points. Brightness from magnitude is compressed (a screen cannot show the sky's
// 1000:1 range as points) and scaled by exposure; stars too faint to see right now are skipped.
export const STAR_VERT=`attribute float mag;attribute vec3 starColor;
uniform float exposure;uniform float pxScale;
varying vec3 vCol;varying float vI;varying float vK;
void main(){float L=pow(10.0,-0.4*(mag-1.0));
  vI=min(1.6,1.1*pow(L,0.55))*exposure;vCol=starColor;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  float size=(1.3+3.4*pow(L,0.3)*sqrt(exposure))*pxScale; // faint stars are pinpoints
  vK=mix(1.0,6.0,smoothstep(2.5*pxScale,7.0*pxScale,size)); // tiny points need a flat profile to show at all
  if(vI<0.012)gl_Position=vec4(2.0,2.0,2.0,1.0);
  gl_PointSize=size;}`;
export const STAR_FRAG=`varying vec3 vCol;varying float vI;varying float vK;
void main(){vec2 p=gl_PointCoord*2.0-1.0;float r2=dot(p,p);if(r2>1.0)discard;
  float f=exp(-r2*vK)+0.15*exp(-r2*1.8)*smoothstep(0.4,1.3,vI); // core, plus a soft halo on the brightest
  gl_FragColor=vec4(vCol*min(vI,1.0)*f,1.0);
#include <encodings_fragment>
}`;
// The Milky Way glow, from the baked cube map, which holds the square root of 0.4 × the brightness so
// that 8 bits still give smooth gradients in the dark.
export const SKY_VERT=`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
export const SKY_FRAG=`uniform samplerCube map;uniform float exposure;uniform float intensity;varying vec3 vDir;
void main(){vec3 c=textureCube(map,normalize(vDir)).rgb;gl_FragColor=vec4(c*c*intensity*exposure,1.0);
#include <encodings_fragment>
}`;
// Bake: the galaxy seen edge-on from inside. A band along the plane (gN is its pole), brighter and
// thicker toward the centre (gC), with patchy star clouds and dark dust lanes that run along the band
// (their noise is sampled on a cylinder squashed across the band), a golden bulge at the centre and
// blue-white arms.
export const MILKY_WAY=`uniform vec3 gN;uniform vec3 gC;
void main(){vec3 d=faceDir(gl_FragCoord.xy/res);vec3 e=normalize(cross(gN,gC));
  float b=asin(clamp(dot(d,gN),-1.0,1.0)),l=atan(dot(d,e),dot(d,gC));
  vec3 q=vec3(cos(l),sin(l),b*1.8);
  float core=exp(-l*l/0.5),w=0.11+0.10*core,band=exp(-b*b/(w*w));
  float clouds=0.45+0.75*(fbm(q*2.6+vec3(2.1,7.3,4.4),6)*0.5+0.5),grain=0.8+0.4*(fbm(d*18.0+vec3(9.1),4)*0.5+0.5);
  float lane=smoothstep(0.5,0.9,ridged(q*vec3(2.6,2.6,3.2)+vec3(5.5,1.3,8.8),5))*exp(-b*b/(0.3*w*w));
  float I=band*(0.35+0.65*core)*clouds*grain*(1.0-0.85*lane)+exp(-(l*l+b*b*5.0)/0.06)*1.6+0.015*exp(-b*b/0.6);
  vec3 col=mix(mix(vec3(0.82,0.88,1.0),vec3(1.0,0.84,0.62),core*0.9),vec3(0.45,0.33,0.25),lane*0.5);
  gl_FragColor=vec4(sqrt(clamp(col*I*0.4,0.0,1.0)),1.0);}`; // 0.4: headroom for the bright core
