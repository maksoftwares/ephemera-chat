import { NEBULA_TEXTURE_DATA } from './nebula-texture.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery = matchMedia('(max-width: 760px)');
const lowPower =
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

const landing = document.getElementById('landing');
const room = document.getElementById('room');
let teardown = () => {};

async function boot() {
  if (!landing || !room) return;

  let THREE;
  try {
    THREE = await import('https://esm.sh/three@0.180.0');
  } catch (error) {
    console.warn('Three.js effects could not load.', error);
    return;
  }

  const texture = await new THREE.TextureLoader().loadAsync(NEBULA_TEXTURE_DATA);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const textureWidth = texture.image?.naturalWidth || texture.image?.width || 748;
  const textureHeight = texture.image?.naturalHeight || texture.image?.height || 434;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const scenes = [];
  let frameId = 0;
  let running = false;
  let lastFrame = 0;

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform vec2 uTextureResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uRoomMode;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = rotation * p * 2.05 + 11.7;
        amplitude *= 0.5;
      }
      return value;
    }

    vec2 coverUv(vec2 uv) {
      float screenAspect = uResolution.x / max(uResolution.y, 1.0);
      float imageAspect = uTextureResolution.x / max(uTextureResolution.y, 1.0);
      vec2 scale = vec2(1.0);
      if (screenAspect > imageAspect) {
        scale.y = imageAspect / screenAspect;
      } else {
        scale.x = screenAspect / imageAspect;
      }
      return (uv - 0.5) * scale + 0.5;
    }

    float starLayer(vec2 uv, float scale, float threshold) {
      vec2 cell = floor(uv * scale);
      vec2 local = fract(uv * scale) - 0.5;
      vec2 offset = vec2(hash21(cell), hash21(cell + 9.17)) - 0.5;
      float seed = hash21(cell + 71.7);
      float d = length(local - offset * 0.72);
      return smoothstep(0.055, 0.0, d) * smoothstep(threshold, 1.0, seed);
    }

    float flare(vec2 p, vec2 center, float size) {
      vec2 delta = p - center;
      float core = smoothstep(size, 0.0, length(delta));
      float horizontal = exp(-abs(delta.y) * 105.0 / size) * exp(-abs(delta.x) * 3.0 / size);
      float vertical = exp(-abs(delta.x) * 105.0 / size) * exp(-abs(delta.y) * 3.0 / size);
      return core + (horizontal + vertical) * 0.28;
    }

    void main() {
      vec2 uv = coverUv(vUv);
      float t = uTime * 0.035;
      vec2 centered = vUv - 0.5;
      vec2 parallax = uPointer * vec2(0.012, -0.009);

      float flowA = fbm(uv * 3.3 + vec2(t * 0.25, -t * 0.13));
      float flowB = fbm(uv * 5.2 + vec2(-t * 0.16, t * 0.21) + 7.4);
      vec2 distortion = vec2(flowA - 0.5, flowB - 0.5) * 0.026;

      float breathing = 1.035 + sin(uTime * 0.08) * 0.009;
      vec2 animatedUv = (uv - 0.5) / breathing + 0.5 + parallax + distortion;
      animatedUv = clamp(animatedUv, vec2(0.002), vec2(0.998));

      vec3 base = texture2D(uTexture, animatedUv).rgb;
      vec3 driftOne = texture2D(uTexture, clamp(animatedUv + vec2(t * 0.0018, -t * 0.0011) + distortion * 0.34, vec2(0.002), vec2(0.998))).rgb;
      vec3 driftTwo = texture2D(uTexture, clamp(animatedUv + vec2(-t * 0.0011, t * 0.0015) - distortion * 0.22, vec2(0.002), vec2(0.998))).rgb;

      float cloudMask = smoothstep(0.16, 0.72, max(base.b, max(base.r * 0.72, base.g * 0.82)));
      vec3 color = mix(base, driftOne, cloudMask * 0.18);
      color = mix(color, driftTwo, cloudMask * 0.10);

      float glowPulse = 0.94 + sin(uTime * 0.42 + flowA * 5.0) * 0.07;
      color *= glowPulse;
      color += vec3(0.07, 0.10, 0.35) * cloudMask * (0.16 + flowB * 0.16);

      vec2 starUv = vUv + parallax * 0.25;
      float stars = starLayer(starUv, 92.0, 0.965);
      stars += starLayer(starUv + 0.137, 154.0, 0.987) * 0.68;
      float twinkle = 0.72 + 0.28 * sin(uTime * 1.5 + hash21(floor(starUv * 92.0)) * 17.0);
      color += vec3(0.72, 0.84, 1.0) * stars * twinkle;

      float flares = flare(centered, vec2(-0.23, 0.11), 0.018);
      flares += flare(centered, vec2(0.28, -0.18), 0.013) * 0.72;
      color += vec3(0.66, 0.79, 1.0) * flares;

      float vignette = smoothstep(0.96, 0.18, length(centered * vec2(0.78, 0.96)));
      color *= 0.66 + vignette * 0.46;

      if (uRoomMode > 0.5) {
        float readableCenter = 1.0 - smoothstep(0.08, 0.56, length(centered * vec2(0.94, 1.18)));
        color *= 1.0 - readableCenter * 0.15;
        color *= 0.88;
      }

      color = pow(max(color, vec3(0.0)), vec3(0.94));
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createSurface(host, className, roomMode) {
    const layer = document.createElement('div');
    layer.className = `three-effect-layer ${className}`;
    layer.setAttribute('aria-hidden', 'true');

    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: !mobileQuery.matches && !lowPower,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobileQuery.matches || lowPower ? 1 : 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.tabIndex = -1;
    layer.append(renderer.domElement);
    host.prepend(layer);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTexture: { value: texture },
      uTextureResolution: { value: new THREE.Vector2(textureWidth, textureHeight) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uRoomMode: { value: roomMode ? 1 : 0 },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthWrite: false, depthTest: false });
    scene.add(new THREE.Mesh(geometry, material));

    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    return {
      host,
      layer,
      renderer,
      scene,
      camera,
      resize,
      update(time) {
        pointer.x += (pointer.targetX - pointer.x) * 0.028;
        pointer.y += (pointer.targetY - pointer.y) * 0.028;
        uniforms.uTime.value = time * 0.001;
        uniforms.uPointer.value.set(pointer.x, pointer.y);
      },
      dispose() {
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        layer.remove();
      },
    };
  }

  let landingScene;
  let roomScene;
  try {
    landingScene = createSurface(landing, 'three-landing-layer', false);
    roomScene = createSurface(room, 'three-room-layer', true);
    scenes.push(landingScene, roomScene);
  } catch (error) {
    console.warn('WebGL effects are unavailable.', error);
    scenes.forEach((item) => item?.dispose?.());
    texture.dispose();
    return;
  }

  const activeScene = () =>
    !landing.classList.contains('hidden')
      ? landingScene
      : !room.classList.contains('hidden')
        ? roomScene
        : null;

  function renderOnce(time = performance.now()) {
    const active = activeScene();
    if (!active) return;
    active.resize();
    active.update(time);
    active.renderer.render(active.scene, active.camera);
  }

  function animate(time) {
    if (!running) return;
    const frameGap = mobileQuery.matches || lowPower ? 50 : 33;
    if (time - lastFrame >= frameGap) {
      lastFrame = time;
      renderOnce(time);
    }
    frameId = requestAnimationFrame(animate);
  }

  function start() {
    if (running || document.hidden) return;
    if (reducedMotion) {
      renderOnce();
      return;
    }
    running = true;
    lastFrame = 0;
    frameId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  function sync() {
    stop();
    renderOnce();
    start();
  }

  const classObserver = new MutationObserver(sync);
  classObserver.observe(landing, { attributes: true, attributeFilter: ['class'] });
  classObserver.observe(room, { attributes: true, attributeFilter: ['class'] });

  addEventListener('pointermove', (event) => {
    pointer.targetX = (event.clientX / Math.max(innerWidth, 1) - 0.5) * 2;
    pointer.targetY = (event.clientY / Math.max(innerHeight, 1) - 0.5) * 2;
  }, { passive: true });
  addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  mobileQuery.addEventListener?.('change', sync);
  start();

  teardown = () => {
    stop();
    classObserver.disconnect();
    scenes.forEach((item) => item.dispose());
    texture.dispose();
  };
}

const schedule = (callback) =>
  'requestIdleCallback' in window
    ? requestIdleCallback(callback, { timeout: 1000 })
    : setTimeout(callback, 120);

schedule(() => boot().catch((error) => console.warn('Three.js effects failed.', error)));
addEventListener('beforeunload', () => teardown());
