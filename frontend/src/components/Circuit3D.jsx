import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// High-precision Monza 3D Spline
export function generateMonza3DSpline() {
  const points = [
    // Main straight (Sector 1 Start)
    new THREE.Vector3(-480, 0, 320),
    new THREE.Vector3(-220, 0, 320),
    new THREE.Vector3(120, 0, 320),
    new THREE.Vector3(380, 0, 320),
    // Turn 1 & 2 Chicane (Variante del Rettifilo)
    new THREE.Vector3(450, 2, 310),
    new THREE.Vector3(470, 4, 270),
    new THREE.Vector3(430, 5, 230),
    // Curva Grande (Biassono)
    new THREE.Vector3(400, 8, 150),
    new THREE.Vector3(410, 10, 0),
    // Sector 2 Start
    new THREE.Vector3(440, 12, -150),
    new THREE.Vector3(410, 10, -290),
    // Variante della Roggia (T4 & T5)
    new THREE.Vector3(370, 8, -340),
    new THREE.Vector3(340, 6, -370),
    new THREE.Vector3(320, 5, -340),
    // Lesmo 1 & 2
    new THREE.Vector3(270, 4, -270),
    new THREE.Vector3(230, 3, -290),
    new THREE.Vector3(170, 2, -330),
    new THREE.Vector3(110, 0, -360),
    // Serraglio & Ascari
    new THREE.Vector3(-60, -4, -350),
    new THREE.Vector3(-220, -6, -320),
    new THREE.Vector3(-320, -2, -280),
    new THREE.Vector3(-360, 0, -250),
    // Sector 3 Start
    new THREE.Vector3(-330, 2, -190),
    new THREE.Vector3(-320, 3, -90),
    new THREE.Vector3(-340, 2, 50),
    new THREE.Vector3(-370, 1, 160),
    // Parabolica
    new THREE.Vector3(-410, 0, 240),
    new THREE.Vector3(-450, 0, 290),
  ];

  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.25);
}

// Color palettes for Team Liveries
export const TEAM_LIVERIES = {
  FERRARI: { name: 'Scuderia Ferrari', color: 0xe10600, accent: 0xffd700, text: 'CRIMSON RED' },
  REDBULL: { name: 'Red Bull Racing', color: 0x091b36, accent: 0xffcc00, text: 'NAVY & GOLD' },
  MERCEDES: { name: 'Mercedes AMG', color: 0x22262d, accent: 0x00a39e, text: 'PETRONAS TEAL' },
  MCLAREN: { name: 'McLaren F1', color: 0xff8000, accent: 0x000000, text: 'PAPAYA ORANGE' }
};

const Circuit3D = ({ 
  telemetryData = [], 
  currentPointIndex = 0, 
  onPointSelect = () => {},
  cameraMode = 'CHASE', 
  showGhost = true,
  selectedZone = '',
  onZoneClick = () => {},
  teamLivery = 'FERRARI'
}) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  
  const carGroupRef = useRef(null);
  const carBodyInnerRef = useRef(null);
  const carMainMeshRef = useRef(null);
  const frontWheelsRef = useRef([]);
  const rearWheelsRef = useRef([]);
  const brakeDiscsRef = useRef([]);
  const ghostMeshRef = useRef(null);
  const curveRef = useRef(null);
  const turnMarkersRef = useRef([]);

  const carPhysicsRef = useRef({
    roll: 0,
    pitch: 0,
    steeringAngle: 0,
    wheelRotation: 0,
    prevHeading: 0
  });

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6, distance: 380 });

  // Aerodynamic F1 Mesh Builder
  const createF1Car = (isHologram = false, teamKey = 'FERRARI') => {
    const carGroup = new THREE.Group();
    const bodyInnerGroup = new THREE.Group();

    const livery = TEAM_LIVERIES[teamKey] || TEAM_LIVERIES.FERRARI;

    const bodyMat = isHologram 
      ? new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.5 })
      : new THREE.MeshStandardMaterial({ 
          color: livery.color, 
          roughness: 0.15, 
          metalness: 0.85, 
          clearcoat: 1.0, 
          clearcoatRoughness: 0.05 
        });

    const carbonMat = isHologram
      ? bodyMat
      : new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.8, metalness: 0.4 });

    const tireMat = isHologram
      ? bodyMat
      : new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.9 });

    const rimMat = isHologram
      ? bodyMat
      : new THREE.MeshStandardMaterial({ color: livery.accent, metalness: 0.9, roughness: 0.2 });

    const brakeMat = isHologram
      ? bodyMat
      : new THREE.MeshBasicMaterial({ color: 0xff1e18 });

    // Monocoque Chassis
    const noseMesh = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.8, 8), bodyMat);
    noseMesh.rotation.x = Math.PI / 2;
    noseMesh.position.set(0, 0.42, 2.2);
    bodyInnerGroup.add(noseMesh);

    const cockpitMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 2.8), bodyMat);
    cockpitMesh.position.set(0, 0.55, 0.2);
    bodyInnerGroup.add(cockpitMesh);
    if (!isHologram) carMainMeshRef.current = cockpitMesh;

    // Sidepods
    const sidepodL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 2.2), bodyMat);
    sidepodL.position.set(0.9, 0.45, 0.1);
    sidepodL.rotation.y = -0.05;
    const sidepodR = sidepodL.clone();
    sidepodR.position.set(-0.9, 0.45, 0.1);
    sidepodR.rotation.y = 0.05;
    bodyInnerGroup.add(sidepodL);
    bodyInnerGroup.add(sidepodR);

    // Front & Rear Wings
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.75), carbonMat);
    frontWing.position.set(0, 0.18, 3.4);
    bodyInnerGroup.add(frontWing);

    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.6), bodyMat);
    rearWing.position.set(0, 1.25, -1.95);
    bodyInnerGroup.add(rearWing);

    // Halo Safety Structure
    const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 8, 16, Math.PI), carbonMat);
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.set(0, 0.95, 0.5);
    bodyInnerGroup.add(haloMesh);

    carGroup.add(bodyInnerGroup);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.52, 32);
    const rimGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.54, 16);
    const discGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16);

    const frontWheels = [];
    const rearWheels = [];
    const brakeDiscs = [];

    const wheelPos = [
      { x: 1.35, z: 2.0, isFront: true },
      { x: -1.35, z: 2.0, isFront: true },
      { x: 1.4, z: -1.5, isFront: false },
      { x: -1.4, z: -1.5, isFront: false }
    ];

    wheelPos.forEach(p => {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(p.x, 0.55, p.z);

      const wMeshGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wMeshGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wMeshGroup.add(rim);

      const brakeDisc = new THREE.Mesh(discGeo, brakeMat);
      brakeDisc.rotation.z = Math.PI / 2;
      wMeshGroup.add(brakeDisc);
      brakeDiscs.push(brakeDisc);

      steerPivot.add(wMeshGroup);
      carGroup.add(steerPivot);

      if (p.isFront) frontWheels.push({ steerPivot, wMeshGroup });
      else rearWheels.push({ steerPivot, wMeshGroup });
    });

    carGroup.scale.set(1.4, 1.4, 1.4);
    return { carGroup, bodyInnerGroup, frontWheels, rearWheels, brakeDiscs };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040508);
    scene.fog = new THREE.FogExp2(0x040508, 0.0008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000);
    camera.position.set(0, 250, 450);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(400, 600, 300);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // Neon Cyber Point Lights
    const cyanLight = new THREE.PointLight(0x00f0ff, 2, 600);
    cyanLight.position.set(400, 100, 300);
    scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff00ff, 2, 600);
    magentaLight.position.set(300, 100, -300);
    scene.add(magentaLight);

    const goldLight = new THREE.PointLight(0xffd700, 2, 600);
    goldLight.position.set(-350, 100, 100);
    scene.add(goldLight);

    // Ground Grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3500, 3500),
      new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(2400, 100, 0x00f0ff, 0x111622);
    gridHelper.position.y = -3.8;
    scene.add(gridHelper);

    // Ambient Floating Nebula Star Particles
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    const starColors = [];
    for (let i = 0; i < 350; i++) {
      starPos.push(
        (Math.random() - 0.5) * 2000,
        Math.random() * 400 + 20,
        (Math.random() - 0.5) * 2000
      );
      const c = new THREE.Color();
      c.setHSL(Math.random() * 0.3 + 0.5, 1.0, 0.6);
      starColors.push(c.r, c.g, c.b);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    const starParticles = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 4, vertexColors: true, transparent: true, opacity: 0.7 }));
    scene.add(starParticles);

    // 3D Monza Circuit Curve
    const curve = generateMonza3DSpline();
    curveRef.current = curve;

    // Multi-Sector Color Track Ribbon (Sector 1 = Cyan, Sector 2 = Magenta, Sector 3 = Gold)
    const trackWidth = 16;
    const curvePoints = curve.getPoints(500);
    
    const sectorColors = [];
    const sectorPositions = [];

    curvePoints.forEach((pt, i) => {
      sectorPositions.push(pt.x, pt.y + 0.8, pt.z);
      const prog = i / 500;
      const c = new THREE.Color();
      if (prog < 0.33) {
        c.setHex(0x00f0ff); // Sector 1 Electric Cyan
      } else if (prog < 0.72) {
        c.setHex(0xff00ff); // Sector 2 Vivid Magenta
      } else {
        c.setHex(0xffd700); // Sector 3 Gold Yellow
      }
      sectorColors.push(c.r, c.g, c.b);
    });

    // Track Surface Ribbon
    const tubeGeo = new THREE.TubeGeometry(curve, 500, trackWidth / 2, 8, true);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x12151f, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
    const trackMesh = new THREE.Mesh(tubeGeo, trackMat);
    trackMesh.position.y = -1;
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Sector 3D Glowing Edge Ribbon
    const sectorGeo = new THREE.BufferGeometry();
    sectorGeo.setAttribute('position', new THREE.Float32BufferAttribute(sectorPositions, 3));
    sectorGeo.setAttribute('color', new THREE.Float32BufferAttribute(sectorColors, 3));
    const sectorLine = new THREE.Line(sectorGeo, new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 8 }));
    scene.add(sectorLine);

    // Glowing Neon DRS Zone Straights (Main straight & Back straight)
    const drsPositions = [];
    curvePoints.forEach((pt, i) => {
      const prog = i / 500;
      // DRS Zone 1 (Main straight 0.0 - 0.14) or DRS Zone 2 (Back straight 0.78 - 0.90)
      if ((prog < 0.14) || (prog > 0.78 && prog < 0.90)) {
        drsPositions.push(pt.x, pt.y + 1.6, pt.z);
      }
    });

    if (drsPositions.length > 0) {
      const drsGeo = new THREE.BufferGeometry();
      drsGeo.setAttribute('position', new THREE.Float32BufferAttribute(drsPositions, 3));
      const drsLine = new THREE.Line(drsGeo, new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 10 }));
      scene.add(drsLine);
    }

    // Extruded 3D Apex Kerbs
    curvePoints.forEach((pt, i) => {
      if (i % 8 === 0) {
        const isApex = (i > 50 && i < 110) || (i > 200 && i < 260) || (i > 400 && i < 470);
        if (isApex) {
          const kerbMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.4, 4.0),
            new THREE.MeshStandardMaterial({ color: (Math.floor(i / 8) % 2 === 0) ? 0xe10600 : 0xffffff, roughness: 0.3 })
          );
          const tangent = curve.getTangentAt(i / 500);
          const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
          kerbMesh.position.copy(pt).add(normal.clone().multiplyScalar(trackWidth / 2 + 1.2));
          kerbMesh.position.y += 0.2;
          kerbMesh.lookAt(kerbMesh.position.clone().add(tangent));
          scene.add(kerbMesh);
        }
      }
    });

    // Floating Turn Markers
    const turnData = [
      { name: 'Turn 1', label: 'T1 Rettifilo', t: 0.12 },
      { name: 'Turn 3', label: 'T3 Curva Grande', t: 0.28 },
      { name: 'Turn 4', label: 'T4 Roggia', t: 0.42 },
      { name: 'Turn 6', label: 'T6 Lesmo 1', t: 0.54 },
      { name: 'Turn 7', label: 'T7 Lesmo 2', t: 0.62 },
      { name: 'Turn 8', label: 'T8 Ascari', t: 0.76 },
      { name: 'Turn 11', label: 'T11 Parabolica', t: 0.94 },
    ];

    const markers = [];
    turnData.forEach(td => {
      const pos = curve.getPointAt(td.t);
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(7, 9, 32),
        new THREE.MeshBasicMaterial({ color: selectedZone === td.name ? 0x00f0ff : 0xe10600, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(pos.x, pos.y + 4, pos.z);
      ringMesh.userData = { zoneName: td.name, t: td.t };
      scene.add(ringMesh);
      markers.push(ringMesh);
    });
    turnMarkersRef.current = markers;

    // Instantiate Cars
    const mainCar = createF1Car(false, teamLivery);
    scene.add(mainCar.carGroup);
    carGroupRef.current = mainCar.carGroup;
    carBodyInnerRef.current = mainCar.bodyInnerGroup;
    frontWheelsRef.current = mainCar.frontWheels;
    rearWheelsRef.current = mainCar.rearWheels;
    brakeDiscsRef.current = mainCar.brakeDiscs;

    const ghostCar = createF1Car(true, teamLivery);
    ghostCar.carGroup.visible = showGhost;
    scene.add(ghostCar.carGroup);
    ghostMeshRef.current = ghostCar.carGroup;

    // Mouse drag for orbit control
    const domElem = containerRef.current;
    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      cameraAngleRef.current.theta -= deltaX * 0.005;
      cameraAngleRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2.1, cameraAngleRef.current.phi + deltaY * 0.005));
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isDraggingRef.current = false; };
    const handleWheel = (e) => {
      cameraAngleRef.current.distance = Math.max(80, Math.min(1200, cameraAngleRef.current.distance + e.deltaY * 0.5));
    };

    domElem.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElem.addEventListener('wheel', handleWheel);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handleClick = (e) => {
      const rect = domElem.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(turnMarkersRef.current);
      if (intersects.length > 0 && intersects[0].object.userData.zoneName) {
        onZoneClick(intersects[0].object.userData.zoneName);
      }
    };
    domElem.addEventListener('click', handleClick);

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      turnMarkersRef.current.forEach(m => { m.rotation.z += 0.015; });
      starParticles.rotation.y += 0.0004;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElem.removeEventListener('wheel', handleWheel);
      domElem.removeEventListener('click', handleClick);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [teamLivery]);

  // Update Car Movement, Physics & Camera
  useEffect(() => {
    if (!carGroupRef.current || !curveRef.current || !cameraRef.current) return;

    const curve = curveRef.current;
    const totalPoints = telemetryData.length > 0 ? telemetryData.length : 300;
    const t = Math.max(0, Math.min(1, currentPointIndex / Math.max(1, totalPoints - 1)));

    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    const targetHeading = Math.atan2(tangent.x, tangent.z);
    const prevHeading = carPhysicsRef.current.prevHeading || targetHeading;
    let headingDiff = targetHeading - prevHeading;
    if (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    if (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    carPhysicsRef.current.prevHeading = targetHeading;

    const currentData = telemetryData[currentPointIndex] || {};
    const speed = currentData.speed || 240;
    const throttle = currentData.throttle || (speed > 200 ? 100 : 30);
    const brake = currentData.brake || (speed < 140 ? 80 : 0);

    const targetRoll = Math.max(-0.2, Math.min(0.2, -headingDiff * 15.0));
    carPhysicsRef.current.roll += (targetRoll - carPhysicsRef.current.roll) * 0.15;

    const targetPitch = (brake / 100) * 0.08 - (throttle / 100) * 0.04;
    carPhysicsRef.current.pitch += (targetPitch - carPhysicsRef.current.pitch) * 0.15;

    const targetSteer = Math.max(-0.45, Math.min(0.45, headingDiff * 25.0));
    carPhysicsRef.current.steeringAngle += (targetSteer - carPhysicsRef.current.steeringAngle) * 0.2;
    carPhysicsRef.current.wheelRotation += (speed * 0.005);

    carGroupRef.current.position.set(pos.x, pos.y + 0.8, pos.z);
    carGroupRef.current.lookAt(pos.clone().add(tangent));

    if (carBodyInnerRef.current) {
      carBodyInnerRef.current.rotation.z = carPhysicsRef.current.roll;
      carBodyInnerRef.current.rotation.x = carPhysicsRef.current.pitch;
    }

    frontWheelsRef.current.forEach(w => {
      w.steerPivot.rotation.y = carPhysicsRef.current.steeringAngle;
      w.wMeshGroup.rotation.x = carPhysicsRef.current.wheelRotation;
    });

    rearWheelsRef.current.forEach(w => {
      w.wMeshGroup.rotation.x = carPhysicsRef.current.wheelRotation;
    });

    const brakeGlowOpacity = brake / 100;
    brakeDiscsRef.current.forEach(disc => {
      disc.material.color.setHSL(0.02, 1.0, 0.2 + brakeGlowOpacity * 0.6);
    });

    if (ghostMeshRef.current) {
      ghostMeshRef.current.visible = showGhost;
      const ghostT = (t + 0.025) % 1.0;
      const ghostPos = curve.getPointAt(ghostT);
      const ghostTangent = curve.getTangentAt(ghostT).normalize();
      ghostMeshRef.current.position.set(ghostPos.x, ghostPos.y + 0.8, ghostPos.z);
      ghostMeshRef.current.lookAt(ghostPos.clone().add(ghostTangent));
    }

    const camera = cameraRef.current;
    const targetFOV = speed > 300 ? 56 : 45;
    camera.fov += (targetFOV - camera.fov) * 0.08;
    camera.updateProjectionMatrix();

    if (cameraMode === 'CHASE') {
      const chaseOffset = tangent.clone().multiplyScalar(-38).add(new THREE.Vector3(0, 15, 0));
      camera.position.lerp(pos.clone().add(chaseOffset), 0.12);
      camera.lookAt(pos.clone().add(new THREE.Vector3(0, 2.5, 0)));
    } else if (cameraMode === 'COCKPIT') {
      const cockpitPos = pos.clone().add(tangent.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, 1.9, 0));
      camera.position.copy(cockpitPos);
      camera.lookAt(pos.clone().add(tangent.clone().multiplyScalar(45)).add(new THREE.Vector3(0, 1.5, 0)));
    } else if (cameraMode === 'TV_BROADCAST') {
      const tvTowers = [
        new THREE.Vector3(470, 25, 340),
        new THREE.Vector3(420, 30, -320),
        new THREE.Vector3(-350, 25, -280),
        new THREE.Vector3(-430, 25, 270)
      ];
      let closestTower = tvTowers[0];
      let minDist = tvTowers[0].distanceTo(pos);
      tvTowers.forEach(tower => {
        const d = tower.distanceTo(pos);
        if (d < minDist) { minDist = d; closestTower = tower; }
      });
      camera.position.lerp(closestTower, 0.05);
      camera.lookAt(pos.clone().add(new THREE.Vector3(0, 2, 0)));
    } else if (cameraMode === 'TACTICAL') {
      camera.position.lerp(pos.clone().add(new THREE.Vector3(0, 240, 15)), 0.1);
      camera.lookAt(pos);
    } else if (cameraMode === 'ORBIT') {
      const { theta, phi, distance } = cameraAngleRef.current;
      const camX = pos.x + distance * Math.sin(phi) * Math.sin(theta);
      const camY = pos.y + distance * Math.cos(phi);
      const camZ = pos.z + distance * Math.sin(phi) * Math.cos(theta);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(pos);
    }
  }, [currentPointIndex, telemetryData, cameraMode, showGhost]);

  return (
    <div className="circuit-3d-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: cameraMode === 'ORBIT' ? 'grab' : 'default' }} />
      
      <div className="canvas-controls-overlay">
        <div className="camera-mode-selector">
          <span className="mode-label">CAM POV</span>
          <button className={`btn-cam ${cameraMode === 'CHASE' ? 'active' : ''}`} onClick={() => onPointSelect('CHASE')}>🏎️ CHASE</button>
          <button className={`btn-cam ${cameraMode === 'COCKPIT' ? 'active' : ''}`} onClick={() => onPointSelect('COCKPIT')}>👀 COCKPIT</button>
          <button className={`btn-cam ${cameraMode === 'TV_BROADCAST' ? 'active' : ''}`} onClick={() => onPointSelect('TV_BROADCAST')}>📺 TV BROADCAST</button>
          <button className={`btn-cam ${cameraMode === 'TACTICAL' ? 'active' : ''}`} onClick={() => onPointSelect('TACTICAL')}>🛰️ OVERHEAD</button>
          <button className={`btn-cam ${cameraMode === 'ORBIT' ? 'active' : ''}`} onClick={() => onPointSelect('ORBIT')}>🌐 3D ORBIT</button>
        </div>

        <div className="speed-heatmap-legend">
          <div className="legend-sector-labels">
            <span style={{ color: '#00f0ff' }}>● SECTOR 1</span>
            <span style={{ color: '#ff00ff' }}>● SECTOR 2</span>
            <span style={{ color: '#ffd700' }}>● SECTOR 3</span>
            <span style={{ color: '#00ff88' }}>⚡ DRS ZONE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Circuit3D;
