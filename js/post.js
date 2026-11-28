// Film look for the 3D world, applied after the scene is drawn: a soft glow (bloom) around the sun
// and the glitter on the water, light shafts streaming from the sun past clouds and islands, filmic
// tone mapping, a gentle warm/teal colour grade, a vignette and fine grain.
// The scene is drawn in high dynamic range into a texture; everything here works from that.
import * as THREE from '../vendor/three.module.min.js';

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

function pass(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

/** Creates the post-processing chain. Call render(renderer, drawScene) each frame. */
export function createPost(renderer, mobile) {
  const opts = { type: THREE.HalfFloatType, depthBuffer: false };
  const hdr = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const bright = new THREE.WebGLRenderTarget(4, 4, opts);  // 1/4 size: the brightest parts
  const blurA = new THREE.WebGLRenderTarget(4, 4, opts), blurB = new THREE.WebGLRenderTarget(4, 4, opts);
  const wideA = new THREE.WebGLRenderTarget(4, 4, opts), wideB = new THREE.WebGLRenderTarget(4, 4, opts); // 1/8 size
  const rays = new THREE.WebGLRenderTarget(4, 4, opts);

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const brightMat = pass(`uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
    void main(){
      vec3 c = vec3(0.);
      for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 1 || i == 3 ? 1. : -1., i >= 2 ? 1. : -1.) * texel; c += texture2D(tSrc, vUv + o).rgb; }
      c *= .25;
      float l = dot(c, vec3(.2126, .7152, .0722));
      gl_FragColor = vec4(c * smoothstep(.9, 1.8, l), 1.);
    }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });

  const blurMat = pass(`uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb * .227;
      c += (texture2D(tSrc, vUv + dir * 1.385).rgb + texture2D(tSrc, vUv - dir * 1.385).rgb) * .316;
      c += (texture2D(tSrc, vUv + dir * 3.231).rgb + texture2D(tSrc, vUv - dir * 3.231).rgb) * .07;
      gl_FragColor = vec4(c, 1.);
    }`, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });

  // Light shafts: blur the bright pass outward from the sun's position on screen
  const raysMat = pass(`uniform sampler2D tSrc; uniform vec2 sun; uniform float strength; varying vec2 vUv;
    void main(){
      vec2 d = (vUv - sun) * (1. / 40.) * .9;
      vec2 uv = vUv; float w = 1.; vec3 c = vec3(0.);
      for (int i = 0; i < 40; i++) { uv -= d; c += texture2D(tSrc, uv).rgb * w; w *= .955; }
      gl_FragColor = vec4(c * strength / 20., 1.);
    }`, { tSrc: { value: null }, sun: { value: new THREE.Vector2(0.5, 0.5) }, strength: { value: 0 } });

  const finalMat = pass(`uniform sampler2D tSrc, tBloom, tWide, tRays; uniform float exposure, time, warm, night; uniform vec2 res;
    varying vec2 vUv;
    vec3 twFit(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }
    vec3 twAces(vec3 c){
      const mat3 inM = mat3(.59719, .07600, .02840, .35458, .90834, .13383, .04823, .01566, .83777);
      const mat3 outM = mat3(1.60475, -.10208, -.00327, -.53108, 1.10813, -.07276, -.07367, -.00605, 1.07602);
      c = outM * twFit(inM * (c * exposure / .6)); return clamp(c, 0., 1.);
    }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      // a whisper of lens fringing toward the edges
      vec2 off = (vUv - .5) * .0016;
      vec3 c = vec3(texture2D(tSrc, vUv + off).r, texture2D(tSrc, vUv).g, texture2D(tSrc, vUv - off).b);
      c += texture2D(tBloom, vUv).rgb * .32 + texture2D(tWide, vUv).rgb * .3;
      c += texture2D(tRays, vUv).rgb;
      c = twAces(c);
      // grade: warm the highlights, cool the shadows a touch, a little extra richness
      float l = dot(c, vec3(.2126, .7152, .0722));
      c = mix(c, c * vec3(1.05, 1.0, .93), smoothstep(.45, 1., l) * warm);
      c = mix(c, c * vec3(.94, 1.0, 1.05), (1. - smoothstep(0., .4, l)) * (.6 + night * .4));
      c = mix(vec3(l), c, 1.08);
      c = toSRGB(clamp(c, 0., 1.));
      // vignette and fine grain
      vec2 q = vUv - .5; q.x *= res.x / res.y;
      c *= 1. - smoothstep(.45, 1.15, length(q)) * .32;
      c += (hash(vUv * res + fract(time) * 91.7) - .5) * .014;
      gl_FragColor = vec4(c, 1.);
    }`, {
    tSrc: { value: null }, tBloom: { value: null }, tWide: { value: null }, tRays: { value: null },
    exposure: { value: 1 }, time: { value: 0 }, warm: { value: 1 }, night: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
  });

  function draw(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); }
  function blur(src, a, b, scale) {
    blurMat.uniforms.tSrc.value = src.texture; blurMat.uniforms.dir.value.set(scale / src.width, 0); draw(blurMat, a);
    blurMat.uniforms.tSrc.value = a.texture; blurMat.uniforms.dir.value.set(0, scale / a.height); draw(blurMat, b);
  }

  const state = { sun: new THREE.Vector2(0.5, 0.5), sunVisible: 0, night: 0, time: 0 };

  return {
    /** The target the scene should be drawn into. */
    target: hdr,
    /** Sizes every buffer to the drawing buffer. */
    setSize(w, h) {
      hdr.setSize(w, h);
      const q = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4));
      [bright, blurA, blurB, rays].forEach((t) => t.setSize(q, qh));
      [wideA, wideB].forEach((t) => t.setSize(Math.max(1, q >> 1), Math.max(1, qh >> 1)));
      finalMat.uniforms.res.value.set(w, h);
    },
    /** Where the sun is on screen (0..1) and how much of it is in view, plus the time of night. */
    setSun(x, y, visible, night) { state.sun.set(x, y); state.sunVisible = visible; state.night = night; },
    /** Runs the chain from the drawn scene to the screen. */
    finish(dt) {
      state.time += dt;
      brightMat.uniforms.tSrc.value = hdr.texture; brightMat.uniforms.texel.value.set(1 / hdr.width, 1 / hdr.height);
      draw(brightMat, bright);
      blur(bright, blurA, blurB, 1);
      blur(blurB, wideA, wideB, 2);
      raysMat.uniforms.tSrc.value = bright.texture;
      raysMat.uniforms.sun.value.copy(state.sun);
      raysMat.uniforms.strength.value = state.sunVisible * (mobile ? 0.7 : 0.85);
      draw(raysMat, rays);
      Object.assign(finalMat.uniforms, {});
      finalMat.uniforms.tSrc.value = hdr.texture; finalMat.uniforms.tBloom.value = blurB.texture;
      finalMat.uniforms.tWide.value = wideB.texture; finalMat.uniforms.tRays.value = rays.texture;
      finalMat.uniforms.time.value = state.time; finalMat.uniforms.night.value = state.night;
      finalMat.uniforms.warm.value = 1 - state.night;
      draw(finalMat, null);
    },
  };
}
