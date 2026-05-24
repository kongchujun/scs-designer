/** 内置标准件：固定外观与端口，不可在「组件定制」中修改 */
export const BUILTIN_COMPONENT_TYPES = new Set([
  'three_way_valve',
  'three_way_tee',
  'flow_rate_regulator',
])

export const BUILTIN_SYMBOL_IMAGES: Record<string, string> = {
  three_way_valve: '/components/three_way_valve.png',
  three_way_tee: '/components/three_way_tee.png',
  flow_rate_regulator: '/components/flow_rate_regulator.png',
}

export function isBuiltinComponentType(type: string): boolean {
  return BUILTIN_COMPONENT_TYPES.has(type)
}

export function builtinSymbolImage(type: string): string | null {
  return BUILTIN_SYMBOL_IMAGES[type] ?? null
}
