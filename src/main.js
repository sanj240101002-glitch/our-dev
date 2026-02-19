import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm";
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.config({ ignoreMobileResize: true });
// ScrollTrigger.normalizeScroll(true); // MUST BE COMMENTED OUT FOR MOBILE SNAPPING TO WORK

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
const floatingSymbols = []; 
const clock = new THREE.Clock();

// ==========================
// SCENE SETUP (TWO SCENES FOR SELECTIVE GLOW)
// ==========================

// 1. Scene for objects that glow (Tubes, Particles, Symbols)
const glowScene = new THREE.Scene();
glowScene.background = new THREE.Color(0x000005); 
glowScene.fog = new THREE.FogExp2(0x000005, 0.03); 

// 2. Scene for objects that don't glow (Snowmen, Nametags)
const nonGlowScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.5; 

// IMPORTANT: Tell the renderer not to automatically erase the screen between renders
renderer.autoClear = false; 

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

// --- POST-PROCESSING ---

// Only put the glowing scene into the composer
const renderGlowPass = new RenderPass(glowScene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.08;
bloomPass.strength = 0.5; 
bloomPass.radius = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(renderGlowPass);
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
  canvas.height = 64; 
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
  gradient.addColorStop(0.2, 'rgba(0, 255, 255, 0.5)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)'); 
  gradient.addColorStop(0.8, 'rgba(0, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping; 
  return texture;
}

// ==========================
// VISUAL EFFECTS
// ==========================

function createTunnelVisuals() {
  const lineCount = 10; 
  const pointsPerLine = 60;
  const gradientTexture = generateGradientTexture();

  const tubeMaterial = new THREE.MeshBasicMaterial({
    map: gradientTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  for (let i = 0; i < lineCount; i++) {
    const points = [];
    const offsetX = (Math.random() - 0.5) * 14; 
    const offsetY = (Math.random() - 0.5) * 8 + cameraHeight;

    for (let j = 0; j <= pointsPerLine; j++) {
      const ratio = j / pointsPerLine;
      const z = deepZ + (ratio * (Math.abs(deepZ - startZ) + 30)) - 10; 
      const x = getWaveX(z) + offsetX;
      points.push(new THREE.Vector3(x, offsetY, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 100, 0.04, 8, false);
    const mesh = new THREE.Mesh(geometry, tubeMaterial);
    glowScene.add(mesh); 
  }

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
  glowScene.add(particleSystem); 
}

// ==========================
// DEVELOPER SYNTAX / MATH SYMBOLS 
// ==========================

function createFloatingSymbols() {
  const chars = [
    '{', '</>', '=>', '||', '&&', '!=', '===', '();', '[]', '==','0','1', ';', '//', '/*',
    '∑', '∫', 'π', '∞', 'λ', 'Δ', 'Ω', 'θ', '√', '≈', '≠',
    '404', '!', 'X', 'null'
  ];
  
  const baseColors = ['#00ffff', '#00aaff', '#ff0000', '#00ff88'];

  const materials = chars.flatMap(char => {
    return baseColors.map(colorHex => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      
      ctx.shadowColor = colorHex;
      ctx.shadowBlur = 4; 
      ctx.fillStyle = colorHex;
      
      ctx.font = 'bold 50px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillText(char, 64, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      
      const material = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
        depthWrite: false
      });
      
      material.color.set(colorHex);

      return material;
    });
  });

  const symbolCount = 55; 

  for (let i = 0; i < symbolCount; i++) {
    const randomMaterial = materials[Math.floor(Math.random() * materials.length)];
    const sprite = new THREE.Sprite(randomMaterial);
    
    const z = deepZ + Math.random() * (Math.abs(deepZ - startZ) + 20) - 10;
    const spreadX = (Math.random() - 0.5) * 20; 
    const x = getWaveX(z) + spreadX;
    const y = (Math.random() - 0.5) * 14 + cameraHeight;
    
    sprite.position.set(x, y, z);
    
    const scale = 0.5 + Math.random() * 0.7; 
    sprite.scale.set(scale, scale, scale);
    
    sprite.userData = {
       baseX: spreadX,
       baseY: y,
       speedX: (Math.random() - 0.5) * 0.15, 
       speedY: (Math.random() - 0.5) * 0.15,
       phase: Math.random() * Math.PI * 2,
       zSpeed: Math.random() * 0.02 + 0.005 
    };
    
    glowScene.add(sprite); 
    floatingSymbols.push(sprite);
  }
}

createTunnelVisuals();
createFloatingSymbols();

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

// ==========================
// WAVE FUNCTION (SNOWMEN) 
// ==========================

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
    nonGlowScene.add(mesh);
    nonGlowScene.add(nameTag);
  }
}
createWave();

// ==========================
// SCROLL ANIMATION (MOBILE-OPTIMIZED SNAPPING)
// ==========================

const snapPoints = [];
const totalPathZ = startZ - deepZ; 
// Bring camera slightly closer on mobile so it doesn't overshoot the view
const viewOffsetZ = isMobile ? 4.5 : 6; 

for (let n = 0; n < boxCount; n++) {
  const baseZ = -(Math.PI / 2 + n * Math.PI) / (frequency * 0.1 * waveStretch);
  const boxZ = baseZ * boxSpacingMultiplier;
  const targetCameraZ = boxZ + viewOffsetZ;
  const progress = (targetCameraZ - deepZ) / totalPathZ;
  
  if (progress >= 0 && progress <= 1) {
      snapPoints.push(progress);
  }
}

snapPoints.sort((a, b) => a - b);

gsap.to(camera.position, {
  z: startZ,
  ease: "none",
  scrollTrigger: {
    trigger: "#scrollArea",
    start: "top top",
    end: "bottom bottom",
    scrub: isMobile ? 0.5 : 1, // Lowered scrub for mobile.
    snap: {
      snapTo: snapPoints,
      duration: { min: 0.2, max: 0.6 }, // Faster snapping duration
      delay: 0.05, // Snaps quickly after scroll stops
      ease: "power1.inOut"
    }
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

  if (particleSystem) {
    const positions = particleSystem.geometry.attributes.position.array;
    const data = particleSystem.geometry.userData.animationData;

    for (let i = 0; i < data.length; i++) {
      const i3 = i * 3;
      const particleData = data[i];
      const z = positions[i3 + 2];
      
      const waveCenterX = getWaveX(z);
      
      const wanderX = Math.sin(time * particleData.speedX + particleData.phase) * 0.5;
      const wanderY = Math.cos(time * particleData.speedY + particleData.phase) * 0.5;

      positions[i3] = waveCenterX + particleData.baseX + wanderX;
      positions[i3 + 1] = particleData.baseY + wanderY;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  floatingSymbols.forEach(sprite => {
    const waveCenterX = getWaveX(sprite.position.z);
    
    const wanderX = Math.sin(time * sprite.userData.speedX + sprite.userData.phase) * 0.3;
    const wanderY = Math.cos(time * sprite.userData.speedY + sprite.userData.phase) * 0.3;
    
    sprite.position.x = waveCenterX + sprite.userData.baseX + wanderX;
    sprite.position.y = sprite.userData.baseY + wanderY;

    sprite.position.z += sprite.userData.zSpeed;

    if (sprite.position.z > startZ + 5) {
      sprite.position.z = deepZ - 10;
    }
  });

  // --- RENDERING SEQUENCE ---
  
  // 1. Clear everything manually
  renderer.clear();
  
  // 2. Render the glowing scene (Tubes, Particles, Syntax) through the Bloom Pass onto the screen
  composer.render();
  
  // 3. Clear the depth buffer. This ensures our snowmen render perfectly on top of the glowing background.
  renderer.clearDepth();
  
  // 4. Render the snowmen directly to the screen WITHOUT Bloom over what's already there
  renderer.render(nonGlowScene, camera);
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