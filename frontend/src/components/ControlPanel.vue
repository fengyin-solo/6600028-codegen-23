<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFluidStore } from '../store/fluid'
import { PRESETS, DISTURBER_TYPES, DISTURBER_COMBO_PRESETS } from '../utils/sph-engine'
import type { Preset, DisturberType, InteractionMode, DisturberComboPreset } from '../types'

const store = useFluidStore()
const expandedCombo = ref<string | null>(null)
const showShortcuts = ref(false)

function selectPreset(preset: Preset) {
  store.initSimulation(preset)
}

function toggleRun() {
  if (store.isRunning) {
    store.stop()
  } else {
    store.start()
  }
}

function reset() {
  store.reset()
}

function stepOnce() {
  store.stepOnce()
}

function onGravity(e: Event) {
  store.updateParam('gravity', parseFloat((e.target as HTMLInputElement).value))
}
function onViscosity(e: Event) {
  store.updateParam('viscosity', parseFloat((e.target as HTMLInputElement).value))
}
function onSmoothingRadius(e: Event) {
  store.updateParam('smoothingRadius', parseFloat((e.target as HTMLInputElement).value))
}
function onParticleCount(e: Event) {
  store.particleCount = parseInt((e.target as HTMLInputElement).value)
}
function onDt(e: Event) {
  store.updateParam('dt', parseFloat((e.target as HTMLInputElement).value))
}

const INTERACTION_MODES: { v: InteractionMode; l: string; hint: string }[] = [
  { v: 'impulse', l: '点击冲量', hint: '在画布上点击施加瞬时冲量，推动粒子。Shift+拖拽可框选多个扰动器' },
  { v: 'place', l: '放置扰动器', hint: '在画布上点击放置持续作用点，Shift+点击多选扰动器' },
]

function typeColor(type: DisturberType) {
  return DISTURBER_TYPES.find(m => m.type === type)?.color ?? '#888'
}

function radToDeg(rad: number): number {
  const deg = (((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) * 180 / Math.PI
  return Math.round(deg)
}

const disturbTypeMeta = computed(
  () => DISTURBER_TYPES.find(m => m.type === store.disturbType) ?? DISTURBER_TYPES[0]
)
const defaultAngleDeg = computed(() => radToDeg(store.disturbAngle))

const sel = computed(() => store.selectedDisturber)
const selType = computed(() => sel.value?.type)
const selStrength = computed(() => sel.value?.strength ?? 0)
const selRadius = computed(() => sel.value?.radius ?? 0)
const selAngleDeg = computed(() => (sel.value ? radToDeg(sel.value.angle) : 0))

const multiCount = computed(() => store.multiSelectedIds.length)
const hasMulti = computed(() => multiCount.value > 0)

function onDefaultStrength(e: Event) {
  store.setDisturbDefault('strength', parseFloat((e.target as HTMLInputElement).value))
}
function onDefaultRadius(e: Event) {
  store.setDisturbDefault('radius', parseFloat((e.target as HTMLInputElement).value))
}
function onDefaultAngle(e: Event) {
  store.setDisturbDefault('angle', parseFloat((e.target as HTMLInputElement).value) * Math.PI / 180)
}

function onSelType(type: DisturberType) {
  if (hasMulti.value) {
    store.updateSelectedMulti({ type })
  } else {
    const s = store.selectedDisturber
    if (s) store.updateDisturber(s.id, { type })
  }
}
function onSelStrength(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (hasMulti.value) {
    store.updateSelectedMulti({ strength: v })
  } else {
    const s = store.selectedDisturber
    if (s) store.updateDisturber(s.id, { strength: v })
  }
}
function onSelRadius(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (hasMulti.value) {
    store.updateSelectedMulti({ radius: v })
  } else {
    const s = store.selectedDisturber
    if (s) store.updateDisturber(s.id, { radius: v })
  }
}
function onSelAngle(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value) * Math.PI / 180
  if (hasMulti.value) {
    store.updateSelectedMulti({ angle: v })
  } else {
    const s = store.selectedDisturber
    if (s) store.updateDisturber(s.id, { angle: v })
  }
}
function removeSelected() {
  if (hasMulti.value) {
    store.removeSelectedMulti()
  } else {
    const s = store.selectedDisturber
    if (s) store.removeDisturber(s.id)
  }
}

function toggleComboExpand(id: string) {
  expandedCombo.value = expandedCombo.value === id ? null : id
}

function applyCombo(combo: DisturberComboPreset) {
  store.applyComboPreset(combo.id)
  store.setInteractionMode('place')
}

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Shift + 点击', desc: '多选/取消单个扰动器' },
  { keys: 'Shift + 拖拽', desc: '框选多个扰动器' },
  { keys: '右键点击', desc: '删除选中的扰动器' },
  { keys: 'Ctrl/Cmd + A', desc: '全选所有扰动器' },
  { keys: 'Ctrl/Cmd + D', desc: '复制选中的扰动器' },
  { keys: 'Delete/Backspace', desc: '删除选中的扰动器' },
  { keys: 'Space', desc: '切换选中扰动器启用状态' },
  { keys: '方向键', desc: '微调选中扰动器位置 (Shift=10倍)' },
  { keys: 'Esc', desc: '清空选择' },
]
</script>

<template>
  <div class="w-72 bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col gap-4 overflow-auto h-full">
    <!-- Presets -->
    <div>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">预设场景</h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="preset in PRESETS"
          :key="preset.name"
          @click="selectPreset(preset)"
          class="text-xs px-2 py-2 rounded transition text-left"
          :class="store.currentPreset.name === preset.name
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
        >
          {{ preset.label }}
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">{{ store.currentPreset.description }}</p>
    </div>

    <!-- Controls -->
    <div class="flex gap-2">
      <button
        @click="toggleRun"
        class="flex-1 py-2 rounded text-sm font-medium transition"
        :class="store.isRunning
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-green-600 hover:bg-green-700 text-white'"
      >
        {{ store.isRunning ? '暂停' : '开始' }}
      </button>
      <button
        @click="reset"
        class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded text-sm transition"
      >
        重置
      </button>
      <button
        @click="stepOnce"
        :disabled="store.isRunning"
        class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 py-2 rounded text-sm transition"
      >
        单步
      </button>
    </div>

    <!-- Parameters -->
    <div class="space-y-3">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">模拟参数</h3>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>重力</span>
          <span class="text-gray-300">{{ store.params.gravity.toFixed(1) }}</span>
        </label>
        <input
          type="range" min="0" max="20" step="0.1"
          :value="store.params.gravity"
          @input="onGravity"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>粘性</span>
          <span class="text-gray-300">{{ store.params.viscosity.toFixed(1) }}</span>
        </label>
        <input
          type="range" min="0" max="5" step="0.1"
          :value="store.params.viscosity"
          @input="onViscosity"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>光滑半径</span>
          <span class="text-gray-300">{{ store.params.smoothingRadius.toFixed(0) }}</span>
        </label>
        <input
          type="range" min="10" max="50" step="1"
          :value="store.params.smoothingRadius"
          @input="onSmoothingRadius"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>粒子数量</span>
          <span class="text-gray-300">{{ store.particleCount }}</span>
        </label>
        <input
          type="range" min="200" max="2000" step="50"
          :value="store.particleCount"
          @input="onParticleCount"
          class="w-full accent-blue-500 h-1.5"
        />
        <p class="text-xs text-gray-600 mt-0.5">重置后生效</p>
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>时间步长</span>
          <span class="text-gray-300">{{ store.params.dt.toFixed(4) }}</span>
        </label>
        <input
          type="range" min="0.001" max="0.02" step="0.001"
          :value="store.params.dt"
          @input="onDt"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>
    </div>

    <!-- Combo Presets -->
    <div class="space-y-2">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
        <span>扰动器组合预设</span>
        <span class="text-[9px] text-gray-600 normal-case">一键构建联动场景</span>
      </h3>
      <div class="grid grid-cols-1 gap-1.5">
        <div
          v-for="combo in DISTURBER_COMBO_PRESETS"
          :key="combo.id"
          class="rounded border transition overflow-hidden"
          :class="expandedCombo === combo.id ? 'bg-gray-900 border-gray-600' : 'bg-gray-900/60 border-gray-700 hover:border-gray-600'"
        >
          <div
            class="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
            @click="toggleComboExpand(combo.id)"
          >
            <span class="text-base flex-shrink-0">{{ combo.icon }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] font-medium text-gray-200 truncate">{{ combo.label }}</div>
              <div class="text-[9px] text-gray-500 truncate">{{ combo.builders.length }} 个作用点</div>
            </div>
            <button
              @click.stop="applyCombo(combo)"
              class="text-[9px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition flex-shrink-0"
            >
              应用
            </button>
          </div>
          <div
            v-if="expandedCombo === combo.id"
            class="px-2 pb-2 pt-0 text-[10px] text-gray-400 leading-snug border-t border-gray-700/50"
          >
            <p class="pt-1.5">{{ combo.description }}</p>
            <div class="mt-1.5 flex flex-wrap gap-1">
              <span
                v-for="(b, i) in combo.builders"
                :key="i"
                class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px]"
                :style="{ backgroundColor: typeColor(b.type) + '30', color: typeColor(b.type) }"
              >
                <span class="font-bold">{{ DISTURBER_TYPES.find(t => t.type === b.type)?.label }}</span>
                <span class="text-gray-500">{{ b.labelSuffix }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Multi-point Continuous Disturber -->
    <div class="space-y-3">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
        <span>多点连续扰动器</span>
        <button
          @click="showShortcuts = !showShortcuts"
          class="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 normal-case font-medium transition"
        >
          ⌨ 快捷键
        </button>
      </h3>

      <div
        v-if="showShortcuts"
        class="bg-gray-900/80 border border-gray-700 rounded p-2 space-y-1"
      >
        <div
          v-for="sc in SHORTCUTS"
          :key="sc.keys"
          class="flex items-start gap-2 text-[10px]"
        >
          <span class="font-mono text-amber-400 whitespace-nowrap bg-gray-800 px-1 rounded flex-shrink-0 min-w-[80px] text-center">{{ sc.keys }}</span>
          <span class="text-gray-400 leading-snug">{{ sc.desc }}</span>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          v-for="m in INTERACTION_MODES"
          :key="m.v"
          @click="store.setInteractionMode(m.v)"
          class="flex-1 py-1.5 rounded text-xs transition"
          :class="store.interactionMode === m.v
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
        >
          {{ m.l }}
        </button>
      </div>
      <p class="text-[10px] text-gray-500 leading-snug">
        {{ INTERACTION_MODES.find(m => m.v === store.interactionMode)?.hint }}
      </p>

      <div>
        <label class="block text-xs text-gray-400 mb-1">扰动类型</label>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="m in DISTURBER_TYPES"
            :key="m.type"
            @click="store.setDisturbType(m.type)"
            class="py-1.5 rounded text-[10px] font-medium transition border"
            :class="store.disturbType === m.type
              ? 'border-white text-white'
              : 'border-transparent text-gray-300 hover:bg-gray-700'"
            :style="store.disturbType === m.type
              ? { backgroundColor: m.color }
              : { backgroundColor: 'rgba(255,255,255,0.04)' }"
          >
            {{ m.label }}
          </button>
        </div>
        <p class="text-[10px] text-gray-500 mt-1 leading-snug">{{ disturbTypeMeta.description }}</p>
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>作用强度</span>
          <span class="text-gray-300">{{ store.disturbStrength.toFixed(0) }}</span>
        </label>
        <input
          type="range" min="0" max="500" step="5"
          :value="store.disturbStrength"
          @input="onDefaultStrength"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>作用半径</span>
          <span class="text-gray-300">{{ store.disturbRadius.toFixed(0) }}</span>
        </label>
        <input
          type="range" min="30" max="200" step="1"
          :value="store.disturbRadius"
          @input="onDefaultRadius"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>喷射方向 (°)</span>
          <span class="text-gray-300">{{ defaultAngleDeg }}</span>
        </label>
        <input
          type="range" min="0" max="360" step="5"
          :value="defaultAngleDeg"
          @input="onDefaultAngle"
          class="w-full accent-blue-500 h-1.5"
        />
        <p class="text-[10px] text-gray-600 mt-0.5">仅对「喷射」类型生效，正负强度可反向</p>
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-gray-400">
            已放置 {{ store.disturbers.length }} · 启用 {{ store.activeDisturberCount }}
            <span v-if="hasMulti" class="ml-1 text-amber-400">· 选中 {{ multiCount }}</span>
          </span>
          <div class="flex gap-1">
            <button
              @click="store.selectAllDisturbers"
              :disabled="store.disturbers.length === 0"
              class="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-blue-700 disabled:opacity-30 text-gray-300 transition"
              title="全选 (Ctrl+A)"
            >
              全选
            </button>
            <button
              @click="store.clearDisturbers"
              :disabled="store.disturbers.length === 0"
              class="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-red-700 disabled:opacity-30 text-gray-200 transition"
            >
              清空
            </button>
          </div>
        </div>

        <div
          v-if="hasMulti"
          class="flex gap-1.5 flex-wrap bg-amber-900/20 border border-amber-800/40 rounded p-2"
        >
          <span class="text-[10px] text-amber-400 w-full font-medium">批量操作 ({{ multiCount }} 个)</span>
          <button
            @click="store.toggleSelectedMulti"
            class="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-amber-700 text-gray-200 transition"
          >
            切换启用
          </button>
          <button
            @click="store.duplicateSelectedMulti"
            class="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-blue-700 text-gray-200 transition"
          >
            复制 (Ctrl+D)
          </button>
          <button
            @click="removeSelected"
            class="text-[10px] px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-700 text-red-200 transition"
          >
            删除
          </button>
        </div>

        <div
          v-if="store.disturbers.length === 0"
          class="text-[10px] text-gray-600 italic leading-snug"
        >
          暂无扰动点，切换到「放置扰动器」模式后点击画布添加，或使用上方组合预设
        </div>
        <div
          v-for="d in store.disturbers"
          :key="d.id"
          @click="store.toggleDisturberMulti(d.id, false)"
          class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition"
          :class="store.multiSelectedIds.includes(d.id)
            ? 'bg-amber-900/40 border border-amber-700/60'
            : d.id === store.selectedDisturberId
            ? 'bg-gray-600 border border-gray-500'
            : 'bg-gray-900 hover:bg-gray-700 border border-transparent'"
        >
          <label
            class="flex-shrink-0"
            @click.stop.prevent
          >
            <input
              type="checkbox"
              :checked="store.multiSelectedIds.includes(d.id)"
              @change="store.toggleDisturberMulti(d.id, true)"
              class="w-3 h-3 accent-amber-500 cursor-pointer"
            />
          </label>
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :style="{ backgroundColor: typeColor(d.type), opacity: d.enabled ? 1 : 0.3 }"
          ></span>
          <span class="text-[11px] text-gray-200 flex-1 truncate">{{ d.label }}</span>
          <span
            class="text-[9px] font-mono"
            :class="Math.abs(d.strength) > 350 ? 'text-red-400' : Math.abs(d.strength) > 250 ? 'text-amber-400' : 'text-gray-500'"
          >{{ d.strength.toFixed(0) }}</span>
          <button
            @click.stop="store.toggleDisturber(d.id)"
            class="text-[9px] px-1.5 py-0.5 rounded font-mono"
            :class="d.enabled
              ? 'bg-green-700 text-white'
              : 'bg-gray-700 text-gray-400'"
          >
            {{ d.enabled ? 'ON' : 'OFF' }}
          </button>
          <button
            @click.stop="store.removeDisturber(d.id)"
            class="text-[11px] text-gray-400 hover:text-red-400 px-1 leading-none"
            title="删除"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        v-if="sel || hasMulti"
        class="bg-gray-900 rounded p-2 space-y-2 border border-gray-700"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-300 font-medium">
            <template v-if="hasMulti">批量编辑 ({{ multiCount }} 个)</template>
            <template v-else>编辑: {{ sel?.label }}</template>
          </span>
          <button
            @click="removeSelected"
            class="text-[10px] text-red-400 hover:text-red-300"
          >
            删除
          </button>
        </div>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="m in DISTURBER_TYPES"
            :key="m.type"
            @click="onSelType(m.type)"
            class="py-1 rounded text-[10px] border transition"
            :class="hasMulti ? 'border-transparent text-gray-300 hover:bg-gray-700' : selType === m.type
              ? 'border-white text-white'
              : 'border-transparent text-gray-300 hover:bg-gray-700'"
            :style="!hasMulti && selType === m.type
              ? { backgroundColor: m.color }
              : { backgroundColor: 'rgba(255,255,255,0.04)' }"
          >
            {{ m.label }}
          </button>
        </div>
        <div>
          <label class="flex justify-between text-xs text-gray-400 mb-1">
            <span>强度</span>
            <span class="text-gray-300">{{ hasMulti ? '—' : selStrength.toFixed(0) }}</span>
          </label>
          <input
            type="range" min="0" max="500" step="5"
            :value="hasMulti ? 250 : selStrength"
            @input="onSelStrength"
            class="w-full accent-blue-500 h-1.5"
          />
          <p v-if="hasMulti" class="text-[9px] text-gray-600 mt-0.5">滑动将统一设置所有选中项</p>
        </div>
        <div>
          <label class="flex justify-between text-xs text-gray-400 mb-1">
            <span>半径</span>
            <span class="text-gray-300">{{ hasMulti ? '—' : selRadius.toFixed(0) }}</span>
          </label>
          <input
            type="range" min="30" max="200" step="1"
            :value="hasMulti ? 100 : selRadius"
            @input="onSelRadius"
            class="w-full accent-blue-500 h-1.5"
          />
        </div>
        <div>
          <label class="flex justify-between text-xs text-gray-400 mb-1">
            <span>方向 (°)</span>
            <span class="text-gray-300">{{ hasMulti ? '—' : selAngleDeg }}</span>
          </label>
          <input
            type="range" min="0" max="360" step="5"
            :value="hasMulti ? 180 : selAngleDeg"
            @input="onSelAngle"
            class="w-full accent-blue-500 h-1.5"
          />
        </div>
      </div>
    </div>

    <!-- Visualization Options -->
    <div class="space-y-2">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">可视化选项</h3>
      <div class="space-y-1.5">
        <label class="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-900 rounded cursor-pointer hover:bg-gray-700/50 transition">
          <span class="text-[11px] text-gray-300">渐变光晕效果</span>
          <input
            type="checkbox"
            :checked="store.visual.showGlowEffect"
            @change="store.setVisualOption('showGlowEffect', ($event.target as HTMLInputElement).checked)"
            class="w-3.5 h-3.5 accent-blue-500"
          />
        </label>
        <label class="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-900 rounded cursor-pointer hover:bg-gray-700/50 transition">
          <span class="text-[11px] text-gray-300">动态脉冲环</span>
          <input
            type="checkbox"
            :checked="store.visual.showPulseEffect"
            @change="store.setVisualOption('showPulseEffect', ($event.target as HTMLInputElement).checked)"
            class="w-3.5 h-3.5 accent-blue-500"
          />
        </label>
        <label class="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-900 rounded cursor-pointer hover:bg-gray-700/50 transition">
          <span class="text-[11px] text-gray-300">粒子受力矢量</span>
          <input
            type="checkbox"
            :checked="store.visual.showForceVectors"
            @change="store.setVisualOption('showForceVectors', ($event.target as HTMLInputElement).checked)"
            class="w-3.5 h-3.5 accent-blue-500"
          />
        </label>
        <div v-if="store.visual.showForceVectors" class="space-y-1.5 pl-2 border-l-2 border-gray-700 ml-2">
          <div>
            <label class="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>显示密度</span>
              <span class="text-gray-400">每 {{ store.visual.forceVectorStep }} 个粒子</span>
            </label>
            <input
              type="range" min="1" max="10" step="1"
              :value="store.visual.forceVectorStep"
              @input="store.setVisualOption('forceVectorStep', parseInt(($event.target as HTMLInputElement).value))"
              class="w-full h-1 accent-blue-500"
            />
          </div>
          <div>
            <label class="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>箭头缩放</span>
              <span class="text-gray-400">{{ (store.visual.forceVectorScale * 100).toFixed(0) }}%</span>
            </label>
            <input
              type="range" min="0.02" max="0.25" step="0.01"
              :value="store.visual.forceVectorScale"
              @input="store.setVisualOption('forceVectorScale', parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full h-1 accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="mt-auto pt-3 border-t border-gray-700">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">运行状态</h3>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">FPS</span>
          <p class="text-green-400 font-mono text-sm">{{ store.fps }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">粒子数</span>
          <p class="text-blue-400 font-mono text-sm">{{ store.particleArray.length }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">平均密度</span>
          <p class="text-yellow-400 font-mono text-sm">{{ store.avgDensity.toFixed(0) }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">最大速度</span>
          <p class="text-red-400 font-mono text-sm">{{ store.maxVelocity.toFixed(1) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
