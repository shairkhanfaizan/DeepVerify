import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { getAuthHeaders } from '../services/api';

// Define props
interface ThreeDHeatmapProps {
  originalImageSrc: string;
  heatmapSrc: string;
}

// The mesh component
function HeatmapSurface({ originalImageSrc, heatmapSrc }: { originalImageSrc: string, heatmapSrc: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Load textures
  const [originalTex, setOriginalTex] = useState<THREE.Texture | null>(null);
  const [heatmapTex, setHeatmapTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let active = true;
    let origObjUrl = '';
    let heatObjUrl = '';
    
    const loadImages = async () => {
      try {
        const origRes = await fetch(originalImageSrc, { headers: getAuthHeaders(), credentials: "include" });
        if (!origRes.ok) throw new Error("Original fetch failed");
        const origBlob = await origRes.blob();
        origObjUrl = URL.createObjectURL(origBlob);
        
        const heatRes = await fetch(heatmapSrc, { headers: getAuthHeaders(), credentials: "include" });
        if (!heatRes.ok) throw new Error("Heatmap fetch failed");
        const heatBlob = await heatRes.blob();
        heatObjUrl = URL.createObjectURL(heatBlob);
        
        if (active) {
          new THREE.TextureLoader().load(origObjUrl, (tex) => setOriginalTex(tex));
          new THREE.TextureLoader().load(heatObjUrl, (tex) => setHeatmapTex(tex));
        }
      } catch (err) {
        console.error("Failed to load textures", err);
      }
    };
    
    loadImages();
    
    return () => { 
      active = false;
      if (origObjUrl) URL.revokeObjectURL(origObjUrl);
      if (heatObjUrl) URL.revokeObjectURL(heatObjUrl);
    };
  }, [originalImageSrc, heatmapSrc]);

  // A custom shader to displace geometry based on heatmap intensity
  const shaderArgs = useMemo(() => {
    if (!originalTex || !heatmapTex) return null;
    
    return {
      uniforms: {
        tDiffuse: { value: originalTex },
        tHeatmap: { value: heatmapTex },
        displacementScale: { value: 2.0 },
      },
      vertexShader: `
        uniform sampler2D tHeatmap;
        uniform float displacementScale;
        varying vec2 vUv;
        varying float vElevation;
        
        void main() {
          vUv = uv;
          // Sample heatmap color. Since it's jet colormap, red/yellow indicate high activation.
          // We can approximate intensity by using the red channel primarily.
          vec4 heatColor = texture2D(tHeatmap, uv);
          float elevation = heatColor.r; 
          vElevation = elevation;
          
          vec3 newPosition = position + normal * (elevation * displacementScale);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tHeatmap;
        varying vec2 vUv;
        varying float vElevation;
        
        void main() {
          vec4 texColor = texture2D(tDiffuse, vUv);
          vec4 heatColor = texture2D(tHeatmap, vUv);
          
          // Blend original image with heatmap based on elevation/intensity
          vec3 finalColor = mix(texColor.rgb, heatColor.rgb, vElevation * 0.8);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    };
  }, [originalTex, heatmapTex]);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle auto-rotation
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  if (!shaderArgs) return null;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 4, 0, 0]}>
      {/* Plane geometry with enough segments for displacement */}
      <planeGeometry args={[10, 10, 128, 128]} />
      <shaderMaterial args={[shaderArgs]} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function ThreeDHeatmap({ originalImageSrc, heatmapSrc }: ThreeDHeatmapProps) {
  return (
    <div className="w-full h-full min-h-[400px] bg-black/50 rounded-xl overflow-hidden relative cursor-move border border-border">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, -5, 10]} fov={50} />
        <ambientLight intensity={1} />
        <HeatmapSurface originalImageSrc={originalImageSrc} heatmapSrc={heatmapSrc} />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={0}
        />
      </Canvas>
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-white/10 pointer-events-none">
        <span className="text-sm font-semibold text-white">3D Grad-CAM Topography</span>
        <span className="text-xs text-cyan-400">Drag to rotate • Scroll to zoom</span>
      </div>
    </div>
  );
}
