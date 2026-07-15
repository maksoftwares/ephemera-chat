const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery=matchMedia('(max-width: 760px)');
const lowPower=(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
const landing=document.getElementById('landing');
const room=document.getElementById('room');
let teardown=()=>{};

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const randomBetween=(min,max)=>min+Math.random()*(max-min);

async function boot(){
  if(!landing||!room)return;
  let THREE;
  try{THREE=await import('https://esm.sh/three@0.180.0')}catch(error){console.warn('Three.js effects could not load.',error);return}

  const scenes=[];
  let frameId=0;
  let running=false;
  let lastFrame=0;
  const pointer={x:0,y:0,targetX:0,targetY:0};

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

  function attachResize(surface,camera){
    const resize=()=>{
      const rect=surface.host.getBoundingClientRect();
      const width=Math.max(1,Math.floor(rect.width));
      const height=Math.max(1,Math.floor(rect.height));
      if(width===surface.width&&height===surface.height)return;
      surface.width=width;surface.height=height;
      surface.renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
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
    const colorA=new THREE.Color(0x8b7cf6);
    const colorB=new THREE.Color(0x70dfc0);
    const mixed=new THREE.Color();
    for(let i=0;i<count;i++){
      const radius=randomBetween(1.7,5.8);
      const theta=Math.random()*Math.PI*2;
      const phi=Math.acos(randomBetween(-1,1));
      positions[i*3]=radius*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=radius*Math.cos(phi)*.72;
      positions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta)*.7;
      mixed.copy(colorA).lerp(colorB,Math.random());
      colors[i*3]=mixed.r;colors[i*3+1]=mixed.g;colors[i*3+2]=mixed.b;
    }
    const particleGeometry=new THREE.BufferGeometry();
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    particleGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({size:mobileQuery.matches?.045:.055,transparent:true,opacity:.78,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    group.add(particles);

    const knot=new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.45,.28,mobileQuery.matches?72:120,12,2,3),
      new THREE.MeshBasicMaterial({color:0x8b7cf6,wireframe:true,transparent:true,opacity:.14,depthWrite:false}),
    );
    group.add(knot);
    const halo=new THREE.Mesh(
      new THREE.TorusGeometry(2.65,.018,8,160),
      new THREE.MeshBasicMaterial({color:0x70dfc0,transparent:true,opacity:.35,depthWrite:false}),
    );
    halo.rotation.x=1.05;halo.rotation.y=.35;group.add(halo);

    const resize=attachResize(surface,camera);
    const update=time=>{
      pointer.x+=(pointer.targetX-pointer.x)*.035;
      pointer.y+=(pointer.targetY-pointer.y)*.035;
      group.rotation.y=time*.000055+pointer.x*.16;
      group.rotation.x=Math.sin(time*.00012)*.08+pointer.y*.1;
      knot.rotation.x=time*.00018;knot.rotation.z=time*.00012;
      halo.rotation.z=-time*.00008;
      camera.position.x=pointer.x*.28;camera.position.y=-pointer.y*.2;camera.lookAt(0,0,0);
    };
    return{surface,scene,camera,update,resize,dispose(){particleGeometry.dispose();particles.material.dispose();knot.geometry.dispose();knot.material.dispose();halo.geometry.dispose();halo.material.dispose()}};
  }

  function createRoomScene(){
    const surface=createSurface(room,'three-room-layer');
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(50,1,.1,100);
    camera.position.set(0,0,8);
    const nodeCount=mobileQuery.matches||lowPower?32:56;
    const positions=new Float32Array(nodeCount*3);
    const velocities=[];
    for(let i=0;i<nodeCount;i++){
      positions[i*3]=randomBetween(-5.5,5.5);
      positions[i*3+1]=randomBetween(-3.4,3.4);
      positions[i*3+2]=randomBetween(-1.4,1.4);
      velocities.push({x:randomBetween(-.004,.004),y:randomBetween(-.003,.003),z:randomBetween(-.0015,.0015)});
    }
    const pointGeometry=new THREE.BufferGeometry();
    pointGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    const points=new THREE.Points(pointGeometry,new THREE.PointsMaterial({color:0x9d91ff,size:mobileQuery.matches?.055:.065,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(points);

    const maxSegments=nodeCount*8;
    const linePositions=new Float32Array(maxSegments*6);
    const lineGeometry=new THREE.BufferGeometry();
    lineGeometry.setAttribute('position',new THREE.BufferAttribute(linePositions,3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setDrawRange(0,0);
    const lines=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0x70dfc0,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(lines);

    const resize=attachResize(surface,camera);
    const update=time=>{
      const positionAttribute=pointGeometry.getAttribute('position');
      for(let i=0;i<nodeCount;i++){
        let x=positionAttribute.getX(i)+velocities[i].x;
        let y=positionAttribute.getY(i)+velocities[i].y;
        let z=positionAttribute.getZ(i)+velocities[i].z;
        if(Math.abs(x)>5.7){velocities[i].x*=-1;x=clamp(x,-5.7,5.7)}
        if(Math.abs(y)>3.6){velocities[i].y*=-1;y=clamp(y,-3.6,3.6)}
        if(Math.abs(z)>1.6){velocities[i].z*=-1;z=clamp(z,-1.6,1.6)}
        positionAttribute.setXYZ(i,x,y,z);
      }
      positionAttribute.needsUpdate=true;
      let segments=0;
      const threshold=mobileQuery.matches?1.65:1.85;
      for(let i=0;i<nodeCount&&segments<maxSegments;i++){
        const ax=positionAttribute.getX(i),ay=positionAttribute.getY(i),az=positionAttribute.getZ(i);
        for(let j=i+1;j<nodeCount&&segments<maxSegments;j++){
          const bx=positionAttribute.getX(j),by=positionAttribute.getY(j),bz=positionAttribute.getZ(j);
          const dx=ax-bx,dy=ay-by,dz=az-bz;
          if(dx*dx+dy*dy+dz*dz>threshold*threshold)continue;
          const offset=segments*6;
          linePositions[offset]=ax;linePositions[offset+1]=ay;linePositions[offset+2]=az;
          linePositions[offset+3]=bx;linePositions[offset+4]=by;linePositions[offset+5]=bz;
          segments++;
        }
      }
      lineGeometry.attributes.position.needsUpdate=true;
      lineGeometry.setDrawRange(0,segments*2);
      scene.rotation.z=Math.sin(time*.00007)*.025;
      camera.position.x=pointer.x*.12;camera.position.y=-pointer.y*.08;camera.lookAt(0,0,0);
    };
    return{surface,scene,camera,update,resize,dispose(){pointGeometry.dispose();points.material.dispose();lineGeometry.dispose();lines.material.dispose()}};
  }

  let landingScene;
  let roomScene;
  try{landingScene=createLandingScene();roomScene=createRoomScene();scenes.push(landingScene,roomScene)}catch(error){console.warn('WebGL effects are unavailable.',error);scenes.forEach(item=>item?.surface?.layer?.remove());return}

  function activeScene(){
    if(!landing.classList.contains('hidden'))return landingScene;
    if(!room.classList.contains('hidden'))return roomScene;
    return null;
  }
  function renderOnce(time=performance.now()){
    const active=activeScene();
    if(!active)return;
    active.resize();active.update(time);active.surface.renderer.render(active.scene,active.camera);
  }
  function animate(time){
    if(!running)return;
    const frameGap=mobileQuery.matches||lowPower?50:33;
    if(time-lastFrame>=frameGap){lastFrame=time;renderOnce(time)}
    frameId=requestAnimationFrame(animate);
  }
  function start(){
    if(running||document.hidden)return;
    if(reducedMotion){renderOnce();return}
    running=true;lastFrame=0;frameId=requestAnimationFrame(animate);
  }
  function stop(){running=false;cancelAnimationFrame(frameId)}
  function sync(){stop();renderOnce();start()}

  const classObserver=new MutationObserver(sync);
  classObserver.observe(landing,{attributes:true,attributeFilter:['class']});
  classObserver.observe(room,{attributes:true,attributeFilter:['class']});
  addEventListener('pointermove',event=>{
    pointer.targetX=(event.clientX/Math.max(innerWidth,1)-.5)*2;
    pointer.targetY=(event.clientY/Math.max(innerHeight,1)-.5)*2;
  },{passive:true});
  addEventListener('visibilitychange',()=>document.hidden?stop():start());
  mobileQuery.addEventListener?.('change',sync);
  start();

  teardown=()=>{
    stop();classObserver.disconnect();
    scenes.forEach(item=>{
      item.surface.resizeObserver?.disconnect();item.dispose();item.surface.renderer.dispose();item.surface.layer.remove();
    });
  };
}

const schedule=callback=>'requestIdleCallback'in window?requestIdleCallback(callback,{timeout:1400}):setTimeout(callback,180);
schedule(()=>boot().catch(error=>console.warn('Three.js effects failed.',error)));
addEventListener('beforeunload',()=>teardown());
