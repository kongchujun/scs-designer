import type { ComponentDef, DesignDocument, DesignNode } from '@/types/design'
import { builtinSymbolImage, isBuiltinComponentType } from '@/utils/builtinComponents'
import { getPidSymbol, type PidSymbolDef } from '@/utils/pidSymbols'

export type PortDirection = 'in' | 'out'

export interface PortLayout {
  id: string
  direction: PortDirection
  /** 相对组件宽度/高度的比例 0–1 */
  x: number
  y: number
  label?: string
}

export interface SizeBounds {
  minW: number
  maxW: number
  minH: number
  maxH: number
}

export interface ComponentAppearance {
  width: number
  height: number
  ports: PortLayout[]
  imageUrl?: string | null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** 从目录 ports_json 生成默认端口列表（未在符号中精确定义时） */
export function portsFromCatalog(portsJson: Record<string, string[]>): PortLayout[] {
  const ports: PortLayout[] = []
  const ins = portsJson.in ?? []
  const outKeys = ['out', 'bypass', 'drain', 'vent', 'cal'] as const
  const outs: string[] = []
  for (const key of outKeys) {
    if (portsJson[key]) outs.push(...portsJson[key])
  }

  ins.forEach((id, i) => {
    const y = ins.length === 1 ? 0.5 : (i + 1) / (ins.length + 1)
    ports.push({ id, direction: 'in', x: 0, y, label: id })
  })
  outs.forEach((id, i) => {
    const y = outs.length === 1 ? 0.5 : (i + 1) / (outs.length + 1)
    ports.push({ id, direction: 'out', x: 1, y, label: id })
  })
  return ports
}

export function sizeBoundsForSymbol(sym: PidSymbolDef): SizeBounds {
  return {
    minW: Math.round(sym.width * 0.65),
    maxW: Math.round(sym.width * 1.45),
    minH: Math.round(sym.height * 0.65),
    maxH: Math.round(sym.height * 1.45),
  }
}

export function defaultAppearanceForType(type: string, comp?: ComponentDef | null): ComponentAppearance {
  const sym = getPidSymbol(type)
  const ports =
    sym.ports.length > 0
      ? sym.ports.map((p) => ({ ...p }))
      : comp
        ? portsFromCatalog(comp.ports_json)
        : [
            { id: 'in', direction: 'in' as const, x: 0, y: 0.5 },
            { id: 'out', direction: 'out' as const, x: 1, y: 0.5 },
          ]
  return {
    width: sym.width,
    height: sym.height,
    ports,
    imageUrl: null,
  }
}

export function getTypeAppearance(
  type: string,
  document: DesignDocument,
  comp?: ComponentDef | null,
): ComponentAppearance {
  const base = defaultAppearanceForType(type, comp)
  if (isBuiltinComponentType(type)) {
    const img = builtinSymbolImage(type)
    return { ...base, imageUrl: img, ports: base.ports.map((p) => ({ ...p })) }
  }
  const saved = document.componentLayouts?.[type]
  if (!saved) return base

  const bounds = sizeBoundsForSymbol(getPidSymbol(type))
  return {
    width: clamp(saved.width ?? base.width, bounds.minW, bounds.maxW),
    height: clamp(saved.height ?? base.height, bounds.minH, bounds.maxH),
    ports: mergePorts(base.ports, saved.ports),
    imageUrl: saved.imageUrl ?? document.componentImages?.[type] ?? null,
  }
}

function mergePorts(base: PortLayout[], saved?: PortLayout[]): PortLayout[] {
  if (!saved?.length) return base
  const map = new Map(saved.map((p) => [p.id, p]))
  return base.map((p) => {
    const o = map.get(p.id)
    if (!o) return { ...p }
    return {
      ...p,
      x: clamp(o.x, 0.02, 0.98),
      y: clamp(o.y, 0.02, 0.98),
    }
  })
}

export function resolveNodeAppearance(
  node: DesignNode,
  document: DesignDocument,
  comp?: ComponentDef | null,
): ComponentAppearance {
  const typeApp = getTypeAppearance(node.type, document, comp)
  const sym = getPidSymbol(node.type)
  const bounds = sizeBoundsForSymbol(sym)
  const locked = isBuiltinComponentType(node.type)

  const w = locked
    ? sym.width
    : clamp(Number(node.params.appearanceWidth ?? typeApp.width), bounds.minW, bounds.maxW)
  const h = locked
    ? sym.height
    : clamp(Number(node.params.appearanceHeight ?? typeApp.height), bounds.minH, bounds.maxH)

  let ports = typeApp.ports
  if (!locked) {
    const overrides = node.params.portOverrides as PortLayout[] | undefined
    if (overrides?.length) ports = mergePorts(typeApp.ports, overrides)
  }

  const customImg =
    !locked &&
    typeof node.params.customImageUrl === 'string' &&
    node.params.customImageUrl.length > 0
      ? node.params.customImageUrl
      : null

  return {
    width: w,
    height: h,
    ports,
    imageUrl:
      customImg ??
      typeApp.imageUrl ??
      (locked ? builtinSymbolImage(node.type) : null) ??
      document.componentImages?.[node.type] ??
      null,
  }
}

export function allowedPortIds(comp: ComponentDef): string[] {
  const ids: string[] = []
  for (const arr of Object.values(comp.ports_json)) {
    if (Array.isArray(arr)) ids.push(...arr)
  }
  return ids
}

export function primaryInPort(comp?: ComponentDef | null): string {
  return comp?.ports_json?.in?.[0] ?? 'in'
}

export function primaryOutPort(comp?: ComponentDef | null): string {
  for (const key of ['out', 'bypass', 'vent', 'drain', 'cal']) {
    const arr = comp?.ports_json?.[key]
    if (arr?.length) return arr[0]
  }
  return 'out'
}

export function portWorldPosition(
  node: DesignNode,
  portId: string,
  document: DesignDocument,
  comp?: ComponentDef | null,
  groupOffset?: { x: number; y: number },
): { x: number; y: number } {
  const app = resolveNodeAppearance(node, document, comp)
  const port = app.ports.find((p) => p.id === portId) ?? app.ports.find((p) => p.direction === 'in')
  const ox = groupOffset?.x ?? node.x
  const oy = groupOffset?.y ?? node.y
  if (!port) return { x: ox, y: oy }
  return { x: ox + port.x * app.width, y: oy + port.y * app.height }
}
