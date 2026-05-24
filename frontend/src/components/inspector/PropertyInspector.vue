<script setup lang="ts">
import { computed } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useDesignStore } from '@/stores/design'
import { useDemoStore } from '@/stores/demo'
import { useLocaleStore } from '@/stores/locale'
import { isBuiltinComponentType } from '@/utils/builtinComponents'

const design = useDesignStore()
const catalog = useCatalogStore()
const demo = useDemoStore()
const locale = useLocaleStore()

const compDef = computed(() =>
  design.selectedNode ? catalog.getByType(design.selectedNode.type) : null,
)

const componentTitle = computed(() => {
  if (!design.selectedNode || !compDef.value) return ''
  return locale.componentLabel(compDef.value)
})

const componentNote = computed(() => compDef.value?.engineering_notes_zh ?? '')

const isBuiltin = computed(
  () => !!design.selectedNode && isBuiltinComponentType(design.selectedNode.type),
)

const valveActiveOut = computed({
  get: () =>
    design.selectedNode?.params.activeOut === 'out_b' ? 'out_b' : 'out_a',
  set: (v: string) => {
    if (!design.selectedNode) return
    design.patchNodeParams(design.selectedNode.id, { activeOut: v })
  },
})

const flowPercent = computed({
  get: () => Number(design.selectedNode?.params.flowPercent ?? 80),
  set: (v: number) => {
    if (!design.selectedNode) return
    design.patchNodeParams(design.selectedNode.id, { flowPercent: v })
  },
})
</script>

<template>
  <div class="inspector">
    <div class="title">{{ locale.t('inspector.title') }}</div>

    <el-collapse model-value="info">
      <el-collapse-item v-if="design.selectedCount > 1" :title="locale.t('inspector.nodeParams')" name="multi">
        <el-alert
          type="info"
          :closable="false"
          :title="locale.t('inspector.multiSelect', { n: design.selectedCount })"
        />
      </el-collapse-item>

      <el-collapse-item v-else-if="design.selectedNode && compDef" :title="locale.t('inspector.nodeInfo')" name="info">
        <h4 class="comp-name">{{ componentTitle }}</h4>
        <p class="type-id">{{ design.selectedNode.type }}</p>
        <p v-if="isBuiltin" class="builtin-tag">{{ locale.t('inspector.builtinLocked') }}</p>
        <p v-if="componentNote" class="hint">{{ componentNote }}</p>
      </el-collapse-item>

      <el-collapse-item v-else :title="locale.t('inspector.nodeInfo')" name="empty">
        <el-empty :description="locale.t('inspector.empty')" :image-size="60" />
      </el-collapse-item>

      <el-collapse-item
        v-if="design.selectedNode?.type === 'three_way_valve'"
        :title="locale.t('inspector.runtime')"
        name="runtime-valve"
      >
        <p class="hint">{{ locale.t('inspector.valveHint') }}</p>
        <el-radio-group v-model="valveActiveOut" class="runtime-control">
          <el-radio value="out_a">{{ locale.t('inspector.valveOutA') }}</el-radio>
          <el-radio value="out_b">{{ locale.t('inspector.valveOutB') }}</el-radio>
        </el-radio-group>
      </el-collapse-item>

      <el-collapse-item
        v-if="design.selectedNode?.type === 'three_way_tee'"
        :title="locale.t('inspector.runtime')"
        name="runtime-tee"
      >
        <p class="hint">{{ locale.t('inspector.teeHint') }}</p>
      </el-collapse-item>

      <el-collapse-item
        v-if="design.selectedNode?.type === 'flow_rate_regulator'"
        :title="locale.t('inspector.runtime')"
        name="runtime-flow"
      >
        <p class="hint">{{ locale.t('inspector.flowPercentHint') }}</p>
        <div class="slider-row">
          <span class="slider-label">{{ locale.t('inspector.flowPercent') }}</span>
          <el-slider
            v-model="flowPercent"
            :min="5"
            :max="100"
            :step="5"
            show-input
            :show-input-controls="false"
          />
        </div>
        <p v-if="!demo.animating" class="hint muted">点击「开始流动」后可看到气泡变化</p>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.inspector {
  padding: 12px;
  border-left: 1px solid var(--el-border-color);
  background: #fff;
  height: 100%;
  overflow: auto;
}
.title {
  font-weight: 600;
  margin-bottom: 8px;
}
.comp-name {
  margin: 0 0 4px;
  font-size: 15px;
  color: #303133;
}
.type-id {
  margin: 0 0 12px;
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}
.builtin-tag {
  font-size: 12px;
  color: #00a3a3;
  margin: 0 0 8px;
}
.hint {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 10px;
}
.hint.muted {
  color: #909399;
}
.runtime-control {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.slider-label {
  font-size: 12px;
  color: #606266;
}
</style>
