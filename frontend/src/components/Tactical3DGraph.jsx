import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Database, Network, Info } from 'lucide-react';

const Tactical3DGraph = ({ zones = [], telemetryCount = 0 }) => {
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080d);
    scene.fog = new THREE.FogExp2(0x06080d, 0.002);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 40, 180);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const pointLight = new THREE.PointLight(0x00f0ff, 3, 300);
    pointLight.position.set(0, 50, 100);
    scene.add(pointLight);

    // 1. Central Driver Node (Charles Leclerc)
    const driverGeo = new THREE.SphereGeometry(7, 32, 32);
    const driverMat = new THREE.MeshStandardMaterial({
      color: 0xe10600,
      emissive: 0x880000,
      roughness: 0.2,
      metalness: 0.8
    });
    const driverNode = new THREE.Mesh(driverGeo, driverMat);
    driverNode.position.set(0, 0, 0);
    driverNode.userData = { label: 'Driver: Charles Leclerc', type: 'Driver', details: 'Scuderia Ferrari #16' };
    scene.add(driverNode);

    // Halo ring around Driver
    const haloGeo = new THREE.RingGeometry(10, 11, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xe10600, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    scene.add(halo);

    // 2. Zone Nodes positioned in an orbit
    const defaultZones = zones.length > 0 ? zones : ['Turn 1', 'Turn 3', 'Turn 4', 'Turn 6', 'Turn 7', 'Turn 8', 'Turn 11'];
    const zoneNodes = [];
    const eventNodes = [];
    const lines = [];

    const radius = 70;
    defaultZones.forEach((zName, i) => {
      const angle = (i / defaultZones.length) * Math.PI * 2;
      const zX = Math.cos(angle) * radius;
      const zZ = Math.sin(angle) * radius;
      const zY = (Math.sin(i) * 15);

      // Zone Sphere
      const zoneGeo = new THREE.SphereGeometry(4.5, 24, 24);
      const zoneMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x004466,
        roughness: 0.3
      });
      const zMesh = new THREE.Mesh(zoneGeo, zoneMat);
      zMesh.position.set(zX, zY, zZ);
      zMesh.userData = { label: `Zone: ${zName}`, type: 'Zone', details: 'Circuit Track Sector' };
      scene.add(zMesh);
      zoneNodes.push(zMesh);

      // Connector: Driver -> Zone
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(zX, zY, zZ)
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.4 });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      lines.push(line);

      // Telemetry Event sub-nodes
      for (let j = 0; j < 3; j++) {
        const evAngle = angle + (j - 1) * 0.15;
        const evRadius = radius + 25;
        const evX = Math.cos(evAngle) * evRadius;
        const evZ = Math.sin(evAngle) * evRadius;
        const evY = zY + (j - 1) * 10;

        const evGeo = new THREE.SphereGeometry(1.8, 16, 16);
        const evMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const evMesh = new THREE.Mesh(evGeo, evMat);
        evMesh.position.set(evX, evY, evZ);
        evMesh.userData = { label: `Event #${i * 3 + j + 1}`, type: 'Event', details: `Speed & Coordinates @ ${zName}` };
        scene.add(evMesh);
        eventNodes.push(evMesh);

        // Connector: Zone -> Event
        const evLineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(zX, zY, zZ),
          new THREE.Vector3(evX, evY, evZ)
        ]);
        const evLineMat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.3 });
        scene.add(new THREE.Line(evLineGeo, evLineMat));
      }
    });

    // 3. Orbit & Raycast interactions
    let angleRef = 0;
    let animationFrameId;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allObjects = [driverNode, ...zoneNodes, ...eventNodes];
      const intersects = raycaster.intersectObjects(allObjects);

      if (intersects.length > 0) {
        setSelectedNode(intersects[0].object.userData);
      } else {
        setSelectedNode(null);
      }
    };

    containerRef.current.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      angleRef += 0.003;

      // Slow orbit rotation of scene
      scene.rotation.y = angleRef;
      driverNode.rotation.y += 0.01;
      halo.rotation.z += 0.01;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove);
        if (renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [zones]);

  return (
    <div className="tactical-3d-graph-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Info Card Overlay */}
      <div className="graph-3d-overlay">
        <div className="overlay-header">
          <Network size={16} color="#00f0ff" />
          <span>NEO4J 3D SPATIAL GRAPH</span>
        </div>
        
        {selectedNode ? (
          <div className="node-tooltip-card animate-fade-in">
            <span className="tooltip-badge">{selectedNode.type}</span>
            <h4>{selectedNode.label}</h4>
            <p>{selectedNode.details}</p>
          </div>
        ) : (
          <div className="node-tooltip-card muted">
            <Info size={14} />
            <p>Hover over 3D graph nodes to inspect relationship properties.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tactical3DGraph;
