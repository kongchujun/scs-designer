import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { enMessages } from '@/locales/en'
import { zhMessages, type MessageKey } from '@/locales/zh'
import type { ComponentDef } from '@/types/design'

export type AppLocale = 'zh' | 'en'

const STORAGE_KEY = 'scs-designer-locale'

function loadLocale(): AppLocale {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' ? 'en' : 'zh'
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(loadLocale())

  const messages = computed(() => (locale.value === 'en' ? enMessages : zhMessages))

  watch(
    locale,
    (v) => {
      localStorage.setItem(STORAGE_KEY, v)
      document.documentElement.lang = v === 'en' ? 'en' : 'zh-CN'
    },
    { immediate: true },
  )

  function setLocale(next: AppLocale) {
    locale.value = next
  }

  function t(key: MessageKey, params?: Record<string, string | number>): string {
    let text = messages.value[key] ?? zhMessages[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }

  function categoryLabel(category: string): string {
    const key = `category.${category}` as MessageKey
    return t(key) !== key ? t(key) : category
  }

  function componentLabel(comp: ComponentDef): string {
    return locale.value === 'en' ? comp.label_en : comp.label
  }

  function componentLabelByType(type: string, catalog: { getByType: (t: string) => ComponentDef | undefined }) {
    const c = catalog.getByType(type)
    return c ? componentLabel(c) : type
  }

  return { locale, setLocale, t, categoryLabel, componentLabel, componentLabelByType }
})
