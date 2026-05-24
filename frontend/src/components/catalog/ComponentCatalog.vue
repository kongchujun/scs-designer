<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useDemoStore } from '@/stores/demo'
import { useLocaleStore } from '@/stores/locale'
import { isBuiltinComponentType } from '@/utils/builtinComponents'
import { symbolColor } from '@/utils/symbols'

const emit = defineEmits<{ pick: [type: string] }>()
const catalog = useCatalogStore()
const demo = useDemoStore()
const locale = useLocaleStore()

const tree = computed(() => {
  const map = new Map<string, typeof catalog.components>()
  for (const c of catalog.components) {
    if (!map.has(c.category)) map.set(c.category, [])
    map.get(c.category)!.push(c)
  }
  return [...map.entries()].map(([category, items]) => ({
    label: locale.categoryLabel(category),
    children: items.map((i) => ({
      label: locale.componentLabel(i),
      type: i.type,
      color: symbolColor(i.category),
    })),
  }))
})

onMounted(() => catalog.fetchComponents())

function onDragStart(e: DragEvent, type: string) {
  if (demo.animating) {
    e.preventDefault()
    return
  }
  e.dataTransfer?.setData('componentType', type)
}

function onClick(type: string) {
  if (demo.animating) return
  emit('pick', type)
}
</script>

<template>
  <div class="catalog">
    <div class="title">{{ locale.t('catalog.title') }}</div>
    <div class="catalog-scroll">
      <div v-for="group in tree" :key="group.label" class="group">
        <div class="group-label">{{ group.label }}</div>
        <div
          v-for="item in group.children"
          :key="item.type"
          class="item"
          :class="{ locked: demo.animating }"
          :draggable="!demo.animating"
          @dragstart="onDragStart($event, item.type)"
          @click="onClick(item.type)"
        >
          <span class="dot" :style="{ background: item.color }" />
          <span class="item-label">{{ item.label }}</span>
          <el-tag v-if="isBuiltinComponentType(item.type)" size="small" type="info" class="builtin-badge">
            {{ locale.t('catalog.builtin') }}
          </el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  border-right: 1px solid var(--el-border-color);
  background: #fafafa;
}
.title {
  flex-shrink: 0;
  font-weight: 600;
  margin-bottom: 8px;
}
.catalog-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 16px;
  margin-right: -4px;
  padding-right: 4px;
}
.group-label {
  font-size: 12px;
  color: #909399;
  margin: 8px 0 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: grab;
  font-size: 13px;
}
.item:hover {
  background: #ecf5ff;
}
.item.locked {
  opacity: 0.55;
  cursor: not-allowed;
}
.item.locked:hover {
  background: transparent;
}
.item-label {
  flex: 1;
  min-width: 0;
}
.builtin-badge {
  flex-shrink: 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
