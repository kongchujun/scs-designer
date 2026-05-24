<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadsApi } from '@/api/client'
import { useCatalogStore } from '@/stores/catalog'
import { useDesignStore } from '@/stores/design'
import type { ComponentLayoutConfig } from '@/types/design'
import {
  defaultAppearanceForType,
  getTypeAppearance,
  sizeBoundsForSymbol,
  type PortLayout,
} from '@/utils/componentAppearance'
import { isBuiltinComponentType } from '@/utils/builtinComponents'
import { getPidSymbol } from '@/utils/pidSymbols'
import { clearImageCache, resolveImageUrl } from '@/utils/imageLoader'
import { useLocaleStore } from '@/stores/locale'
import LanguageSelect from '@/components/common/LanguageSelect.vue'

const visible = defineModel<boolean>({ default: false })
const catalog = useCatalogStore()
const design = useDesignStore()
const locale = useLocaleStore()

const selectedType = ref('')
const draft = ref<ComponentLayoutConfig | null>(null)
const uploading = ref(false)
const draggingPortId = ref<string | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)

const customizableComponents = computed(() =>
  catalog.components.filter((c) => !isBuiltinComponentType(c.type)),
)

const comp = computed(() => catalog.getByType(selectedType.value))

const selectedIsBuiltin = computed(
  () => !!selectedType.value && isBuiltinComponentType(selectedType.value),
)
const bounds = computed(() =>
  selectedType.value ? sizeBoundsForSymbol(getPidSymbol(selectedType.value)) : null,
)

const previewImage = computed(() => {
  const url = draft.value?.imageUrl
  return url ? resolveImageUrl(url) : ''
})

watch(visible, (v) => {
  if (v && customizableComponents.value.length && !selectedType.value) {
    selectedType.value = customizableComponents.value[0].type
  }
})

watch(selectedType, (type) => {
  if (!type) return
  const current = getTypeAppearance(type, design.document, comp.value ?? undefined)
  draft.value = {
    width: current.width,
    height: current.height,
    ports: current.ports.map((p) => ({ ...p })),
    imageUrl: current.imageUrl ?? null,
  }
})

function clamp01(n: number) {
  return Math.max(0.04, Math.min(0.96, n))
}

function onPortDragStart(portId: string, e: PointerEvent) {
  draggingPortId.value = portId
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPortDragMove(portId: string, e: PointerEvent) {
  if (!draft.value || !previewRef.value || draggingPortId.value !== portId) return
  const rect = previewRef.value.getBoundingClientRect()
  const x = clamp01((e.clientX - rect.left) / rect.width)
  const y = clamp01((e.clientY - rect.top) / rect.height)
  const port = draft.value.ports.find((p) => p.id === portId)
  if (!port) return
  if (port.direction === 'in') port.x = Math.min(x, 0.35)
  else port.x = Math.max(x, 0.65)
  port.y = y
}

function onPortDragEnd() {
  draggingPortId.value = null
}

async function onUpload(options: { file: File }) {
  if (!selectedType.value) return
  uploading.value = true
  try {
    const { url } = await uploadsApi.image(options.file)
    clearImageCache()
    if (draft.value) draft.value.imageUrl = url
    ElMessage.success(locale.t('custom.uploadOk'))
  } catch {
    ElMessage.error(locale.t('custom.uploadFail'))
  } finally {
    uploading.value = false
  }
}

function clearImage() {
  if (draft.value) draft.value.imageUrl = null
}

function onPreviewError() {
  ElMessage.error(locale.t('custom.previewFail'))
}

function resetType() {
  if (!selectedType.value) return
  const base = defaultAppearanceForType(selectedType.value, comp.value ?? undefined)
  draft.value = {
    width: base.width,
    height: base.height,
    ports: base.ports.map((p) => ({ ...p })),
    imageUrl: design.document.componentImages?.[selectedType.value] ?? null,
  }
  ElMessage.info(locale.t('custom.resetDone'))
}

function save() {
  if (!selectedType.value || !draft.value) return
  design.setComponentLayout(selectedType.value, {
    width: draft.value.width,
    height: draft.value.height,
    ports: draft.value.ports as PortLayout[],
    imageUrl: draft.value.imageUrl,
  })
  ElMessage.success(locale.t('custom.saved'))
  visible.value = false
}

const portRows = computed(() => draft.value?.ports ?? [])
</script>

<template>
  <el-dialog v-model="visible" :title="locale.t('custom.title')" width="780px" destroy-on-close>
    <div class="dialog-head">
      <p class="tip">{{ locale.t('custom.tip') }}</p>
      <LanguageSelect />
    </div>
    <div class="layout">
      <el-menu :default-active="selectedType" class="type-menu" @select="(k: string) => (selectedType = k)">
        <el-menu-item v-for="c in customizableComponents" :key="c.type" :index="c.type">
          {{ locale.componentLabel(c) }}
        </el-menu-item>
      </el-menu>

      <div v-if="selectedIsBuiltin" class="builtin-notice">
        <el-alert type="info" :closable="false" :title="locale.t('inspector.builtinLocked')" />
      </div>

      <div v-else-if="draft && bounds" class="editor">
        <div class="preview-wrap">
          <div
            ref="previewRef"
            class="preview"
            :style="{ width: draft.width + 'px', height: draft.height + 'px' }"
          >
            <img
              v-if="previewImage"
              :src="previewImage"
              class="preview-img"
              alt=""
              @error="onPreviewError"
            />
            <div v-else class="preview-placeholder">{{ comp ? locale.componentLabel(comp) : '' }}</div>
            <button
              v-for="port in portRows"
              :key="port.id"
              type="button"
              class="port-handle"
              :class="port.direction"
              :style="{ left: port.x * 100 + '%', top: port.y * 100 + '%' }"
              :title="`${port.direction === 'in' ? locale.t('port.in') : locale.t('port.out')}: ${port.id}`"
              @pointerdown="onPortDragStart(port.id, $event)"
              @pointermove="onPortDragMove(port.id, $event)"
              @pointerup="onPortDragEnd"
              @pointercancel="onPortDragEnd"
            >
              {{ port.id }}
            </button>
          </div>
        </div>

        <el-form label-width="88px" size="small" class="form">
          <el-form-item :label="locale.t('custom.width')">
            <el-slider v-model="draft.width" :min="bounds.minW" :max="bounds.maxW" :step="2" show-input />
          </el-form-item>
          <el-form-item :label="locale.t('custom.height')">
            <el-slider v-model="draft.height" :min="bounds.minH" :max="bounds.maxH" :step="2" show-input />
          </el-form-item>
          <el-form-item :label="locale.t('custom.image')">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              :http-request="(o: { file: File }) => onUpload(o)"
            >
              <el-button size="small" type="primary" :loading="uploading">{{ locale.t('custom.upload') }}</el-button>
            </el-upload>
            <el-button v-if="draft.imageUrl" size="small" link type="danger" @click="clearImage">
              {{ locale.t('custom.clearImage') }}
            </el-button>
          </el-form-item>
          <el-table :data="portRows" size="small" max-height="160">
            <el-table-column prop="id" :label="locale.t('custom.port')" width="72" />
            <el-table-column :label="locale.t('custom.direction')" width="88">
              <template #default="{ row }">
                <el-tag :type="row.direction === 'in' ? 'primary' : 'success'" size="small">
                  {{ row.direction === 'in' ? locale.t('custom.portIn') : locale.t('custom.portOut') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="X%">
              <template #default="{ row }">
                <el-input-number v-model="row.x" :min="0.04" :max="0.96" :step="0.02" :precision="2" />
              </template>
            </el-table-column>
            <el-table-column label="Y%">
              <template #default="{ row }">
                <el-input-number v-model="row.y" :min="0.04" :max="0.96" :step="0.02" :precision="2" />
              </template>
            </el-table-column>
          </el-table>
          <div class="actions">
            <el-button @click="resetType">{{ locale.t('custom.reset') }}</el-button>
            <el-button type="primary" @click="save">{{ locale.t('custom.save') }}</el-button>
          </div>
        </el-form>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.tip {
  font-size: 12px;
  color: #606266;
  margin: 0;
  line-height: 1.5;
  flex: 1;
}
.layout {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
  min-height: 360px;
}
.type-menu {
  border-right: 1px solid var(--el-border-color);
  max-height: 420px;
  overflow-y: auto;
}
.editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview-wrap {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  min-height: 200px;
  align-items: center;
}
.preview {
  position: relative;
  background: #fff;
  border: 2px solid #dcdfe6;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
}
.port-handle {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  font-size: 8px;
  color: #fff;
  cursor: grab;
  z-index: 2;
  padding: 0;
  line-height: 1;
}
.port-handle.in {
  background: #409eff;
}
.port-handle.out {
  background: #67c23a;
}
.port-handle:active {
  cursor: grabbing;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}
.builtin-notice {
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
