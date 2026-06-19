<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useFluidStore } from '../store/fluid'
import { DISTURBER_TYPES } from '../utils/sph-engine'
import type { Disturber } from '../types'

const store = useFluidStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const W = 800
const H = 500
const PICK_RADIUS = 14
const MARGIN = 10

const pulsePhase = ref(0)

function velocityToColor(speed: number): string {
  const maxSpeed = 200
  const t = Math.min(speed / maxSpeed, 1)
  const hue = (1 - t) * 240
  const sat = 80
  const light = 40 + t * 20
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

function typeMeta(type: Disturber['type']) {
  return DISTURBER_TYPES.find(m => m.type === type) ?? DISTURBER_TYPES[0]
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, head = 7, lw = 2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1e-3) return
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const ang = Math.atan2(dy, dx)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6))
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

function drawGlow(ctx: CanvasRenderingContext2D, d: Disturber, color: string) {
  const R = d.radius
  const pulse = store.visual.showPulseEffect ? 0.5 + 0.5 * Math.sin(pulsePhase.value + d.id * 0.7) : 0.6
  const gradient = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, R)
  gradient.addColorStop(0, hexToRgba(color, 0.35 * pulse))
  gradient.addColorStop(0.4, hexToRgba(color, 0.15 * pulse))
  gradient.addColorStop(0.75, hexToRgba(color, 0.05 * pulse))
  gradient.addColorStop(1, hexToRgba(color, 0))
  ctx.beginPath()
  ctx.arc(d.x, d.y, R, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawPulseRing(ctx: CanvasRenderingContext2D, d: Disturber, color: string) {
  const R = d.radius
  const t = (pulsePhase.value + d.id * 0.3) % (Math.PI * 2)
  const progress = t / (Math.PI * 2)
  const ringR = R * (0.3 + 0.7 * progress)
  const alpha = (1 - progress) * 0.5
  ctx.beginPath()
  ctx.arc(d.x, d.y, ringR, 0, Math.PI * 2)
  ctx.strokeStyle = hexToRgba(color, alpha)
  ctx.lineWidth = 2 * (1 - progress * 0.7)
  ctx.stroke()
}

function drawDisturberSymbol(ctx: CanvasRenderingContext2D, d: Disturber, color: string) {
  const R = d.radius
  const armLen = Math.min(R * 0.45, 34)
  const inner = 9
  const sign = d.strength >= 0 ? 1 : -1
  if (d.type === 'attract') {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2
      const sx = d.x + armLen * Math.cos(a)
      const sy = d.y + armLen * Math.sin(a)
      const ex = d.x + inner * Math.cos(a)
      const ey = d.y + inner * Math.sin(a)
      drawArrow(ctx, sx, sy, ex, ey, color, 6)
    }
  } else if (d.type === 'repel') {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2
      const sx = d.x + inner * Math.cos(a)
      const sy = d.y + inner * Math.sin(a)
      const ex = d.x + armLen * Math.cos(a)
      const ey = d.y + armLen * Math.sin(a)
      drawArrow(ctx, sx, sy, ex, ey, color, 6)
    }
  } else if (d.type === 'vortex') {
    const r = Math.min(R * 0.38, 26)
    const start = sign > 0 ? 0 : Math.PI * 2
    const end = sign > 0 ? Math.PI * 1.55 : Math.PI * 0.45
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(d.x, d.y, r, Math.min(start, end), Math.max(start, end), sign < 0)
    ctx.stroke()
    const ex = d.x + r * Math.cos(end)
    const ey = d.y + r * Math.sin(end)
    const tAng = end + (sign > 0 ? Math.PI / 2 : -Math.PI / 2)
    const bx = ex - 8 * Math.cos(tAng)
    const by = ey - 8 * Math.sin(tAng)
    drawArrow(ctx, bx, by, ex, ey, color, 6)
  } else if (d.type === 'jet') {
    const len = Math.min(R * 0.55, 42) * (sign > 0 ? 1 : -1)
    const ex = d.x + len * Math.cos(d.angle)
    const ey = d.y + len * Math.sin(d.angle)
    drawArrow(ctx, d.x, d.y, ex, ey, color, 8)
  }
}

function drawDisturber(ctx: CanvasRenderingContext2D, d: Disturber, selected: boolean, multiSelected: boolean) {
  const meta = typeMeta(d.type)
  const color = meta.color
  const alpha = d.enabled ? 1 : 0.35

  ctx.save()
  ctx.globalAlpha = alpha

  if (store.visual.showGlowEffect && d.enabled) {
    drawGlow(ctx, d, color)
  }
  if (store.visual.showPulseEffect && d.enabled) {
    drawPulseRing(ctx, d, color)
  }

  ctx.beginPath()
  ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(color, d.enabled ? 0.07 : 0.03)
  ctx.fill()

  ctx.setLineDash([6, 5])
  ctx.strokeStyle = hexToRgba(color, 0.55)
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])

  drawDisturberSymbol(ctx, d, color)

  ctx.beginPath()
  ctx.arc(d.x, d.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = '#0c1222'
  ctx.lineWidth = 1.5
  ctx.stroke()

  if (multiSelected) {
    ctx.beginPath()
    ctx.arc(d.x, d.y, 12, 0, Math.PI * 2)
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 9px monospace'
    ctx.fillText('●', d.x - 4, d.y - 14)
  } else if (selected) {
    ctx.beginPath()
    ctx.arc(d.x, d.y, 12, 0, Math.PI * 2)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.fillStyle = hexToRgba(color, 0.95)
  ctx.font = 'bold 10px monospace'
  ctx.fillText(meta.label, d.x + 12, d.y - 12)
  if (Math.abs(d.strength) > 250) {
    ctx.fillStyle = d.strength > 0 ? '#fbbf24' : '#f87171'
    ctx.fillText(Math.abs(d.strength) > 350 ? '★★' : '★', d.x + 12, d.y - 1)
  }

  ctx.restore()
}

function drawForceVectors(ctx: CanvasRenderingContext2D) {
  if (!store.engine || !store.visual.showForceVectors) return
  const particles = store.engine.particles
  const step = store.visual.forceVectorStep
  const scale = store.visual.forceVectorScale
  for (let i = 0; i < particles.length; i += step) {
    const p = particles[i]
    const mag = Math.hypot(p.fx, p.fy)
    if (mag < 1) continue
    const nm = Math.min(mag * scale, 20)
    const ux = p.fx / mag
    const uy = p.fy / mag
    const t = Math.min(mag / 8000, 1)
    const hue = 60 - t * 60
    const color = `hsla(${hue}, 90%, 55%, 0.6)`
    drawArrow(ctx, p.x, p.y, p.x + ux * nm, p.y + uy * nm, color, 3, 1)
  }
}

function drawSelectionBox(ctx: CanvasRenderingContext2D) {
  if (!isSelecting.value) return
  const sx = Math.min(selStartX.value, selEndX.value)
  const sy = Math.min(selStartY.value, selEndY.value)
  const ex = Math.max(selStartX.value, selEndX.value)
  const ey = Math.max(selStartY.value, selEndY.value)
  ctx.save()
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'
  ctx.fillStyle = 'rgba(251, 191, 36, 0.1)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.fillRect(sx, sy, ex - sx, ey - sy)
  ctx.strokeRect(sx, sy, ex - sx, ey - sy)
  ctx.setLineDash([])
  ctx.restore()
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#0c1222'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, W - 4, H - 4)

  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 0.3
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += 50) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  if (!store.engine) return

  const gridSize = 20
  const gw = Math.ceil(W / gridSize)
  const gh = Math.ceil(H / gridSize)
  const densityGrid = new Float32Array(gw * gh)
  for (const p of store.engine.particles) {
    const gx = Math.floor(p.x / gridSize)
    const gy = Math.floor(p.y / gridSize)
    if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) {
      densityGrid[gy * gw + gx] += p.density
    }
  }
  const maxDens = Math.max(...densityGrid, 1)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const d = densityGrid[gy * gw + gx]
      if (d > 0) {
        const alpha = Math.min(d / maxDens * 0.15, 0.15)
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`
        ctx.fillRect(gx * gridSize, gy * gridSize, gridSize, gridSize)
      }
    }
  }

  drawForceVectors(ctx)

  const particles = store.engine.particles
  for (const p of particles) {
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
    const color = velocityToColor(speed)
    const radius = 4

    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  for (const d of store.disturbers) {
    drawDisturber(
      ctx,
      d,
      d.id === store.selectedDisturberId,
      store.multiSelectedIds.includes(d.id)
    )
  }

  drawSelectionBox(ctx)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(W - 80, 5, 75, 22)
  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`FPS: ${store.fps}`, W - 74, 20)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(W - 120, 30, 115, 22)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '11px monospace'
  ctx.fillText(`Frame: ${store.frameCount}`, W - 114, 44)

  if (store.hasMultiSelection) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)'
    ctx.fillRect(5, 5, 120, 22)
    ctx.fillStyle = '#0c1222'
    ctx.font = 'bold 11px monospace'
    ctx.fillText(`已选: ${store.multiSelectedIds.length} 个`, 12, 20)
  }
}

let raf: number | null = null
let lastPulseTime = 0
function animate(now: number) {
  if (now - lastPulseTime > 30) {
    pulsePhase.value += 0.08
    lastPulseTime = now
  }
  draw()
  raf = requestAnimationFrame(animate)
}

let draggingId: number | null = null
let dragOffsetX = 0
let dragOffsetY = 0
let isDraggingMulti = false
let multiDragStartX = 0
let multiDragStartY = 0
let multiOrigins: { id: number; x: number; y: number }[] = []

let isSelecting = ref(false)
let selStartX = ref(0)
let selStartY = ref(0)
let selEndX = ref(0)
let selEndY = ref(0)

function clampX(v: number) {
  return Math.max(MARGIN, Math.min(W - MARGIN, v))
}
function clampY(v: number) {
  return Math.max(MARGIN, Math.min(H - MARGIN, v))
}

function getCoords(e: MouseEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  const scaleX = W / rect.width
  const scaleY = H / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function pickDisturber(x: number, y: number): Disturber | null {
  const list = store.disturbers
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i]
    const dx = x - d.x
    const dy = y - d.y
    if (dx * dx + dy * dy <= PICK_RADIUS * PICK_RADIUS) return d
  }
  return null
}

function onMouseDown(e: MouseEvent) {
  if (!canvas.value || !store.engine) return
  const { x, y } = getCoords(e)

  if (e.button === 2) {
    e.preventDefault()
    const picked = pickDisturber(x, y)
    if (picked) {
      if (store.multiSelectedIds.includes(picked.id) || store.multiSelectedIds.length > 0) {
        store.removeSelectedMulti()
      } else {
        store.removeDisturber(picked.id)
      }
    }
    return
  }

  if (e.button !== 0) return

  const picked = pickDisturber(x, y)
  const shiftPressed = e.shiftKey

  if (picked) {
    if (shiftPressed) {
      store.toggleDisturberMulti(picked.id, true)
      if (store.multiSelectedIds.includes(picked.id)) {
        isDraggingMulti = true
        multiDragStartX = x
        multiDragStartY = y
        multiOrigins = store.multiSelectedIds.map(id => {
          const d = store.disturbers.find(x => x.id === id)!
          return { id, x: d.x, y: d.y }
        })
      }
    } else if (store.multiSelectedIds.includes(picked.id)) {
      isDraggingMulti = true
      multiDragStartX = x
      multiDragStartY = y
      multiOrigins = store.multiSelectedIds.map(id => {
        const d = store.disturbers.find(x => x.id === id)!
        return { id, x: d.x, y: d.y }
      })
    } else {
      store.toggleDisturberMulti(picked.id, false)
      draggingId = picked.id
      dragOffsetX = x - picked.x
      dragOffsetY = y - picked.y
    }
    canvas.value.style.cursor = 'grabbing'
    return
  }

  if (shiftPressed && store.interactionMode !== 'place') {
    isSelecting.value = true
    selStartX.value = x
    selStartY.value = y
    selEndX.value = x
    selEndY.value = y
    canvas.value.style.cursor = 'crosshair'
    return
  }

  if (!shiftPressed) store.clearMultiSelection()

  if (store.interactionMode === 'place') {
    store.addDisturber(clampX(x), clampY(y))
  } else {
    store.applyImpulseAt(x, y)
  }
}

function onMouseMove(e: MouseEvent) {
  if (!canvas.value) return
  const { x, y } = getCoords(e)

  if (isSelecting.value) {
    selEndX.value = x
    selEndY.value = y
    return
  }

  if (isDraggingMulti) {
    const dx = x - multiDragStartX
    const dy = y - multiDragStartY
    for (const orig of multiOrigins) {
      const d = store.disturbers.find(dd => dd.id === orig.id)
      if (d) {
        d.x = clampX(orig.x + dx)
        d.y = clampY(orig.y + dy)
      }
    }
    store.syncDisturbersToEngine()
    return
  }

  if (draggingId !== null) {
    store.updateDisturber(draggingId, { x: clampX(x - dragOffsetX), y: clampY(y - dragOffsetY) })
    return
  }

  const inside = x >= 0 && x <= W && y >= 0 && y <= H
  if (!inside) return
  const picked = pickDisturber(x, y)
  canvas.value.style.cursor = picked ? 'grab' : 'crosshair'
}

function onMouseUp(e: MouseEvent) {
  if (isSelecting.value) {
    isSelecting.value = false
    const sx = Math.min(selStartX.value, selEndX.value)
    const sy = Math.min(selStartY.value, selEndY.value)
    const ex = Math.max(selStartX.value, selEndX.value)
    const ey = Math.max(selStartY.value, selEndY.value)
    const area = (ex - sx) * (ey - sy)
    if (area > 100) {
      const ids: number[] = []
      for (const d of store.disturbers) {
        if (d.x >= sx && d.x <= ex && d.y >= sy && d.y <= ey) {
          ids.push(d.id)
        }
      }
      if (ids.length > 0) {
        store.multiSelectedIds = e.shiftKey ? [...new Set([...store.multiSelectedIds, ...ids])] : ids
        store.selectedDisturberId = ids[0]
      }
    }
    return
  }

  if (isDraggingMulti) {
    isDraggingMulti = false
    multiOrigins = []
    if (canvas.value) canvas.value.style.cursor = 'crosshair'
  }

  if (draggingId !== null) {
    draggingId = null
    if (canvas.value) canvas.value.style.cursor = 'crosshair'
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
}

function onKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    store.removeSelectedMulti()
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault()
    store.selectAllDisturbers()
  } else if (e.key === 'Escape') {
    store.clearMultiSelection()
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault()
    store.duplicateSelectedMulti()
  } else if (e.key === ' ') {
    e.preventDefault()
    store.toggleSelectedMulti()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    store.moveSelectedMulti(e.shiftKey ? -10 : -2, 0)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    store.moveSelectedMulti(e.shiftKey ? 10 : 2, 0)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    store.moveSelectedMulti(0, e.shiftKey ? -10 : -2)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    store.moveSelectedMulti(0, e.shiftKey ? 10 : 2)
  }
}

onMounted(() => {
  raf = requestAnimationFrame(animate)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="relative">
    <canvas
      ref="canvas"
      :width="W"
      :height="H"
      class="rounded-lg border border-gray-700 cursor-crosshair select-none w-full max-w-[800px]"
      @mousedown="onMouseDown"
      @contextmenu="onContextMenu"
    />
  </div>
</template>
