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

  function createGalaxyGlowTexture(){
    const size=256,canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    const context=canvas.getContext('2d');
    const gradient=context.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    gradient.addColorStop(0,'rgba(255,244,218,0.98)');
    gradient.addColorStop(.1,'rgba(255,222,171,0.82)');
    gradient.addColorStop(.28,'rgba(194,165,255,0.38)');
    gradient.addColorStop(.58,'rgba(101,119,255,0.13)');
    gradient.addColorStop(1,'rgba(56,65,180,0)');
    context.fillStyle=gradient;context.fillRect(0,0,size,size);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.needsUpdate=true;
    return texture;
  }

  function createRoomScene(){
    const surface=createSurface(room,'three-room-layer');
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(48,1,.1,180);
    const galaxy=new THREE.Group();
    galaxy.rotation.x=.92;
    galaxy.rotation.z=-.28;
    scene.add(galaxy);
    const disposeList=[];
    const cameraBase={x:0,y:7.2,z:14.5};

    const starCount=mobileQuery.matches||lowPower?950:2400;
    const arms=4;
    const radiusMax=mobileQuery.matches?10.5:13.5;
    const positions=new Float32Array(starCount*3);
    const colors=new Float32Array(starCount*3);
    const coreColor=new THREE.Color(0xffe7bd);
    const armColor=new THREE.Color(0x9eb4ff);
    const edgeColor=new THREE.Color(0x725ee8);
    const mixed=new THREE.Color();

    for(let i=0;i<starCount;i++){
      const normalized=Math.pow(Math.random(),1.5);
      const radius=normalized*radiusMax;
      const arm=i%arms;
      const baseAngle=arm/arms*Math.PI*2;
      const spin=radius*.72;
      const angle=baseAngle+spin+randomBetween(-.34,.34);
      const spread=.14+radius*.085;
      positions[i*3]=Math.cos(angle)*radius+randomBetween(-spread,spread);
      positions[i*3+1]=randomBetween(-.12,.12)+randomBetween(-.24,.24)*(1-normalized);
      positions[i*3+2]=Math.sin(angle)*radius+randomBetween(-spread,spread);
      mixed.copy(coreColor).lerp(armColor,Math.min(1,normalized*.88)).lerp(edgeColor,Math.random()*.2*normalized);
      colors[i*3]=mixed.r;colors[i*3+1]=mixed.g;colors[i*3+2]=mixed.b;
    }

    const galaxyGeometry=new THREE.BufferGeometry();
    galaxyGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    galaxyGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const galaxyMaterial=new THREE.PointsMaterial({
      size:mobileQuery.matches?.075:.092,
      transparent:true,
      opacity:mobileQuery.matches?.67:.75,
      vertexColors:true,
      depthWrite:false,
      blending:THREE.AdditiveBlending,
      sizeAttenuation:true,
    });
    const galaxyStars=new THREE.Points(galaxyGeometry,galaxyMaterial);
    galaxy.add(galaxyStars);
    disposeList.push(galaxyGeometry,galaxyMaterial);

    const dustCount=mobileQuery.matches||lowPower?320:720;
    const dustPositions=new Float32Array(dustCount*3);
    const dustColors=new Float32Array(dustCount*3);
    const dustA=new THREE.Color(0x7f65d9),dustB=new THREE.Color(0x274c98);
    for(let i=0;i<dustCount;i++){
      const normalized=Math.pow(Math.random(),1.15);
      const radius=normalized*radiusMax*.92;
      const arm=i%arms;
      const angle=arm/arms*Math.PI*2+radius*.72+randomBetween(-.58,.58);
      const spread=.35+radius*.12;
      dustPositions[i*3]=Math.cos(angle)*radius+randomBetween(-spread,spread);
      dustPositions[i*3+1]=randomBetween(-.22,.22);
      dustPositions[i*3+2]=Math.sin(angle)*radius+randomBetween(-spread,spread);
      mixed.copy(dustA).lerp(dustB,Math.random());
      dustColors[i*3]=mixed.r;dustColors[i*3+1]=mixed.g;dustColors[i*3+2]=mixed.b;
    }
    const dustGeometry=new THREE.BufferGeometry();
    dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
    dustGeometry.setAttribute('color',new THREE.BufferAttribute(dustColors,3));
    const dustMaterial=new THREE.PointsMaterial({size:mobileQuery.matches?.13:.17,transparent:true,opacity:.075,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending});
    const dust=new THREE.Points(dustGeometry,dustMaterial);
    galaxy.add(dust);
    disposeList.push(dustGeometry,dustMaterial);

    const coreTexture=createGalaxyGlowTexture();
    const coreMaterial=new THREE.SpriteMaterial({map:coreTexture,transparent:true,opacity:.76,depthWrite:false,blending:THREE.AdditiveBlending});
    const core=new THREE.Sprite(coreMaterial);
    const coreSize=mobileQuery.matches?6.1:7.6;
    core.scale.set(coreSize,coreSize,1);
    galaxy.add(core);
    disposeList.push(coreTexture,coreMaterial);

    const backgroundCount=mobileQuery.matches||lowPower?220:480;
    const backgroundPositions=new Float32Array(backgroundCount*3);
    for(let i=0;i<backgroundCount;i++){
      const radius=randomBetween(20,46),theta=Math.random()*Math.PI*2,phi=Math.acos(randomBetween(-1,1));
      backgroundPositions[i*3]=radius*Math.sin(phi)*Math.cos(theta);
      backgroundPositions[i*3+1]=radius*Math.cos(phi);
      backgroundPositions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta);
    }
    const backgroundGeometry=new THREE.BufferGeometry();
    backgroundGeometry.setAttribute('position',new THREE.BufferAttribute(backgroundPositions,3));
    const backgroundMaterial=new THREE.PointsMaterial({color:0xcbd5ff,size:mobileQuery.matches?.055:.072,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending});
    const backgroundStars=new THREE.Points(backgroundGeometry,backgroundMaterial);
    scene.add(backgroundStars);
    disposeList.push(backgroundGeometry,backgroundMaterial);

    const updateCamera=(width,height)=>{
      const compact=width<780;
      const veryTall=height>width*1.45;
      if(compact&&veryTall)Object.assign(cameraBase,{x:0,y:9.2,z:12.8});
      else if(compact)Object.assign(cameraBase,{x:0,y:7.8,z:13.8});
      else Object.assign(cameraBase,{x:.8,y:6.8,z:14.8});
      camera.position.set(cameraBase.x,cameraBase.y,cameraBase.z);
      camera.lookAt(0,0,0);
    };
    const resize=attachResize(surface,camera,updateCamera);
    const update=time=>{
      pointer.x+=(pointer.targetX-pointer.x)*.022;
      pointer.y+=(pointer.targetY-pointer.y)*.022;
      galaxy.rotation.y=time*.00004+pointer.x*.045;
      galaxy.rotation.z=-.28+Math.sin(time*.000025)*.016;
      galaxy.rotation.x=.92+pointer.y*.025;
      dust.rotation.y=-time*.000012;
      backgroundStars.rotation.y=-time*.000006;
      const pulse=1+Math.sin(time*.0014)*.035;
      core.scale.set(coreSize*pulse,coreSize*pulse,1);
      core.material.opacity=.7+Math.sin(time*.0011)*.07;
      camera.position.set(cameraBase.x+pointer.x*.5,cameraBase.y-pointer.y*.18,cameraBase.z);
      camera.lookAt(0,0,0);
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