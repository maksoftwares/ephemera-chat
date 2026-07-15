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
    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uRoomMode;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    vec2 hash22(vec2 p) {
      float n = hash21(p);
      return vec2(n, hash21(p + n + 19.19));
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
      float amplitude = 0.52;
      mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);

      for (int i = 0; i < 6; i++) {
        value += amplitude * noise(p);
        p = rotation * p * 2.03 + 13.17;
        amplitude *= 0.50;
      }
      return value;
    }

    float ridged(vec2 p) {
      float value = 0.0;
      float amplitude = 0.55;
      mat2 rotation = mat2(0.86, -0.51, 0.51, 0.86);

      for (int i = 0; i < 5; i++) {
        float n = noise(p);
        n = 1.0 - abs(n * 2.0 - 1.0);
        value += n * n * amplitude;
        p = rotation * p * 2.14 + 7.41;
        amplitude *= 0.48;
      }
      return value;
    }

    float starLayer(vec2 uv, float scale, float threshold) {
      vec2 cell = floor(uv * scale);
      vec2 local = fract(uv * scale) - 0.5;
      vec2 offset = hash22(cell) - 0.5;
      float seed = hash21(cell + 71.7);
      float distanceToStar = length(local - offset * 0.72);
      float star = smoothstep(0.055, 0.0, distanceToStar);
      star *= smoothstep(threshold, 1.0, seed);
      return star;
    }

    float flare(vec2 p, vec2 center, float size) {
      vec2 delta = p - center;
      float distanceValue = length(delta);
      float core = smoothstep(size, 0.0, distanceValue);
      float horizontal = exp(-abs(delta.y) * 130.0 / size) * exp(-abs(delta.x) * 3.0 / size);
      float vertical = exp(-abs(delta.x) * 130.0 / size) * exp(-abs(delta.y) * 3.0 / size);
      return core + (horizontal + vertical) * 0.32;
    }

    void main() {
      vec2 uv = vUv;
      vec2 p = uv - 0.5;
      p.x *= uResolution.x / max(uResolution.y, 1.0);

      vec2 pointerShift = uPointer * vec2(0.10, -0.07);
      float slowTime = uTime * 0.018;

      vec2 warpA = vec2(
        fbm(p * 1.18 + vec2(slowTime * 0.19, -slowTime * 0.11)),
        fbm(p * 1.18 + vec2(8.4, 3.7) + vec2(-slowTime * 0.13, slowTime * 0.17))
      );

      vec2 warped = p + (warpA - 0.5) * 1.05 + pointerShift;
      float cloudA = fbm(warped * 1.48 + vec2(slowTime * 0.12, 0.0));
      float cloudB = ridged(warped * 1.92 - vec2(slowTime * 0.08, slowTime * 0.04));
      float cloudC = fbm(warped * 3.35 + vec2(-slowTime * 0.05, slowTime * 0.07));

      float wisps = smoothstep(0.44, 0.82, cloudA * 0.68 + cloudB * 0.55);
      wisps *= 0.62 + cloudC * 0.54;

      float edgeBias = smoothstep(0.08, 0.90, length(p * vec2(0.82, 1.02)));
      float centerCalm = smoothstep(0.08, 0.55, length(p * vec2(0.95, 1.10)));
      float nebulaMask = wisps * mix(0.42, 1.0, edgeBias);
      nebulaMask *= mix(0.56, 1.0, centerCalm);

      vec3 deepSpace = vec3(0.004, 0.007, 0.030);
      vec3 midnight = vec3(0.012, 0.025, 0.095);
      vec3 electricBlue = vec3(0.050, 0.255, 0.950);
      vec3 violet = vec3(0.475, 0.095, 0.940);
      vec3 magenta = vec3(0.760, 0.180, 0.780);

      float hueMix = smoothstep(0.28, 0.82, fbm(warped * 1.12 + 21.3));
      vec3 nebulaColor = mix(electricBlue, violet, hueMix);
      nebulaColor = mix(nebulaColor, magenta, smoothstep(0.66, 0.98, cloudB) * 0.38);

      vec3 color = mix(deepSpace, midnight, cloudA * 0.48);
      color += nebulaColor * nebulaMask * (uRoomMode > 0.5 ? 0.58 : 0.86);
      color += vec3(0.12, 0.18, 0.55) * pow(max(cloudB - 0.54, 0.0), 2.0) * 1.55;

      vec2 starUv = uv + uPointer * 0.004;
      float stars = starLayer(starUv, 92.0, 0.965);
      stars += starLayer(starUv + 0.137, 154.0, 0.986) * 0.72;
      stars += starLayer(starUv + 0.413, 245.0, 0.994) * 0.45;

      float twinkle = 0.78 + 0.22 * sin(uTime * 1.35 + hash21(floor(starUv * 92.0)) * 18.0);
      color += vec3(0.72, 0.83, 1.0) * stars * twinkle;

      float brightStars = 0.0;
      brightStars += flare(p, vec2(-0.30, 0.18), 0.022);
      brightStars += flare(p, vec2(0.31, -0.16), 0.017) * 0.82;
      brightStars += flare(p, vec2(0.23, 0.27), 0.012) * 0.62;
      color += vec3(0.72, 0.84, 1.0) * brightStars;

      float vignette = smoothstep(0.95, 0.18, length(p * vec2(0.76, 0.95)));
      color *= 0.62 + vignette * 0.52;

      if (uRoomMode > 0.5) {
        float readableCenter = 1.0 - smoothstep(0.08, 0.48, length(p * vec2(0.92, 1.18)));
        color *= 1.0 - readableCenter * 0.18;
      }

      color = pow(color, vec3(0.90));
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
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uRoomMode: { value: roomMode ? 1 : 0 },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthWrite: false, depthTest: false });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

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

  addEventListener(
    'pointermove',
    (event) => {
      pointer.targetX = (event.clientX / Math.max(innerWidth, 1) - 0.5) * 2;
      pointer.targetY = (event.clientY / Math.max(innerHeight, 1) - 0.5) * 2;
    },
    { passive: true },
  );
  addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  mobileQuery.addEventListener?.('change', sync);
  start();

  teardown = () => {
    stop();
    classObserver.disconnect();
    scenes.forEach((item) => item.dispose());
  };
}

const schedule = (callback) =>
  'requestIdleCallback' in window
    ? requestIdleCallback(callback, { timeout: 900 })
    : setTimeout(callback, 100);

schedule(() => boot().catch((error) => console.warn('Three.js nebula effect failed.', error)));
addEventListener('beforeunload', () => teardown());