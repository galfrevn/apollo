import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';

const SPEECH_MODE_ACCENT_MAP: Record<string, string> = {
  default: '#FFFFFF',
  nerd: '#F5C518',
  playful: '#C45C26',
  warm: '#B56B7A',
};

const DEVICE_RADIUS = 1;
const DEVICE_HEIGHT = 2;
const SCREEN_RADIUS = 0.86;
const RING_INNER_RADIUS = 0.78;

const EYE_RADIUS = 0.19;
const EYE_SPACING = 0.38;
const BODY_STRAIGHT_HEIGHT = 1.55;
const BASE_TAPER_HEIGHT = 0.45;
const BASE_BOTTOM_RADIUS = 0.8;
const SEAM_OFFSET_FROM_TOP = 0.5;
const BLINK_CYCLE_SECONDS = 10;
const BLINK_DURATION_SECONDS = 0.28;

function Eye({
  horizontalOffset,
  surfaceY,
  shouldBlink,
}: {
  readonly horizontalOffset: number;
  readonly surfaceY: number;
  readonly shouldBlink: boolean;
}) {
  const eyeMeshReference = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const eyeMesh = eyeMeshReference.current;
    if (eyeMesh === null || !shouldBlink) {
      return;
    }
    const secondsIntoCycle = clock.getElapsedTime() % BLINK_CYCLE_SECONDS;
    const secondsIntoBlink =
      secondsIntoCycle - (BLINK_CYCLE_SECONDS - BLINK_DURATION_SECONDS);
    if (secondsIntoBlink < 0) {
      eyeMesh.scale.y = 1;
      return;
    }
    const blinkProgress = secondsIntoBlink / BLINK_DURATION_SECONDS;
    eyeMesh.scale.y = 1 - Math.sin(blinkProgress * Math.PI) * 0.92;
  });
  return (
    <mesh
      ref={eyeMeshReference}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[horizontalOffset, surfaceY, 0]}
    >
      <circleGeometry args={[EYE_RADIUS, 48]} />
      <meshBasicMaterial color="#FAFAFA" toneMapped={false} />
    </mesh>
  );
}

function SidePort({
  azimuthRadians,
  verticalOffset,
  portWidth,
  portHeight,
}: {
  readonly azimuthRadians: number;
  readonly verticalOffset: number;
  readonly portWidth: number;
  readonly portHeight: number;
}) {
  const surfaceX = Math.sin(azimuthRadians) * (DEVICE_RADIUS - 0.01);
  const surfaceZ = Math.cos(azimuthRadians) * (DEVICE_RADIUS - 0.01);
  return (
    <group
      position={[surfaceX, verticalOffset, surfaceZ]}
      rotation={[0, azimuthRadians, 0]}
    >
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[portWidth + 0.05, portHeight + 0.05, 0.02]} />
        <meshStandardMaterial color="#242424" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.024]}>
        <boxGeometry args={[portWidth, portHeight, 0.02]} />
        <meshStandardMaterial color="#000000" roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
}

function SideButton({
  azimuthRadians,
  verticalOffset,
}: {
  readonly azimuthRadians: number;
  readonly verticalOffset: number;
}) {
  const surfaceX = Math.sin(azimuthRadians) * (DEVICE_RADIUS - 0.01);
  const surfaceZ = Math.cos(azimuthRadians) * (DEVICE_RADIUS - 0.01);
  return (
    <group
      position={[surfaceX, verticalOffset, surfaceZ]}
      rotation={[0, azimuthRadians, 0]}
    >
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.09, 0.3, 0.03]} />
        <meshStandardMaterial color="#1f1f1f" roughness={0.4} metalness={0.4} />
      </mesh>
    </group>
  );
}

function ChargeLight({
  azimuthRadians,
  verticalOffset,
}: {
  readonly azimuthRadians: number;
  readonly verticalOffset: number;
}) {
  const surfaceX = Math.sin(azimuthRadians) * (DEVICE_RADIUS + 0.002);
  const surfaceZ = Math.cos(azimuthRadians) * (DEVICE_RADIUS + 0.002);
  return (
    <mesh
      position={[surfaceX, verticalOffset, surfaceZ]}
      rotation={[0, azimuthRadians, 0]}
    >
      <circleGeometry args={[0.028, 24]} />
      <meshBasicMaterial color="#d4d4d4" toneMapped={false} />
    </mesh>
  );
}

function SideSwitch({
  azimuthRadians,
  verticalOffset,
}: {
  readonly azimuthRadians: number;
  readonly verticalOffset: number;
}) {
  const surfaceX = Math.sin(azimuthRadians) * (DEVICE_RADIUS - 0.01);
  const surfaceZ = Math.cos(azimuthRadians) * (DEVICE_RADIUS - 0.01);
  return (
    <group
      position={[surfaceX, verticalOffset, surfaceZ]}
      rotation={[0, azimuthRadians, 0]}
    >
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.3, 0.16, 0.024]} />
        <meshStandardMaterial color="#242424" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[-0.06, 0, 0.032]}>
        <boxGeometry args={[0.1, 0.1, 0.03]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.35} metalness={0.45} />
      </mesh>
    </group>
  );
}

function DeskDevice({
  accentColorHex,
  shouldBlink,
}: {
  readonly accentColorHex: string;
  readonly shouldBlink: boolean;
}) {
  const topSurfaceY = DEVICE_HEIGHT / 2;
  return (
    <group>
      <mesh position={[0, DEVICE_HEIGHT / 2 - BODY_STRAIGHT_HEIGHT / 2, 0]}>
        <cylinderGeometry
          args={[DEVICE_RADIUS, DEVICE_RADIUS, BODY_STRAIGHT_HEIGHT, 96]}
        />
        <meshStandardMaterial color="#2e2e2e" roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh
        position={[
          0,
          DEVICE_HEIGHT / 2 - BODY_STRAIGHT_HEIGHT - BASE_TAPER_HEIGHT / 2,
          0,
        ]}
      >
        <cylinderGeometry
          args={[DEVICE_RADIUS, BASE_BOTTOM_RADIUS, BASE_TAPER_HEIGHT, 96]}
        />
        <meshStandardMaterial color="#292929" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, DEVICE_HEIGHT / 2 - SEAM_OFFSET_FROM_TOP, 0]}>
        <cylinderGeometry
          args={[DEVICE_RADIUS + 0.003, DEVICE_RADIUS + 0.003, 0.02, 96, 1, true]}
        />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, topSurfaceY + 0.001, 0]}>
        <circleGeometry args={[SCREEN_RADIUS, 96]} />
        <meshStandardMaterial color="#030303" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, topSurfaceY + 0.002, 0]}>
        <ringGeometry args={[RING_INNER_RADIUS, SCREEN_RADIUS, 96]} />
        <meshBasicMaterial color={accentColorHex} toneMapped={false} />
      </mesh>
      <Eye
        horizontalOffset={-EYE_SPACING}
        surfaceY={topSurfaceY + 0.003}
        shouldBlink={shouldBlink}
      />
      <Eye
        horizontalOffset={EYE_SPACING}
        surfaceY={topSurfaceY + 0.003}
        shouldBlink={shouldBlink}
      />
      <SidePort
        azimuthRadians={0.62}
        verticalOffset={-0.3}
        portWidth={0.24}
        portHeight={0.1}
      />
      <SidePort
        azimuthRadians={0.98}
        verticalOffset={-0.3}
        portWidth={0.3}
        portHeight={0.13}
      />
      <ChargeLight azimuthRadians={0.42} verticalOffset={-0.08} />
      <ChargeLight azimuthRadians={0.54} verticalOffset={-0.08} />
      <SideSwitch azimuthRadians={-1.15} verticalOffset={0.1} />
      <SideButton azimuthRadians={2.1} verticalOffset={0.35} />
      <SideButton azimuthRadians={2.35} verticalOffset={0.35} />
    </group>
  );
}

export function DeviceModel({
  speechModeId,
}: {
  readonly speechModeId: string | undefined;
}) {
  const accentColorHex =
    SPEECH_MODE_ACCENT_MAP[speechModeId ?? 'default'] ?? SPEECH_MODE_ACCENT_MAP.default;
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  return (
    <div
      role="img"
      aria-label="3D model of the desk device — drag to rotate"
      className="h-[26rem] w-full max-w-md cursor-grab active:cursor-grabbing"
    >
      <Canvas camera={{ position: [3.1, 2.3, 3.1], fov: 34 }} dpr={[1, 2]}>
        <hemisphereLight args={['#4a4a4a', '#101010', 1.4]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 5, 3]} intensity={2.2} />
        <directionalLight position={[-5, 2, -3]} intensity={1.1} />
        <directionalLight position={[0, -1, 5]} intensity={0.5} />
        <DeskDevice accentColorHex={accentColorHex} shouldBlink={!prefersReducedMotion} />
        <ContactShadows
          position={[0, -(DEVICE_HEIGHT / 2) - 0.01, 0]}
          opacity={0.45}
          blur={2.4}
          scale={6}
          color="#000000"
        />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={!prefersReducedMotion}
          autoRotateSpeed={0.9}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2 + 0.2}
        />
      </Canvas>
    </div>
  );
}
