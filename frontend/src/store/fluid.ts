import { defineStore } from 'pinia'
import { SPHEngine, DEFAULT_PARAMS, PRESETS, DISTURBER_DEFAULTS, DISTURBER_COMBO_PRESETS } from '../utils/sph-engine'
import type { SimParams, Preset, Particle, Disturber, DisturberType, InteractionMode, VisualOptions, DisturberComboPreset } from '../types'

const CANVAS_W = 800
const CANVAS_H = 500

const DEFAULT_VISUAL: VisualOptions = {
  showForceVectors: false,
  showPulseEffect: true,
  showGlowEffect: true,
  forceVectorScale: 0.08,
  forceVectorStep: 3,
}

export const useFluidStore = defineStore('fluid', {
  state: () => ({
    engine: null as SPHEngine | null,
    isRunning: false,
    particleCount: 800,
    currentPreset: PRESETS[0],
    params: { ...DEFAULT_PARAMS } as SimParams,
    fps: 0,
    frameCount: 0,
    _animId: null as number | null,
    _lastTime: 0,
    _fpsAccum: 0,
    _fpsFrames: 0,
    disturbers: [] as Disturber[],
    _nextDisturberId: 1,
    selectedDisturberId: null as number | null,
    multiSelectedIds: [] as number[],
    interactionMode: 'impulse' as InteractionMode,
    disturbType: 'attract' as DisturberType,
    disturbStrength: DISTURBER_DEFAULTS.strength,
    disturbRadius: DISTURBER_DEFAULTS.radius,
    disturbAngle: DISTURBER_DEFAULTS.angle,
    visual: { ...DEFAULT_VISUAL } as VisualOptions,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
  }),
  getters: {
    particleArray: (state) => state.engine?.particles ?? [],
    avgDensity: (state) => {
      if (!state.engine || state.engine.particles.length === 0) return 0
      const sum = state.engine.particles.reduce((s, p) => s + p.density, 0)
      return sum / state.engine.particles.length
    },
    maxVelocity: (state) => {
      if (!state.engine || state.engine.particles.length === 0) return 0
      return Math.max(...state.engine.particles.map(p => Math.sqrt(p.vx * p.vx + p.vy * p.vy)))
    },
    selectedDisturber: (state): Disturber | null => {
      if (state.selectedDisturberId === null) return null
      return state.disturbers.find(d => d.id === state.selectedDisturberId) ?? null
    },
    activeDisturberCount: (state) => state.disturbers.filter(d => d.enabled).length,
    multiSelectedDisturbers: (state): Disturber[] => {
      return state.disturbers.filter(d => state.multiSelectedIds.includes(d.id))
    },
    hasMultiSelection: (state) => state.multiSelectedIds.length > 0,
    comboPresets: (): DisturberComboPreset[] => DISTURBER_COMBO_PRESETS,
  },
  actions: {
    initSimulation(preset?: Preset) {
      if (preset) {
        this.currentPreset = preset
        this.params = { ...DEFAULT_PARAMS, ...preset.params }
        this.particleCount = preset.particleCount
      }
      this.canvasWidth = CANVAS_W
      this.canvasHeight = CANVAS_H
      this.engine = new SPHEngine(this.particleCount, this.canvasWidth, this.canvasHeight, this.params)
      this.engine.initParticles(this.currentPreset.initialConfig, this.particleCount)
      this.frameCount = 0
      this.fps = 0
      this.syncDisturbersToEngine()
    },
    start() {
      if (this.isRunning || !this.engine) return
      this.isRunning = true
      this._lastTime = performance.now()
      this._fpsAccum = 0
      this._fpsFrames = 0
      const loop = (now: number) => {
        if (!this.isRunning || !this.engine) return
        const elapsed = now - this._lastTime
        this._lastTime = now
        this._fpsAccum += elapsed
        this._fpsFrames++
        if (this._fpsAccum >= 500) {
          this.fps = Math.round(this._fpsFrames / (this._fpsAccum / 1000))
          this._fpsAccum = 0
          this._fpsFrames = 0
        }
        // Sub-steps for stability
        const subSteps = 3
        for (let s = 0; s < subSteps; s++) {
          this.engine.step()
        }
        this.frameCount++
        this._animId = requestAnimationFrame(loop)
      }
      this._animId = requestAnimationFrame(loop)
    },
    stop() {
      this.isRunning = false
      if (this._animId !== null) {
        cancelAnimationFrame(this._animId)
        this._animId = null
      }
    },
    reset() {
      this.stop()
      this.initSimulation(this.currentPreset)
    },
    stepOnce() {
      if (!this.engine || this.isRunning) return
      const subSteps = 3
      for (let s = 0; s < subSteps; s++) {
        this.engine.step()
      }
      this.frameCount++
    },
    updateParam(key: keyof SimParams, value: number) {
      this.params[key] = value
      if (this.engine) {
        this.engine.params[key] = value
        if (key === 'smoothingRadius') {
          this.engine.setCellSize(value)
        }
      }
    },
    applyImpulseAt(x: number, y: number) {
      if (this.engine) this.engine.applyImpulse(x, y, 300)
    },
    setInteractionMode(mode: InteractionMode) {
      this.interactionMode = mode
      if (mode === 'impulse') this.selectedDisturberId = null
    },
    setDisturbType(type: DisturberType) {
      this.disturbType = type
    },
    setDisturbDefault(field: 'strength' | 'radius' | 'angle', value: number) {
      if (field === 'strength') this.disturbStrength = value
      else if (field === 'radius') this.disturbRadius = value
      else this.disturbAngle = value
    },
    addDisturber(x: number, y: number) {
      const id = this._nextDisturberId++
      const dis: Disturber = {
        id,
        x,
        y,
        type: this.disturbType,
        strength: this.disturbStrength,
        radius: this.disturbRadius,
        angle: this.disturbAngle,
        enabled: true,
        label: `${this.disturbType}-${id}`,
      }
      this.disturbers.push(dis)
      this.selectedDisturberId = dis.id
      this.syncDisturbersToEngine()
    },
    removeDisturber(id: number) {
      const idx = this.disturbers.findIndex(d => d.id === id)
      if (idx >= 0) {
        this.disturbers.splice(idx, 1)
        if (this.selectedDisturberId === id) this.selectedDisturberId = null
        this.syncDisturbersToEngine()
      }
    },
    toggleDisturber(id: number) {
      const dis = this.disturbers.find(d => d.id === id)
      if (dis) {
        dis.enabled = !dis.enabled
        this.syncDisturbersToEngine()
      }
    },
    selectDisturber(id: number | null) {
      this.selectedDisturberId = id
    },
    updateDisturber(id: number, patch: Partial<Disturber>) {
      const dis = this.disturbers.find(d => d.id === id)
      if (dis) {
        Object.assign(dis, patch)
        this.syncDisturbersToEngine()
      }
    },
    clearDisturbers() {
      this.disturbers = []
      this.selectedDisturberId = null
      this.syncDisturbersToEngine()
    },
    syncDisturbersToEngine() {
      if (this.engine) {
        this.engine.setDisturbers(this.disturbers.map(d => ({ ...d })))
      }
    },
    toggleDisturberMulti(id: number, additive: boolean) {
      if (additive) {
        const idx = this.multiSelectedIds.indexOf(id)
        if (idx >= 0) {
          this.multiSelectedIds.splice(idx, 1)
        } else {
          this.multiSelectedIds.push(id)
        }
        if (this.multiSelectedIds.length > 0) {
          this.selectedDisturberId = this.multiSelectedIds[this.multiSelectedIds.length - 1]
        } else {
          this.selectedDisturberId = null
        }
      } else {
        this.multiSelectedIds = [id]
        this.selectedDisturberId = id
      }
    },
    clearMultiSelection() {
      this.multiSelectedIds = []
      this.selectedDisturberId = null
    },
    selectAllDisturbers() {
      this.multiSelectedIds = this.disturbers.map(d => d.id)
      if (this.multiSelectedIds.length > 0) {
        this.selectedDisturberId = this.multiSelectedIds[0]
      }
    },
    toggleSelectedMulti() {
      const ids = this.multiSelectedIds.length > 0 ? this.multiSelectedIds : (this.selectedDisturberId !== null ? [this.selectedDisturberId] : [])
      if (ids.length === 0) return
      const shouldEnable = ids.some(id => {
        const d = this.disturbers.find(x => x.id === id)
        return d && !d.enabled
      })
      for (const id of ids) {
        const d = this.disturbers.find(x => x.id === id)
        if (d) d.enabled = shouldEnable
      }
      this.syncDisturbersToEngine()
    },
    removeSelectedMulti() {
      const ids = this.multiSelectedIds.length > 0 ? [...this.multiSelectedIds] : (this.selectedDisturberId !== null ? [this.selectedDisturberId] : [])
      if (ids.length === 0) return
      for (const id of ids) {
        const idx = this.disturbers.findIndex(d => d.id === id)
        if (idx >= 0) this.disturbers.splice(idx, 1)
      }
      this.multiSelectedIds = []
      this.selectedDisturberId = null
      this.syncDisturbersToEngine()
    },
    updateSelectedMulti(patch: Partial<Disturber>) {
      const ids = this.multiSelectedIds.length > 0 ? this.multiSelectedIds : (this.selectedDisturberId !== null ? [this.selectedDisturberId] : [])
      if (ids.length === 0) return
      for (const id of ids) {
        const d = this.disturbers.find(x => x.id === id)
        if (d) Object.assign(d, patch)
      }
      this.syncDisturbersToEngine()
    },
    applyComboPreset(comboId: string) {
      const combo = DISTURBER_COMBO_PRESETS.find(c => c.id === comboId)
      if (!combo) return
      this.clearDisturbers()
      for (const b of combo.builders) {
        const id = this._nextDisturberId++
        const typeMeta = DISTURBER_COMBO_PRESETS.length > 0 ? null : null
        const dis: Disturber = {
          id,
          x: this.canvasWidth * b.xRatio,
          y: this.canvasHeight * b.yRatio,
          type: b.type,
          strength: b.strength ?? this.disturbStrength,
          radius: b.radius ?? this.disturbRadius,
          angle: b.angle ?? this.disturbAngle,
          enabled: b.enabled !== false,
          label: `${b.labelSuffix ?? b.type}-${id}`,
        }
        this.disturbers.push(dis)
      }
      this.selectAllDisturbers()
      this.syncDisturbersToEngine()
    },
    setVisualOption<K extends keyof VisualOptions>(key: K, value: VisualOptions[K]) {
      (this.visual as any)[key] = value
    },
    moveDisturber(id: number, dx: number, dy: number) {
      const d = this.disturbers.find(x => x.id === id)
      if (!d) return
      d.x = Math.max(10, Math.min(this.canvasWidth - 10, d.x + dx))
      d.y = Math.max(10, Math.min(this.canvasHeight - 10, d.y + dy))
      this.syncDisturbersToEngine()
    },
    moveSelectedMulti(dx: number, dy: number) {
      const ids = this.multiSelectedIds.length > 0 ? this.multiSelectedIds : (this.selectedDisturberId !== null ? [this.selectedDisturberId] : [])
      for (const id of ids) this.moveDisturber(id, dx, dy)
    },
    duplicateDisturber(id: number) {
      const src = this.disturbers.find(d => d.id === id)
      if (!src) return
      const newId = this._nextDisturberId++
      const copy: Disturber = {
        ...src,
        id: newId,
        x: Math.min(this.canvasWidth - 10, src.x + 30),
        y: Math.min(this.canvasHeight - 10, src.y + 30),
        label: `${src.type}-${newId}`,
      }
      this.disturbers.push(copy)
      this.selectedDisturberId = newId
      this.multiSelectedIds = [newId]
      this.syncDisturbersToEngine()
    },
    duplicateSelectedMulti() {
      const ids = this.multiSelectedIds.length > 0 ? [...this.multiSelectedIds] : (this.selectedDisturberId !== null ? [this.selectedDisturberId] : [])
      if (ids.length === 0) return
      const newIds: number[] = []
      for (const id of ids) {
        const src = this.disturbers.find(d => d.id === id)
        if (!src) continue
        const newId = this._nextDisturberId++
        const copy: Disturber = {
          ...src,
          id: newId,
          x: Math.min(this.canvasWidth - 10, src.x + 30),
          y: Math.min(this.canvasHeight - 10, src.y + 30),
          label: `${src.type}-${newId}`,
        }
        this.disturbers.push(copy)
        newIds.push(newId)
      }
      this.multiSelectedIds = newIds
      this.selectedDisturberId = newIds[0] ?? null
      this.syncDisturbersToEngine()
    },
  },
})
