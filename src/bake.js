// Renders a fragment shader into the 6 faces of a cube map, once, at load.
// Used to generate planet height, colour, normal and cloud maps on the GPU.
import * as THREE from 'three';
import {renderer} from './engine.js';
import {BAKE_HEAD} from './shaders.js';

const bakeGeo = new THREE.PlaneGeometry(2, 2), bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function bake(size, frag, uniforms, nearest) {
  const rt = new THREE.WebGLCubeRenderTarget(size, {format: THREE.RGBAFormat, type: THREE.UnsignedByteType, generateMipmaps: !nearest, minFilter: nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter, magFilter: nearest ? THREE.NearestFilter : THREE.LinearFilter});
  const mat = new THREE.ShaderMaterial({uniforms: Object.assign({face: {value: 0}, res: {value: size}}, uniforms), vertexShader: 'void main(){gl_Position=vec4(position.xy,0.0,1.0);}', fragmentShader: BAKE_HEAD + frag, depthTest: false, depthWrite: false});
  const q = new THREE.Mesh(bakeGeo, mat); q.frustumCulled = false; const s = new THREE.Scene(); s.add(q);
  for (let f = 0; f < 6; f++) { mat.uniforms.face.value = f; renderer.setRenderTarget(rt, f); renderer.render(s, bakeCam); }
  renderer.setRenderTarget(null); mat.dispose(); return rt;
}
