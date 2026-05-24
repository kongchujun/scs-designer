import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 演示模式：仅控制画布上的流动动画 */
export const useDemoStore = defineStore('demo', () => {
  const animating = ref(false)
  /** 演示用流动快慢（相对值，非工程计算） */
  const flowSpeed = ref(2)

  return { animating, flowSpeed }
})
