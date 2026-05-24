<script setup lang="ts">
import { useDemoStore } from '@/stores/demo'
import { useDesignStore } from '@/stores/design'
import { useLocaleStore } from '@/stores/locale'

const demo = useDemoStore()
const design = useDesignStore()
const locale = useLocaleStore()

function toggleAnim() {
  demo.animating = !demo.animating
  if (demo.animating) design.connectFrom = null
}
</script>

<template>
  <div class="demo-bar">
    <span class="label">{{ locale.t('demo.title') }}</span>
    <el-button size="small" :type="demo.animating ? 'warning' : 'primary'" @click="toggleAnim">
      {{ demo.animating ? locale.t('demo.flowStop') : locale.t('demo.flowStart') }}
    </el-button>
    <span class="speed-label">{{ locale.t('demo.speed') }}</span>
    <el-slider v-model="demo.flowSpeed" :min="0.5" :max="12" :step="0.5" style="width: 120px" />
    <span class="unit">{{ demo.flowSpeed }}×</span>
    <span v-if="demo.animating" class="lock-hint">{{ locale.t('demo.designLocked') }}</span>
  </div>
</template>

<style scoped>
.demo-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 12px;
  background: #f0f9ff;
  border-bottom: 1px solid #d9ecff;
}
.label {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
}
.speed-label {
  font-size: 12px;
  color: #606266;
  margin-left: 8px;
}
.unit {
  font-size: 12px;
  color: #909399;
  min-width: 32px;
}
.lock-hint {
  font-size: 12px;
  color: #e6a23c;
  margin-left: 4px;
}
</style>
