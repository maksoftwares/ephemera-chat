const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery=matchMedia('(max-width: 760px)');
const lowPower=(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
const landing=document.getElementById('landing');
const room=document.getElementById('room');
let teardown=()=>{};

const randomBetween=(min,max)=>min+Math.random()*(max-min);

async function boot(){
  if(!landing||!room)return;
  let THREE;
  try{THREE=await import('https://esm.sh/three@0.180.0')}catch(error){console.warn('Three.js effects could not load.',error);return}

  const scenes=[];
  const pointer={x:0,y:0,targetX:0,targetY:0};
  let frameId=0,running=false,lastFrame=0;

  function createSurface(host,className){
    const layer=document.createElement('div');
    layer.className=`three-effect-layer ${className}`;
    layer.setAttribute('aria-hidden','true');
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:!mobileQuery.matches&&!lowPower,powerPreference:'low-power'});
    renderer.setClearColor(0x000000,0);
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobileQuery.matches||lowPower?1:1.45));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden','true');
    renderer.domElement.tabIndex=-1;
    layer.append(renderer.domElement);
    host.prepend(layer);
    return{host,layer,renderer,width:1,height:1,resizeObserver:null};
  }

  function attachResize(surface,camera,onResize){
    const resize=()=>{
      const rect=surface.host.getBoundingClientRect();
      const width=Math.max(1,Math.floor(rect.width));
      const height=Math.max(1,Math.floor(rect.height));
      if(width===surface.width&&height===surface.height)return;
      surface.width=width;surface.height=height;
      surface.renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
      onResize?.(width,height);
    };
    surface.resizeObserver=new ResizeObserver(resize);
    surface.resizeObserver.observe(surface.host);
    resize();
    return resize;
  }

  function createLandingScene(){
    const surface=createSurface(landing,'three-landing-layer');
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(52,1,.1,100);
    camera.position.set(0,0,8.5);
    const group=new THREE.Group();
    scene.add(group);

    const count=mobileQuery.matches||lowPower?130:280;
    const positions=new Float32Array(count*3);
    const colors=new Float32Array(count*3);
    const colorA=new THREE.Color(0x8b7cf6),colorB=new THREE.Color(0x70dfc0),mixed=new THREE.Color();
    for(let i=0;i<count;i++){
      const radius=randomBetween(1.7,5.8),theta=Math.random()*Math.PI*2,phi=Math.acos(randomBetween(-1,1));
      positions[i*3]=radius*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=radius*Math.cos(phi)*.72;
      positions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta)*.7;
      mixed.copy(colorA).lerp(colorB,Math.random());
      colors[i*3]=mixed.r;colors[i*3+1]=mixed.g;colors[i*3+2]=mixed.b;
    }
    const particleGeometry=new THREE.BufferGeometry();
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    particleGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const particleMaterial=new THREE.PointsMaterial({size:mobileQuery.matches?.045:.055,transparent:true,opacity:.78,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending});
    const particles=new THREE.Points(particleGeometry,particleMaterial);
    group.add(particles);

    const knotGeometry=new THREE.TorusKnotGeometry(1.45,.28,mobileQuery.matches?72:120,12,2,3);
    const knotMaterial=new THREE.MeshBasicMaterial({color:0x8b7cf6,wireframe:true,transparent:true,opacity:.14,depthWrite:false});
    const knot=new THREE.Mesh(knotGeometry,knotMaterial);
    group.add(knot);
    const haloGeometry=new THREE.TorusGeometry(2.65,.018,8,160);
    const haloMaterial=new THREE.MeshBasicMaterial({color:0x70dfc0,transparent:true,opacity:.35,depthWrite:false});
    const halo=new THREE.Mesh(haloGeometry,haloMaterial);
    halo.rotation.x=1.05;halo.rotation.y=.35;group.add(halo);

    const resize=attachResize(surface,camera);
    const update=time=>{
      pointer.x+=(pointer.targetX-pointer.x)*.035;pointer.y+=(pointer.targetY-pointer.y)*.035;
      group.rotation.y=time*.000055+pointer.x*.16;
      group.rotation.x=Math.sin(time*.00012)*.08+pointer.y*.1;
      knot.rotation.x=time*.00018;knot.rotation.z=time*.00012;halo.rotation.z=-time*.00008;
      camera.position.x=pointer.x*.28;camera.position.y=-pointer.y*.2;camera.lookAt(0,0,0);
    };
    return{surface,scene,camera,resize,update,dispose(){particleGeometry.dispose();particleMaterial.dispose();knotGeometry.dispose();knotMaterial.dispose();haloGeometry.dispose();haloMaterial.dispose()}};
  }

  function createOrbit(radius,color=0x52607a,opacity=.28){
    const points=[],segments=mobileQuery.matches?80:140;
    for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI*2;points.push(new THREE.Vector3(Math.cos(angle)*radius,0,Math.sin(angle)*radius))}
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const material=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
    return new THREE.LineLoop(geometry,material);
  }

  function createRadialGlowTexture(){
    const size=256,canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    const context=canvas.getContext('2d');
    const gradient=context.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    gradient.addColorStop(0,'rgba(255,244,190,0.95)');
    gradient.addColorStop(.16,'rgba(255,197,82,0.7)');
    gradient.addColorStop(.42,'rgba(255,143,34,0.28)');
    gradient.addColorStop(.72,'rgba(255,106,22,0.08)');
    gradient.addColorStop(1,'rgba(255,90,0,0)');
    context.fillStyle=gradient;context.fillRect(0,0,size,size);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.needsUpdate=true;
    return texture;
  }

  function createRoomScene(){
    const surface=createSurface(room,'three-room-layer');
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(48,1,.1,140);
    const system=new THREE.Group();
    system.rotation.x=.23;system.rotation.z=-.06;scene.add(system);
    const disposeList=[];

    const starCount=mobileQuery.matches||lowPower?260:620;
    const starPositions=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){
      const radius=randomBetween(18,48),theta=Math.random()*Math.PI*2,phi=Math.acos(randomBetween(-1,1));
      starPositions[i*3]=radius*Math.sin(phi)*Math.cos(theta);
      starPositions[i*3+1]=radius*Math.cos(phi);
      starPositions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta);
    }
    const starGeometry=new THREE.BufferGeometry();
    starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
    const starMaterial=new THREE.PointsMaterial({color:0xcddcff,size:mobileQuery.matches?.075:.095,transparent:true,opacity:.74,depthWrite:false,blending:THREE.AdditiveBlending});
    const stars=new THREE.Points(starGeometry,starMaterial);
    scene.add(stars);disposeList.push(starGeometry,starMaterial);

    scene.add(new THREE.AmbientLight(0x7080a8,.3));
    scene.add(new THREE.PointLight(0xffd58a,6.5,70,1.5));

    const sunGeometry=new THREE.SphereGeometry(mobileQuery.matches?.72:.9,32,24);
    const sunMaterial=new THREE.MeshBasicMaterial({color:0xffc45c});
    const sun=new THREE.Mesh(sunGeometry,sunMaterial);
    system.add(sun);disposeList.push(sunGeometry,sunMaterial);

    const glowTexture=createRadialGlowTexture();
    const glowMaterial=new THREE.SpriteMaterial({map:glowTexture,color:0xffffff,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending});
    const sunGlow=new THREE.Sprite(glowMaterial);
    const glowSize=mobileQuery.matches?4.3:5.4;
    sunGlow.scale.set(glowSize,glowSize,1);
    system.add(sunGlow);disposeList.push(glowTexture,glowMaterial);

    const planetData=mobileQuery.matches||lowPower?[
      {radius:1.75,size:.16,color:0xb7a08a,speed:.00058},{radius:2.55,size:.24,color:0xe1a35d,speed:.00042},{radius:3.45,size:.27,color:0x3e8fe8,speed:.00032,moon:true},{radius:4.45,size:.21,color:0xca6042,speed:.00025},{radius:5.75,size:.5,color:0xd6a56b,speed:.00016},{radius:7,size:.43,color:0xe2c891,speed:.00012,ring:true}
    ]:[
      {radius:1.55,size:.14,color:0xa89a8c,speed:.00066},{radius:2.18,size:.22,color:0xd59a59,speed:.00052},{radius:2.95,size:.25,color:0x3e8fe8,speed:.0004,moon:true},{radius:3.72,size:.19,color:0xc65d3f,speed:.00032},{radius:4.85,size:.48,color:0xd5a068,speed:.00021},{radius:6.1,size:.42,color:0xdfc48c,speed:.00016,ring:true},{radius:7.25,size:.32,color:0x78c6d8,speed:.00012},{radius:8.25,size:.3,color:0x4d70cf,speed:.000095}
    ];

    const planets=[];
    planetData.forEach((data,index)=>{
      const orbit=createOrbit(data.radius,index%2?0x6d6a8e:0x41677c,index<4?.3:.2);
      orbit.rotation.x=.02*(index%3-1);system.add(orbit);disposeList.push(orbit.geometry,orbit.material);
      const pivot=new THREE.Group();pivot.rotation.y=index*.85;pivot.rotation.x=.02*(index%3-1);system.add(pivot);
      const geometry=new THREE.SphereGeometry(data.size,24,18);
      const material=new THREE.MeshStandardMaterial({color:data.color,roughness:.75,metalness:.04});
      const mesh=new THREE.Mesh(geometry,material);mesh.position.x=data.radius;pivot.add(mesh);disposeList.push(geometry,material);
      if(data.ring){
        const ringGeometry=new THREE.RingGeometry(data.size*1.28,data.size*2.05,48);
        const ringMaterial=new THREE.MeshBasicMaterial({color:0xd7c69f,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false});
        const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=Math.PI/2.35;mesh.add(ring);disposeList.push(ringGeometry,ringMaterial);
      }
      if(data.moon){
        const moonPivot=new THREE.Group();mesh.add(moonPivot);
        const moonGeometry=new THREE.SphereGeometry(data.size*.28,14,10);
        const moonMaterial=new THREE.MeshStandardMaterial({color:0xc9ccd4,roughness:.9});
        const moon=new THREE.Mesh(moonGeometry,moonMaterial);moon.position.x=data.size*1.85;moonPivot.add(moon);disposeList.push(moonGeometry,moonMaterial);data.moonPivot=moonPivot;
      }
      planets.push({pivot,mesh,data});
    });

    const asteroidCount=mobileQuery.matches?70:145;
    const asteroidGeometry=new THREE.BufferGeometry();
    const asteroidPositions=new Float32Array(asteroidCount*3);
    for(let i=0;i<asteroidCount;i++){
      const angle=Math.random()*Math.PI*2,radius=randomBetween(4.05,4.5);
      asteroidPositions[i*3]=Math.cos(angle)*radius;asteroidPositions[i*3+1]=randomBetween(-.08,.08);asteroidPositions[i*3+2]=Math.sin(angle)*radius;
    }
    asteroidGeometry.setAttribute('position',new THREE.BufferAttribute(asteroidPositions,3));
    const asteroidMaterial=new THREE.PointsMaterial({color:0x9a8b78,size:.035,transparent:true,opacity:.7});
    const asteroids=new THREE.Points(asteroidGeometry,asteroidMaterial);
    system.add(asteroids);disposeList.push(asteroidGeometry,asteroidMaterial);

    const updateCamera=(width,height)=>{
      const compact=width<780,wide=width/height>1.8;
      camera.position.set(compact?0:wide?1.5:.7,compact?9.8:7.5,compact?14.5:wide?15.2:16.5);camera.lookAt(0,0,0);
    };
    const resize=attachResize(surface,camera,updateCamera);
    const update=time=>{
      pointer.x+=(pointer.targetX-pointer.x)*.025;pointer.y+=(pointer.targetY-pointer.y)*.025;
      sun.rotation.y=time*.00018;
      sunGlow.material.opacity=.66+Math.sin(time*.0022)*.08;
      const pulse=1+Math.sin(time*.0018)*.035;sunGlow.scale.set(glowSize*pulse,glowSize*pulse,1);
      asteroids.rotation.y=time*.000025;stars.rotation.y=-time*.000006;
      planets.forEach(({pivot,mesh,data},index)=>{pivot.rotation.y=time*data.speed+index*.85;mesh.rotation.y=time*(.00022+index*.000012);if(data.moonPivot)data.moonPivot.rotation.y=time*.00085});
      system.rotation.y=pointer.x*.055+Math.sin(time*.00004)*.035;system.rotation.x=.23+pointer.y*.035;
      camera.position.x+=((pointer.x*.6)-camera.position.x*.02)*.012;camera.lookAt(0,0,0);
    };
    return{surface,scene,camera,update,resize,dispose(){disposeList.forEach(resource=>resource.dispose?.())}};
  }

  let landingScene,roomScene;
  try{landingScene=createLandingScene();roomScene=createRoomScene();scenes.push(landingScene,roomScene)}catch(error){console.warn('WebGL effects are unavailable.',error);scenes.forEach(item=>item?.surface?.layer?.remove());return}

  const activeScene=()=>!landing.classList.contains('hidden')?landingScene:!room.classList.contains('hidden')?roomScene:null;
  function renderOnce(time=performance.now()){const active=activeScene();if(!active)return;active.resize();active.update(time);active.surface.renderer.render(active.scene,active.camera)}
  function animate(time){if(!running)return;const frameGap=mobileQuery.matches||lowPower?50:33;if(time-lastFrame>=frameGap){lastFrame=time;renderOnce(time)}frameId=requestAnimationFrame(animate)}
  function start(){if(running||document.hidden)return;if(reducedMotion){renderOnce();return}running=true;lastFrame=0;frameId=requestAnimationFrame(animate)}
  function stop(){running=false;cancelAnimationFrame(frameId)}
  function sync(){stop();renderOnce();start()}

  const classObserver=new MutationObserver(sync);
  classObserver.observe(landing,{attributes:true,attributeFilter:['class']});
  classObserver.observe(room,{attributes:true,attributeFilter:['class']});
  addEventListener('pointermove',event=>{pointer.targetX=(event.clientX/Math.max(innerWidth,1)-.5)*2;pointer.targetY=(event.clientY/Math.max(innerHeight,1)-.5)*2},{passive:true});
  addEventListener('visibilitychange',()=>document.hidden?stop():start());
  mobileQuery.addEventListener?.('change',sync);
  start();

  teardown=()=>{stop();classObserver.disconnect();scenes.forEach(item=>{item.surface.resizeObserver?.disconnect();item.dispose();item.surface.renderer.dispose();item.surface.layer.remove()})};
}

const schedule=callback=>'requestIdleCallback'in window?requestIdleCallback(callback,{timeout:1000}):setTimeout(callback,120);
schedule(()=>boot().catch(error=>console.warn('Three.js effects failed.',error)));
addEventListener('beforeunload',()=>teardown());
