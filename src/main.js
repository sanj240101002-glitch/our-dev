import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm";
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalBlurShader } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/shaders/VerticalBlurShader.js';

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

// Positioning and sizing constants for character and text
const viewOffsetZ = isMobile ? 4.5 : 6; 

// --- UPDATED OFFSETS ---
// Pushed character further out, brought text closer in
const charXOffset = isMobile ? 3.5 : 7.0; 
const textXOffset = isMobile ? 0.8 : 1.0; 

// Height of the character
const characterHeight = isMobile ? 7.5 : 10.5; 

// Global animation variables
let particleSystem;
const floatingSymbols = []; 
const uiElements = []; // Tracks character and text panels to keep them upright
const clock = new THREE.Clock();
const CORRIDOR_RADIUS = 4.2;      // thickness of tunnel
const CORRIDOR_LINES = 12;        // number of neon rails
const CORRIDOR_Y_OFFSET = cameraHeight;
// ==========================
// SCENE SETUP (TWO SCENES FOR SELECTIVE GLOW)
// ==========================

// 1. Scene for objects that glow (Tubes, Particles, Symbols)
const glowScene = new THREE.Scene();
glowScene.background = new THREE.Color(0x000005); 
glowScene.fog = new THREE.FogExp2(0x000005, 0.03); 

// 2. Scene for objects that don't glow (Snowmen, Nametags)
const nonGlowScene = new THREE.Scene();
nonGlowScene.fog = new THREE.FogExp2(0x000005, 0.045); 

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

const renderGlowPass = new RenderPass(glowScene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.08;
bloomPass.strength = 0.5; 
bloomPass.radius = 0.5;

const hBlurPass = new ShaderPass(HorizontalBlurShader);
const vBlurPass = new ShaderPass(VerticalBlurShader);

const blurAmount = 3.0; 
hBlurPass.uniforms.h.value = blurAmount / width;
vBlurPass.uniforms.v.value = blurAmount / height;

const composer = new EffectComposer(renderer);
composer.addPass(renderGlowPass);
composer.addPass(bloomPass);
composer.addPass(hBlurPass); 
composer.addPass(vBlurPass); 

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
  const pointsPerLine = 80;
  const gradientTexture = generateGradientTexture();

  const tubeMaterial = new THREE.MeshBasicMaterial({
    map: gradientTexture,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  for (let i = 0; i < CORRIDOR_LINES; i++) {
    const angle = (i / CORRIDOR_LINES) * Math.PI * 2;

    const offsetX = Math.cos(angle) * CORRIDOR_RADIUS;
    const offsetY = Math.sin(angle) * CORRIDOR_RADIUS + CORRIDOR_Y_OFFSET;

    const points = [];

    for (let j = 0; j <= pointsPerLine; j++) {
      const t = j / pointsPerLine;
      const z = deepZ + t * (Math.abs(deepZ - startZ) + 30) - 10;

      const waveX = getWaveX(z);

      points.push(
        new THREE.Vector3(
          waveX + offsetX,
          offsetY,
          z
        )
      );
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 140, 0.045, 10, false);
    const mesh = new THREE.Mesh(geometry, tubeMaterial);

    glowScene.add(mesh);
  }

  // ---------- PARTICLES (UNCHANGED) ----------
  const particleCount = 800;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = [];
  const particleData = [];

  for (let i = 0; i < particleCount; i++) {
    const z = deepZ + Math.random() * (Math.abs(deepZ - startZ) + 20) - 10;

    const angle = Math.random() * Math.PI * 2;
    const radius = CORRIDOR_RADIUS * Math.random();

    const x = getWaveX(z) + Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius + cameraHeight;

    particlePos.push(x, y, z);

    particleData.push({
      baseX: Math.cos(angle) * radius,
      baseY: y,
      speedX: 0.2,
      speedY: 0.2,
      phase: Math.random() * Math.PI * 2
    });
  }

  particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(particlePos, 3));
  particleGeo.userData.animationData = particleData;

  const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    transparent: true,
    opacity: 0.6,
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
      
      ctx.font = 'bold 100px monospace';
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

// Info panel generator function
function createInfoPanel(title, infoLines) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 1024; canvas.height = 1024;
  
  // Title
  ctx.fillStyle = "#00ffff"; 
  ctx.font = "bold 90px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(title, 40, 80);
  
  // Underline
  ctx.fillRect(40, 190, 400, 8);

  // Body Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "50px monospace";
  infoLines.forEach((line, index) => {
    ctx.fillText(line, 40, 260 + (index * 80));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); 
  
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), material);
  
  return mesh;
}

// ==========================
// WAVE FUNCTION & IMAGE LOADING 
// ==========================

const textureLoader = new THREE.TextureLoader();

textureLoader.load(
  './public/models/aryannobg1.png',
  function (svgTexture) {
    svgTexture.colorSpace = THREE.SRGBColorSpace;
    svgTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    svgTexture.minFilter = THREE.LinearMipmapLinearFilter;
    svgTexture.magFilter = THREE.LinearFilter;

    const svgMaterial = new THREE.MeshBasicMaterial({ 
      map: svgTexture, 
      transparent: true, 
      toneMapped: false, 
      alphaTest: 0.1     
    });

    const imageWidth = svgTexture.image.width;
    const imageHeight = svgTexture.image.height;
    const aspectRatio = imageWidth / imageHeight;

    const calculatedWidth = characterHeight * aspectRatio;
    const svgGeometry = new THREE.PlaneGeometry(calculatedWidth, characterHeight);

    for (let n = 0; n < boxCount; n++) {
      const baseZ = -(Math.PI / 2 + n * Math.PI) / (frequency * 0.1 * waveStretch);
      const z = baseZ * boxSpacingMultiplier;
      const waveCenter = getWaveX(z);
      
      const mesh = new THREE.Mesh(svgGeometry, svgMaterial);
      
      const infoText = [
        "ROLE: Creative Developer",
        "SKILLS: Three.js, GSAP, React",
        "STATUS: Building the Web",
        `EXP LEVEL: ${n + 1}000`
      ];
      const infoPanel = createInfoPanel(`PROFILE ${n + 1}`, infoText);

      // --- ALTERNATING SIDES LOGIC ---
      const isEven = n % 2 === 0;
      
      // Apply the newly adjusted separated offsets here
      const charX = waveCenter + (isEven ? -charXOffset : charXOffset);
      const textX = waveCenter + (isEven ? textXOffset : -textXOffset);

      // Position them flat. Removing lookAt forces them perfectly parallel to the screen.
      mesh.position.set(charX, cameraHeight, z);
      infoPanel.position.set(textX, cameraHeight + 1.5, z); 

      nonGlowScene.add(mesh);
      nonGlowScene.add(infoPanel);
      
      // Store them to keep them perfectly upright during camera tilt
      uiElements.push(mesh, infoPanel);
    }
  }
);

// ==========================
// SCROLL ANIMATION (MOBILE-OPTIMIZED SNAPPING)
// ==========================

const snapPoints = [];
const totalPathZ = startZ - deepZ; 

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
    scrub: isMobile ? 0.5 : 1, 
    snap: {
      snapTo: snapPoints,
      duration: { min: 0.2, max: 0.6 }, 
      delay: 0.05, 
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

  // Keep planes perfectly upright and parallel to the screen 
  // by matching the camera's Z-tilt dynamically.
  uiElements.forEach(el => {
    el.rotation.z = camera.rotation.z;
  });

  // --- RENDERING SEQUENCE ---
  renderer.clear();
  composer.render();
  renderer.clearDepth();
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
  
  hBlurPass.uniforms.h.value = blurAmount / width;
  vBlurPass.uniforms.v.value = blurAmount / height;

  ScrollTrigger.refresh();
}

window.addEventListener("resize", handleResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleResize);
}


//offsetvalue
// X= 1.7483819715837419 Y= -0.2537957758028814
// main.js:168 X= 0.37615036034312466 Y= 2.938568163765949
// main.js:168 X= 4.547051525102319 Y= 3.3807998003225275
// main.js:168 X= -2.67575738441814 Y= -0.2148295497078211
// main.js:168 X= -3.6508671319680905 Y= 3.275843443981629
// main.js:168 X= 5.152507629685007 Y= -2.792217197385433
// main.js:168 X= 6.482658198426552 Y= 0.3352040893300895
// main.js:168 X= -4.679349539083869 Y= 2.3859317233074377
// main.js:168 X= -3.3675988880104306 Y= -3.290377940167526
// main.js:168 X= -6.501502380810381 Y= 4.223225711784081




// X= -3.4355386337975053 Y= 3.311441195185792
// main.js:168 X= 0.845191074976543 Y= 4.45449480370279
// main.js:168 X= 2.674786124851572 Y= 2.2276770054092405
// main.js:168 X= 0.39237096488967604 Y= -0.7532058791256807
// main.js:168 X= 2.1979776102886266 Y= 3.7402629930733
// main.js:168 X= -2.783879452884129 Y= -2.8673156040078767
// main.js:168 X= -4.073084161560644 Y= -1.4377166904080467
// main.js:168 X= -5.041856094681371 Y= 1.373076236068799
// main.js:168 X= 4.36282179747442 Y= 0.197460519788898
// main.js:168 X= -3.514212881647916 Y= 4.087973697964573



// X= 5.842776029218738 Y= -0.07086359952106192
// main.js:168 X= 3.4706628393656724 Y= 2.803552821144858
// main.js:168 X= -5.672243876941672 Y= -2.0886105792466547
// main.js:168 X= -6.4087113638709186 Y= -1.0104415987244848
// main.js:168 X= -3.6573119244498336 Y= 0.8180122759966965
// main.js:168 X= 5.423519980426892 Y= -1.843851314698758
// main.js:168 X= 0.811910666307659 Y= 3.2997060540207204
// main.js:168 X= -4.531060370658029 Y= 2.6882539836284693
// main.js:168 X= -3.3688985959751263 Y= 3.9218282438548004
// main.js:168 X= 6.218237219376581 Y= -0.5701949063381605