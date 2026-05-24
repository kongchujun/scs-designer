<script setup lang="ts">
import { useLocaleStore, type AppLocale } from '@/stores/locale'

const { showLabel = true } = defineProps<{ showLabel?: boolean }>()
const localeStore = useLocaleStore()

function onChange(v: AppLocale) {
  localeStore.setLocale(v)
}
</script>

<template>
  <div class="lang-select">
    <span v-if="showLabel" class="label">{{ localeStore.t('lang.label') }}</span>
    <el-select
      :model-value="localeStore.locale"
      size="small"
      style="width: 112px"
      @update:model-value="onChange"
    >
      <el-option :label="localeStore.t('lang.zh')" value="zh" />
      <el-option :label="localeStore.t('lang.en')" value="en" />
    </el-select>
  </div>
</template>

<style scoped>
.lang-select {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}
</style>
