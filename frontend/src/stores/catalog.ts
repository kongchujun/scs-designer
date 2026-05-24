import { defineStore } from 'pinia'
import { ref } from 'vue'
import { componentsApi } from '@/api/client'
import type { ComponentDef } from '@/types/design'

export const useCatalogStore = defineStore('catalog', () => {
  const components = ref<ComponentDef[]>([])
  const loading = ref(false)

  async function fetchComponents() {
    loading.value = true
    try {
      components.value = await componentsApi.list()
    } finally {
      loading.value = false
    }
  }

  function getByType(type: string) {
    return components.value.find((c) => c.type === type)
  }

  return { components, loading, fetchComponents, getByType }
})
