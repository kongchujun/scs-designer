<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DArrowLeft, DArrowRight, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ComponentCatalog from '@/components/catalog/ComponentCatalog.vue'
import PropertyInspector from '@/components/inspector/PropertyInspector.vue'
import PidCanvas from '@/components/pid/PidCanvas.vue'
import DemoFlowBar from '@/components/demo/DemoFlowBar.vue'
import ComponentCustomizerDialog from '@/components/config/ComponentCustomizerDialog.vue'
import { designsApi } from '@/api/client'
import { useCatalogStore } from '@/stores/catalog'
import { useDesignStore } from '@/stores/design'
import { useDemoStore } from '@/stores/demo'
import { resolveNodeAppearance } from '@/utils/componentAppearance'
import { useLocaleStore } from '@/stores/locale'
import LanguageSelect from '@/components/common/LanguageSelect.vue'

const route = useRoute()
const locale = useLocaleStore()
const router = useRouter()
const design = useDesignStore()
const catalog = useCatalogStore()
const demo = useDemoStore()

const canvasRef = ref<InstanceType<typeof PidCanvas> | null>(null)
const customizerOpen = ref(false)
const canvasW = ref(900)
const canvasH = ref(560)
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)

function onResize() {
  const el = document.querySelector('.canvas-wrap')
  if (el) {
    canvasW.value = el.clientWidth
    canvasH.value = Math.max(480, window.innerHeight - 160)
  }
}

onMounted(async () => {
  await catalog.fetchComponents()
  onResize()
  window.addEventListener('resize', onResize)
  const id = Number(route.params.designId)
  if (id) {
    const d = await designsApi.get(id)
    design.loadDocument(d.config_json, d.id, d.name)
    design.designName = d.name
  }
})

onUnmounted(() => window.removeEventListener('resize', onResize))

watch([leftCollapsed, rightCollapsed], () => {
  nextTick(() => onResize())
})

function isEditingField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function refreshCanvas() {
  canvasRef.value?.redraw()
}

function handleUndo() {
  if (!design.canUndo) return
  design.undo()
  refreshCanvas()
}

function handleRedo() {
  if (!design.canRedo) return
  design.redo()
  refreshCanvas()
}

function onKey(e: KeyboardEvent) {
  if (isEditingField(e.target)) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    design.removeSelected()
    refreshCanvas()
    return
  }

  const mod = e.ctrlKey || e.metaKey
  if (!mod) return

  if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault()
    if (e.shiftKey) handleRedo()
    else handleUndo()
    return
  }
  if (e.key === 'y' || e.key === 'Y') {
    e.preventDefault()
    handleRedo()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function save() {
  await design.save()
  ElMessage.success(locale.t('designer.saved'))
}

function addAtCenter(type: string) {
  if (demo.animating) {
    ElMessage.warning(locale.t('demo.designLocked'))
    return
  }
  const def = catalog.getByType(type)
  const app = resolveNodeAppearance(
    { id: '', type, x: 0, y: 0, params: {} },
    design.document,
    def ?? undefined,
  )
  design.addNode(type, canvasW.value / 2 - app.width / 2, canvasH.value / 2 - app.height / 2)
  canvasRef.value?.redraw()
}

function exportPng() {
  const url = canvasRef.value?.exportSnapshot()
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `${design.designName}.png`
  a.click()
}
</script>

<template>
  <div class="designer">
    <header class="toolbar">
      <el-button @click="router.push('/')">{{ locale.t('designer.back') }}</el-button>
      <el-input v-model="design.designName" style="width: 200px" size="small" />
      <el-button type="primary" size="small" :disabled="!design.dirty" @click="save">
        {{ locale.t('designer.save') }}
      </el-button>
      <el-button
        size="small"
        :icon="RefreshLeft"
        :disabled="!design.canUndo"
        :title="locale.t('designer.undoTitle')"
        @click="handleUndo"
      >
        {{ locale.t('designer.undo') }}
      </el-button>
      <el-button
        size="small"
        :icon="RefreshRight"
        :disabled="!design.canRedo"
        :title="locale.t('designer.redoTitle')"
        @click="handleRedo"
      >
        {{ locale.t('designer.redo') }}
      </el-button>
      <el-button size="small" :disabled="demo.animating" @click="design.insertDemoChain">
        {{ locale.t('designer.demoChain') }}
      </el-button>
      <el-button size="small" @click="customizerOpen = true">{{ locale.t('designer.customize') }}</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" @click="exportPng">{{ locale.t('designer.exportPng') }}</el-button>
      <LanguageSelect :show-label="false" />
      <span v-if="design.dirty" class="dirty">{{ locale.t('designer.unsaved') }}</span>
    </header>
    <DemoFlowBar />
    <p class="hint">{{ locale.t('designer.hint') }}</p>
    <div class="main">
      <div class="panel-shell left" :class="{ collapsed: leftCollapsed }">
        <aside class="panel-content left">
          <ComponentCatalog @pick="addAtCenter" />
        </aside>
        <button
          type="button"
          class="panel-toggle"
          :title="leftCollapsed ? locale.t('designer.expandLeft') : locale.t('designer.collapseLeft')"
          @click="leftCollapsed = !leftCollapsed"
        >
          <el-icon :size="14">
            <DArrowLeft v-if="!leftCollapsed" />
            <DArrowRight v-else />
          </el-icon>
        </button>
      </div>

      <div class="canvas-wrap">
        <PidCanvas ref="canvasRef" :width="canvasW" :height="canvasH" />
      </div>

      <div class="panel-shell right" :class="{ collapsed: rightCollapsed }">
        <button
          type="button"
          class="panel-toggle"
          :title="rightCollapsed ? locale.t('designer.expandRight') : locale.t('designer.collapseRight')"
          @click="rightCollapsed = !rightCollapsed"
        >
          <el-icon :size="14">
            <DArrowRight v-if="!rightCollapsed" />
            <DArrowLeft v-else />
          </el-icon>
        </button>
        <aside class="panel-content right">
          <PropertyInspector />
        </aside>
      </div>
    </div>
    <ComponentCustomizerDialog v-model="customizerOpen" />
  </div>
</template>

<style scoped>
.designer {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color);
  flex-wrap: wrap;
}
.hint {
  font-size: 12px;
  color: #909399;
  padding: 0 12px;
  margin: 0;
}
.main {
  flex: 1;
  display: flex;
  min-height: 0;
}
.panel-shell {
  display: flex;
  flex-shrink: 0;
  min-height: 0;
  background: #fafafa;
}
.panel-shell.left {
  border-right: 1px solid var(--el-border-color);
}
.panel-shell.right {
  border-left: 1px solid var(--el-border-color);
}
.panel-content {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition:
    width 0.22s ease,
    opacity 0.18s ease;
}
.panel-content.left {
  width: 220px;
}
.panel-content.right {
  width: 280px;
  background: #fff;
}
.panel-shell.left.collapsed .panel-content.left {
  width: 0;
  opacity: 0;
  pointer-events: none;
}
.panel-shell.right.collapsed .panel-content.right {
  width: 0;
  opacity: 0;
  pointer-events: none;
}
.panel-toggle {
  flex-shrink: 0;
  width: 22px;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: #f0f2f5;
  color: #606266;
  cursor: pointer;
  transition: background 0.15s;
}
.panel-toggle:hover {
  background: #e4e7ed;
  color: #409eff;
}
.panel-shell.left .panel-toggle {
  border-left: 1px solid var(--el-border-color);
}
.panel-shell.right .panel-toggle {
  border-right: 1px solid var(--el-border-color);
}
.canvas-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.dirty {
  color: #e6a23c;
  font-size: 12px;
}
</style>
