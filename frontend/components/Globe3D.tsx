'use client';

import { useRef, useMemo, useState, useEffect, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

// ==================== 景区数据类型 ====================
export interface GlobeSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  desc: string;
}

// 标记点配色（按避雷指数着色：越绿越推荐，越红越需要谨慎；低饱和度避免"科技感"过重）
export function colorByAvoidIndex(avoidIndex: number): string {
  if (avoidIndex < 2.2) return '#3aa37c';
  if (avoidIndex < 2.8) return '#3f96ad';
  if (avoidIndex < 3.2) return '#cf9c46';
  return '#c06058';
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// 本地真实地球贴图（NASA Blue Marble / 地形 / 水面 / 夜灯 / 云层）
const TEXTURE_URLS = {
  color: `${basePath}/textures/earth-blue-marble.jpg`,
  topology: `${basePath}/textures/earth-topology.png`,
  water: `${basePath}/textures/earth-water.png`,
  night: `${basePath}/textures/earth-night.jpg`,
  clouds: `${basePath}/textures/clouds.png`,
};

interface EarthTextures {
  color: THREE.Texture;
  topology: THREE.Texture;
  water: THREE.Texture;
  night: THREE.Texture;
  clouds: THREE.Texture;
}

function loadTextures(): Promise<EarthTextures> {
  const loader = new THREE.TextureLoader();
  return Promise.all([
    loader.loadAsync(TEXTURE_URLS.color),
    loader.loadAsync(TEXTURE_URLS.topology),
    loader.loadAsync(TEXTURE_URLS.water),
    loader.loadAsync(TEXTURE_URLS.night),
    loader.loadAsync(TEXTURE_URLS.clouds),
  ]).then(([color, topology, water, night, clouds]) => {
    // 颜色类贴图使用 sRGB，其余保持线性；各向异性提升斜视角清晰度
    color.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    clouds.colorSpace = THREE.SRGBColorSpace;
    for (const t of [color, topology, water, night, clouds]) {
      t.anisotropy = 8;
    }
    return { color, topology, water, night, clouds };
  });
}

// ==================== 工具函数 ====================
function latLngToVector3(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

// ==================== 大气层着色器 ====================
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform vec3 atmosphereColor;
  uniform float intensity;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 3.5);
    vec3 atmosphere = atmosphereColor * fresnel * intensity;
    gl_FragColor = vec4(atmosphere, 1.0);
  }
`;

// ==================== 地球组件（真实贴图） ====================
function Earth({ textures }: { textures: EarthTextures | null }) {
  // 贴图未就绪时渲染深色球体占位
  const earthMaterial = useMemo(() => {
    if (!textures) {
      return new THREE.MeshStandardMaterial({
        color: '#0b1d30',
        roughness: 0.9,
        metalness: 0.05,
      });
    }
    return new THREE.MeshPhongMaterial({
      map: textures.color,
      bumpMap: textures.topology,
      bumpScale: 0.06,
      specularMap: textures.water,
      specular: new THREE.Color('#3a5566'),
      shininess: 14,
      // 夜面城市灯光：暗面透出暖色微光
      emissiveMap: textures.night,
      emissive: new THREE.Color('#c8a06a'),
      emissiveIntensity: 0.5,
    });
  }, [textures]);

  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      uniforms: {
        atmosphereColor: { value: new THREE.Color('#6f9fd8') },
        intensity: { value: 0.85 },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
  }, []);

  return (
    <group>
      {/* 地球本体（含地形凹凸 / 海面高光 / 夜灯） */}
      <mesh material={earthMaterial}>
        <sphereGeometry args={[2, 96, 96]} />
      </mesh>

      {/* 大气边缘散射（Fresnel，柔和） */}
      <mesh material={atmosphereMaterial}>
        <sphereGeometry args={[2.13, 64, 64]} />
      </mesh>
    </group>
  );
}

// ==================== 脉冲标记点组件（降噪：小光点 + 柔和呼吸） ====================
function PulseMarker({ spot, onClick, isSelected }: {
  spot: GlobeSpot;
  onClick: () => void;
  isSelected: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const pos = useMemo(() => latLngToVector3(spot.lat, spot.lng, 2.04), [spot.lat, spot.lng]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (pulseRef.current) {
      const scale = 1 + Math.sin(time * 2 + pos[0] * 2) * 0.18;
      pulseRef.current.scale.setScalar(scale);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0.32 - Math.sin(time * 2 + pos[0] * 2) * 0.12;
    }
  });

  return (
    <group
      position={pos}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {/* 标记点本体（贴地小光点） */}
      <mesh>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color={spot.color} />
      </mesh>

      {/* 柔和呼吸光环 */}
      <mesh ref={pulseRef}>
        <circleGeometry args={[0.05, 24]} />
        <meshBasicMaterial color={spot.color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* 悬停或选中时显示标签 */}
      {(hovered || isSelected) && (
        <Html position={[0, 0.16, 0]} center distanceFactor={10}>
          <div className={`px-3 py-2 rounded-lg backdrop-blur-md whitespace-nowrap ${
            isSelected ? 'bg-stone-900/80 border border-amber-400/40' : 'bg-black/70 border border-white/15'
          }`}>
            <div className="text-white text-xs font-bold">{spot.name}</div>
            <div className="text-gray-300 text-[10px]">{spot.desc}</div>
            <div className="text-amber-300/90 text-[10px] mt-0.5">点击进入详情 →</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ==================== 飞行路线组件（降噪：细线 + 微光点） ====================
function FlightRoute({ fromSpot, toSpot, color, progress }: {
  fromSpot: GlobeSpot;
  toSpot: GlobeSpot;
  color: string;
  progress: number;
}) {
  const coreRef = useRef<THREE.Mesh>(null);

  const fromPos = useMemo(() => latLngToVector3(fromSpot.lat, fromSpot.lng, 2.04), [fromSpot.lat, fromSpot.lng]);
  const toPos = useMemo(() => latLngToVector3(toSpot.lat, toSpot.lng, 2.04), [toSpot.lat, toSpot.lng]);

  const curve = useMemo(() => {
    const midPoint = new THREE.Vector3(
      (fromPos[0] + toPos[0]) / 2,
      (fromPos[1] + toPos[1]) / 2 + 0.5,
      (fromPos[2] + toPos[2]) / 2
    );
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...fromPos),
      midPoint,
      new THREE.Vector3(...toPos)
    );
  }, [fromPos, toPos]);

  const lineObject = useMemo(() => {
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.28,
    });
    return new THREE.Line(geometry, material);
  }, [curve, color]);

  // 组件卸载时释放 GPU 资源
  useEffect(() => {
    return () => {
      lineObject.geometry.dispose();
      (lineObject.material as THREE.Material).dispose();
    };
  }, [lineObject]);

  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.15 + progress) % 1;
    const point = curve.getPoint(t);
    if (coreRef.current) coreRef.current.position.copy(point);
  });

  return (
    <group>
      <primitive object={lineObject} />
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// ==================== 主组件 ====================
interface Globe3DProps {
  height?: string;
  className?: string;
  spots?: GlobeSpot[];
  onSpotSelect?: (spot: GlobeSpot) => void;
}

export default function Globe3D({ height = '600px', className = '', spots = [], onSpotSelect }: Globe3DProps) {
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const [textures, setTextures] = useState<EarthTextures | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // 加载真实地球贴图
  useEffect(() => {
    let cancelled = false;
    loadTextures()
      .then((t) => { if (!cancelled) setTextures(t); })
      .catch((e) => {
        console.error('地球贴图加载失败:', e);
        if (!cancelled) setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSpotClick = (spot: GlobeSpot) => {
    setSelectedSpot(spot.id === selectedSpot ? null : spot.id);
    if (onSpotSelect) {
      onSpotSelect(spot);
    }
  };

  // 飞行路线：按列表顺序串起前几个景区，形成推荐环线
  const flightRoutes = useMemo(() => {
    const routeColors = ['#d9b06a', '#7aa8c0', '#c98a94', '#7fb89a', '#a98fc9'];
    const routes: { from: GlobeSpot; to: GlobeSpot; color: string }[] = [];
    const count = Math.min(spots.length - 1, 5);
    for (let i = 0; i < count; i++) {
      routes.push({ from: spots[i], to: spots[i + 1], color: routeColors[i % routeColors.length] });
    }
    return routes;
  }, [spots]);

  // 自转与云层动画（refs 传给 Canvas 内的 RotationController 驱动）
  const earthGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // 初始朝向：让中国面向用户（按北京标记点几何位置计算，rotation.y ≈ 2.68 时对准相机）
  useEffect(() => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y = 2.55;
    }
  }, []);

  // 地轴倾斜 23.5°（真实倾角）
  const axialTilt = -23.5 * (Math.PI / 180);

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <Canvas
        camera={{ position: [0, 1, 6], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}
      >
        {/* 环境光 */}
        <ambientLight intensity={0.5} />
        {/* 太阳光跟随相机：无论自转到哪，面向用户的一侧始终是昼面，边缘自然过渡出夜灯 */}
        <SunLight />

        {/* 星空背景（更稀疏，接近真实观感） */}
        <Stars radius={100} depth={50} count={2600} factor={3} saturation={0} fade speed={0.4} />

        {/* 自转驱动（useFrame 必须在 Canvas 内） */}
        <RotationController earthGroupRef={earthGroupRef} cloudsRef={cloudsRef} />

        {/* 地轴倾斜组：标记点/航线与地表同步，地理位置永远对准 */}
        <group rotation={[0, 0, axialTilt]}>
          {/* 地球 + 标记点 + 航线 同组自转 */}
          <group ref={earthGroupRef}>
            <Earth textures={textures} />
            {textures && spots.map((spot) => (
              <PulseMarker
                key={spot.id}
                spot={spot}
                onClick={() => handleSpotClick(spot)}
                isSelected={selectedSpot === spot.id}
              />
            ))}
            {textures && flightRoutes.map((route, index) => (
              <FlightRoute
                key={index}
                fromSpot={route.from}
                toSpot={route.to}
                color={route.color}
                progress={index * 0.2}
              />
            ))}
          </group>

          {/* 云层独立漂移（相对地表移动） */}
          {textures && (
            <CloudLayer cloudsRef={cloudsRef} cloudsTexture={textures.clouds} />
          )}
        </group>

        {/* 鼠标控制 */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3.5}
          maxDistance={10}
          autoRotate={false}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* 提示文字 */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
        拖拽旋转 · 滚轮缩放 · 点击标记进入景区详情
      </div>

      {/* 贴图加载提示 */}
      {!textures && !loadFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-amber-400/20 border-t-amber-400/70 rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-400">正在加载卫星影像…</p>
        </div>
      )}
      {loadFailed && (
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          卫星影像加载失败，已显示简化地球
        </div>
      )}

      {/* 图例 */}
      <div className="absolute top-4 right-4 glass rounded-xl p-3 max-w-[200px]">
        <div className="text-xs text-gray-400 mb-2 font-medium">精选景区</div>
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {spots.map((spot) => (
            <div
              key={spot.id}
              className={`flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                selectedSpot === spot.id ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => handleSpotClick(spot)}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: spot.color }} />
              <span className="truncate">{spot.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== 太阳光（跟随相机，保证昼面朝向用户） ====================
function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    if (lightRef.current) {
      lightRef.current.position.copy(camera.position);
      lightRef.current.position.x += 2.5;
      lightRef.current.position.y += 1.5;
    }
  });
  return <directionalLight ref={lightRef} intensity={2.4} color="#fff4e0" />;
}

// ==================== 自转驱动（useFrame 必须位于 Canvas 内） ====================
function RotationController({ earthGroupRef, cloudsRef }: {
  earthGroupRef: RefObject<THREE.Group>;
  cloudsRef: RefObject<THREE.Mesh>;
}) {
  useFrame((state, delta) => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += delta * 0.035;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.045;
    }
  });
  return null;
}

// ==================== 云层（独立漂移） ====================
function CloudLayer({ cloudsRef, cloudsTexture }: { cloudsRef: RefObject<THREE.Mesh>; cloudsTexture: THREE.Texture }) {
  return (
    <mesh ref={cloudsRef}>
      <sphereGeometry args={[2.02, 64, 64]} />
      <meshLambertMaterial map={cloudsTexture} transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}
