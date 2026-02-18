import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm";
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.config({ ignoreMobileResize: true });
ScrollTrigger.normalizeScroll(true);

// ==========================
// CONFIGURATION
// ==========================

const isMobile = window.innerWidth < 1024;
const MAX_PIXEL_RATIO = isMobile ? 1.5 : 2;

const nameSideOffset = 3;
const amplitude = isMobile ? 3 : 4.5;
const frequency = 1;
const waveStretch = 1.8;
const boxCount = 5;
const boxSpacingMultiplier = 1;
const boxInset = 0.65;
const cameraHeight = 0.6;
const lookAheadDistance = 1.5;

const startZ = 2; 
const deepZ = isMobile ? -75 : -95;

// Global animation variables
let particleSystem;
const clock = new THREE.Clock();

// ==========================
// SCENE SETUP
// ==========================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005); 
scene.fog = new THREE.FogExp2(0x000005, 0.03); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.5; 

function getViewportSize() {
  const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  return { width, height };
}

const { width, height } = getViewportSize();
renderer.setSize(width, height);
camera.aspect = width / height;
camera.updateProjectionMatrix();

document.body.appendChild(renderer.domElement);

// --- POST-PROCESSING (NEON GLOW) ---
const renderScene = new RenderPass(scene, camera);

// Resolution, strength, radius, threshold
const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.15;
bloomPass.strength = 1.5; // High strength for neon look
bloomPass.radius = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==========================
// WAVE FUNCTION
// ==========================

function getWaveX(z) {
  const t = -z * 0.1 * waveStretch;
  const raw = (2 / Math.PI) * Math.asin(Math.sin(frequency * t));
  return amplitude * raw * 0.75;
}

// ==========================
// GRADIENT TEXTURE GENERATOR
// ==========================
function generateGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 64; // Vertical gradient
  const ctx = canvas.getContext('2d');

  // Gradient runs along the length of the tube
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  
  // 1. Fade In (Transparent)
  gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
  // 2. Bright Core (Cyan)
  gradient.addColorStop(0.2, 'rgba(0, 255, 255, 0.5)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)'); // White hot center
  gradient.addColorStop(0.8, 'rgba(0, 255, 255, 0.5)');
  // 3. Fade Out (Transparent)
  gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping; // Allows gradient to repeat if needed
  return texture;
}

// ==========================
// VISUAL EFFECTS (UPDATED)
// ==========================

function createTunnelVisuals() {
  
  // --- 1. THICK GLOWING TUBES (STATIC) ---
  const lineCount = 10; 
  const pointsPerLine = 60;
  const gradientTexture = generateGradientTexture();

  // Material for the tubes
  const tubeMaterial = new THREE.MeshBasicMaterial({
    map: gradientTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false // Helps with transparency overlapping
  });

  for (let i = 0; i < lineCount; i++) {
    const points = [];
    const offsetX = (Math.random() - 0.5) * 14; 
    const offsetY = (Math.random() - 0.5) * 8 + cameraHeight;

    // Generate path points
    for (let j = 0; j <= pointsPerLine; j++) {
      const ratio = j / pointsPerLine;
      const z = deepZ + (ratio * (Math.abs(deepZ - startZ) + 30)) - 10; 
      const x = getWaveX(z) + offsetX;
      points.push(new THREE.Vector3(x, offsetY, z));
    }

    // Create a smooth curve from points
    const curve = new THREE.CatmullRomCurve3(points);
    
    // Create Tube Geometry (path, segments, radius, radialSegments, closed)
    // Radius 0.04 gives it thickness
    const geometry = new THREE.TubeGeometry(curve, 100, 0.04, 8, false);
    
    // Adjust UVs to map gradient along the length correctly
    // By default Tube maps U around, V along length. We want gradient along V.
    const uvAttribute = geometry.attributes.uv;
    for (let k = 0; k < uvAttribute.count; k++) {
        // Scale UVs if necessary to repeat the gradient or stretch it
        // uvAttribute.setY(k, uvAttribute.getY(k) * 1); 
    }
    
    const mesh = new THREE.Mesh(geometry, tubeMaterial);
    scene.add(mesh);
  }

  // --- 2. FLOATING PARTICLES (MOVING) ---
  const particleCount = 800;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = [];
  const particleData = []; 

  for (let i = 0; i < particleCount; i++) {
    const z = deepZ + Math.random() * (Math.abs(deepZ - startZ) + 20) - 10;
    const spreadX = (Math.random() - 0.5) * 18;
    const x = getWaveX(z) + spreadX;
    const y = (Math.random() - 0.5) * 12 + cameraHeight;

    particlePos.push(x, y, z);

    particleData.push({
        baseX: spreadX, 
        baseY: y,
        speedX: 0.1 + Math.random() * 0.5,
        speedY: 0.1 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
    });
  }

  particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(particlePos, 3));
  particleGeo.userData.animationData = particleData;

  const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.07,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending
  });

  particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);
}

createTunnelVisuals();

// ==========================
// INITIAL CAMERA & ASSETS
// ==========================

camera.position.set(getWaveX(deepZ), cameraHeight, deepZ);
camera.lookAt(getWaveX(deepZ), cameraHeight, deepZ - lookAheadDistance);


const textureLoader = new THREE.TextureLoader();
const svgTexture = textureLoader.load('./public/models/snowman.png');
const svgMaterial = new THREE.MeshBasicMaterial({ map: svgTexture, transparent: true });
const svgGeometry = new THREE.PlaneGeometry(2, 2);

function createNameTag(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512; canvas.height = 256;
  ctx.fillStyle = "white"; ctx.font = "bold 80px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), material);
  mesh.scale.set(0.6, 0.6, 0.6);
  return mesh;
}

function createWave() {
  for (let n = 0; n < boxCount; n++) {
    const baseZ = -(Math.PI / 2 + n * Math.PI) / (frequency * 0.1 * waveStretch);
    const z = baseZ * boxSpacingMultiplier;
    const x = getWaveX(z) * boxInset;
    const mesh = new THREE.Mesh(svgGeometry, svgMaterial);
    const nameTag = createNameTag(`BOX ${n + 1}`);
    const isRightBox = x > 0;

    if (isMobile) {
      mesh.position.set(isRightBox ? x + 0.2 : x - 0.2, cameraHeight, z);
      nameTag.position.set(isRightBox ? x + 0.2 : x - 0.2, cameraHeight - 1.5, z);
    } else {
      nameTag.position.set(isRightBox ? 1 + nameSideOffset : nameSideOffset - 7, cameraHeight, z);
      mesh.position.set(x, cameraHeight, z);
    }
    scene.add(mesh);
    scene.add(nameTag);
  }
}
createWave();

// ==========================
// SCROLL ANIMATION
// ==========================

gsap.to(camera.position, {
  z: startZ,
  ease: "none",
  scrollTrigger: {
    trigger: "#scrollArea",
    start: "top top",
    end: "bottom bottom",
    scrub: isMobile ? 1.5 : 1,
  },
  onUpdate: () => {
    camera.position.x = getWaveX(camera.position.z);
    camera.position.y = cameraHeight;
    const targetTilt = -camera.position.x * 0.15;
    camera.rotation.z += (targetTilt - camera.rotation.z) * 0.08;
    const lookZ = camera.position.z - lookAheadDistance;
    const lookX = getWaveX(camera.position.z);
    camera.lookAt(lookX, cameraHeight, lookZ);
  }
});

// ==========================
// RENDER LOOP
// ==========================

function animate() {
  requestAnimationFrame(animate);
  
  const time = clock.getElapsedTime();

  // --- Animate Particles (Lines are skipped so they stay static) ---
  if (particleSystem) {
    const positions = particleSystem.geometry.attributes.position.array;
    const data = particleSystem.geometry.userData.animationData;

    for (let i = 0; i < data.length; i++) {
      const i3 = i * 3;
      const particleData = data[i];
      const z = positions[i3 + 2];
      
      const waveCenterX = getWaveX(z);
      
      // Particles still wander organically
      const wanderX = Math.sin(time * particleData.speedX + particleData.phase) * 0.5;
      const wanderY = Math.cos(time * particleData.speedY + particleData.phase) * 0.5;

      positions[i3] = waveCenterX + particleData.baseX + wanderX;
      positions[i3 + 1] = particleData.baseY + wanderY;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  // Use composer for bloom
  composer.render();
}
animate();

// ==========================
// RESIZE HANDLING
// ==========================

function handleResize() {
  const { width, height } = getViewportSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height);
  composer.setSize(width, height); 
  ScrollTrigger.refresh();
}

window.addEventListener("resize", handleResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleResize);
}