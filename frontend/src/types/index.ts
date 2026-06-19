export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  density: number;
  pressure: number;
  fx: number;
  fy: number;
}

export interface SimParams {
  gravity: number;
  viscosity: number;
  restDensity: number;
  gasConstant: number;
  smoothingRadius: number;
  particleMass: number;
  dt: number;
  damping: number;
  boundaryStiffness: number;
}

export interface Preset {
  name: string;
  label: string;
  description: string;
  params: Partial<SimParams>;
  particleCount: number;
  initialConfig: 'dam' | 'drop' | 'fountain' | 'wave';
}

export type DisturberType = 'attract' | 'repel' | 'vortex' | 'jet';

export interface Disturber {
  id: number;
  x: number;
  y: number;
  type: DisturberType;
  strength: number;
  radius: number;
  angle: number;
  enabled: boolean;
  label: string;
}

export interface DisturberTypeMeta {
  type: DisturberType;
  label: string;
  description: string;
  color: string;
}

export type InteractionMode = 'impulse' | 'place';

export interface DisturberComboPreset {
  id: string;
  name: string;
  label: string;
  description: string;
  icon: string;
  builders: DisturberTemplate[];
}

export interface DisturberTemplate {
  type: DisturberType;
  xRatio: number;
  yRatio: number;
  strength?: number;
  radius?: number;
  angle?: number;
  enabled?: boolean;
  labelSuffix?: string;
}

export interface VisualOptions {
  showForceVectors: boolean;
  showPulseEffect: boolean;
  showGlowEffect: boolean;
  forceVectorScale: number;
  forceVectorStep: number;
}
