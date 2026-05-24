<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Konva from 'konva'
import { useCatalogStore } from '@/stores/catalog'
import { useDesignStore } from '@/stores/design'
import { useDemoStore } from '@/stores/demo'
import { symbolColor } from '@/utils/symbols'
import { loadImage } from '@/utils/imageLoader'
import {
  resolveNodeAppearance,
  type ComponentAppearance,
  type PortLayout,
} from '@/utils/componentAppearance'
import { getPidSymbol } from '@/utils/pidSymbols'
import { computeFlowEdgeStates, flowDotsForEdge } from '@/utils/flowSimulation'
import type { DesignNode } from '@/types/design'
import { useLocaleStore } from '@/stores/locale'

const props = defineProps<{ width: number; height: number }>()
const emit = defineEmits<{ snapshot: [dataUrl: string] }>()

const containerRef = ref<HTMLDivElement | null>(null)
const connectHint = ref('')
const zoomPercent = ref(100)
/** 逻辑画板尺寸（可平移缩放浏览） */
const WORLD_W = 3200
const WORLD_H = 2400
const MIN_SCALE = 0.15
const MAX_SCALE = 3
const ZOOM_STEP = 1.12

let spacePressed = false
let isPanning = false
const design = useDesignStore()
const catalog = useCatalogStore()
const demo = useDemoStore()
const locale = useLocaleStore()

let stage: Konva.Stage | null = null
let layer: Konva.Layer | null = null
let flowLayer: Konva.Layer | null = null
let uiLayer: Konva.Layer | null = null
let gridLayer: Konva.Layer | null = null
let previewLine: Konva.Line | null = null
const nodeGroups = new Map<string, Konva.Group>()
const edgePipes = new Map<string, PipeVisual>()
const edgeHeatLines = new Map<string, Konva.Line>()

interface PipeVisual {
  group: Konva.Group
  outer: Konva.Line
  inner: Konva.Line
  shine: Konva.Line
  hit: Konva.Line
  startCap: Konva.Circle
  endCap: Konva.Circle
}

interface FlowDot {
  edgeId: string
  t: number
  core: Konva.Circle
  glow: Konva.Circle
}

const FLOW_DOTS_PER_EDGE = 6
let flowDots: FlowDot[] = []
let flowRaf: number | null = null
let isDragging = false
let isMarquee = false
let suppressBackgroundClick = false
let selectRect: Konva.Rect | null = null
let selectStartWorld: { x: number; y: number } | null = null
let multiDragStarts: Record<string, { x: number; y: number }> = {}
let dragLeaderId: string | null = null
let dragLeaderStart = { x: 0, y: 0 }

function nodeAppearance(node: DesignNode): ComponentAppearance {
  return resolveNodeAppearance(node, design.document, catalog.getByType(node.type) ?? undefined)
}

/** 管外径(mm) → 画布像素管径 */
function pipeOuterWidth(odMm?: number) {
  const od = odMm ?? 6
  return Math.max(12, Math.min(26, 8 + od * 1.6))
}

function setLineEndpoints(line: Konva.Line, a: { x: number; y: number }, b: { x: number; y: number }) {
  line.points([a.x, a.y, b.x, b.y])
}

function updatePipeGeometry(
  visual: PipeVisual,
  a: { x: number; y: number },
  b: { x: number; y: number },
  odMm?: number,
) {
  const outerW = pipeOuterWidth(odMm)
  const innerW = Math.max(6, outerW * 0.48)
  setLineEndpoints(visual.outer, a, b)
  setLineEndpoints(visual.inner, a, b)
  setLineEndpoints(visual.shine, a, b)
  setLineEndpoints(visual.hit, a, b)
  visual.outer.strokeWidth(outerW)
  visual.inner.strokeWidth(innerW)
  visual.shine.strokeWidth(Math.max(2, innerW * 0.22))
  visual.hit.strokeWidth(outerW + 14)
  const capR = outerW / 2 + 2
  visual.startCap.position(a)
  visual.startCap.radius(capR)
  visual.endCap.position(b)
  visual.endCap.radius(capR)
}

function createPipeVisual(
  edgeId: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  selected: boolean,
  odMm?: number,
  flowDimmed = false,
): PipeVisual {
  const outerW = pipeOuterWidth(odMm)
  const innerW = Math.max(6, outerW * 0.48)
  const pts = [a.x, a.y, b.x, b.y]
  const outerStroke = flowDimmed ? '#d4d7dc' : selected ? '#2d7ce0' : '#5a6068'
  const innerStroke = flowDimmed ? '#e8eaed' : selected ? '#b3d8ff' : '#d0d4d9'
  const capStroke = flowDimmed ? '#c0c4cc' : selected ? '#409EFF' : '#6b727a'
  const capFill = flowDimmed ? '#dcdfe6' : selected ? '#79bbff' : '#9ea3aa'

  const outer = new Konva.Line({
    points: pts,
    stroke: outerStroke,
    strokeWidth: outerW,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  })
  const inner = new Konva.Line({
    points: pts,
    stroke: innerStroke,
    strokeWidth: innerW,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  })
  const shine = new Konva.Line({
    points: pts,
    stroke: 'rgba(255,255,255,0.35)',
    strokeWidth: Math.max(2, innerW * 0.22),
    lineCap: 'round',
    listening: false,
    opacity: selected ? 0.55 : 0.3,
  })
  const capR = outerW / 2 + 2
  const startCap = new Konva.Circle({
    x: a.x,
    y: a.y,
    radius: capR,
    stroke: capStroke,
    strokeWidth: 2,
    fill: capFill,
    listening: false,
  })
  const endCap = new Konva.Circle({
    x: b.x,
    y: b.y,
    radius: capR,
    stroke: capStroke,
    strokeWidth: 2,
    fill: capFill,
    listening: false,
  })
  const hit = new Konva.Line({
    points: pts,
    stroke: 'rgba(0,0,0,0.01)',
    strokeWidth: outerW + 14,
    lineCap: 'round',
    name: `edge-${edgeId}`,
    hitStrokeWidth: 28,
  })

  const group = new Konva.Group({ name: `edge-${edgeId}` })
  group.add(outer)
  group.add(inner)
  group.add(shine)
  group.add(startCap)
  group.add(endCap)
  group.add(hit)

  return { group, outer, inner, shine, hit, startCap, endCap }
}

function positionFlowDot(dot: FlowDot, a: { x: number; y: number }, b: { x: number; y: number }) {
  const x = a.x + (b.x - a.x) * dot.t
  const y = a.y + (b.y - a.y) * dot.t
  dot.core.position({ x, y })
  dot.glow.position({ x, y })
}

function nodeLabel(type: string) {
  const c = catalog.getByType(type)
  return c ? locale.componentLabel(c) : type
}

function nodeWorldOrigin(nodeId: string) {
  const group = nodeGroups.get(nodeId)
  if (group) return { x: group.x(), y: group.y() }
  const n = design.document.nodes.find((x) => x.id === nodeId)
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 }
}

function portAbs(nodeId: string, portId: string) {
  const node = design.document.nodes.find((n) => n.id === nodeId)
  if (!node) return { x: 0, y: 0 }
  const origin = nodeWorldOrigin(nodeId)
  const app = nodeAppearance(node)
  const port =
    app.ports.find((p) => p.id === portId) ??
    app.ports.find((p) => p.direction === 'in') ??
    app.ports[0]
  if (!port) return origin
  return { x: origin.x + port.x * app.width, y: origin.y + port.y * app.height }
}

function drawGrid() {
  if (!gridLayer) return
  gridLayer.destroyChildren()
  const g = 20
  const major = 100
  for (let i = 0; i <= WORLD_W; i += g) {
    gridLayer.add(
      new Konva.Line({
        points: [i, 0, i, WORLD_H],
        stroke: i % major === 0 ? '#ddd' : '#f0f0f0',
        strokeWidth: i % major === 0 ? 1 : 0.5,
        listening: false,
      }),
    )
  }
  for (let j = 0; j <= WORLD_H; j += g) {
    gridLayer.add(
      new Konva.Line({
        points: [0, j, WORLD_W, j],
        stroke: j % major === 0 ? '#ddd' : '#f0f0f0',
        strokeWidth: j % major === 0 ? 1 : 0.5,
        listening: false,
      }),
    )
  }
  gridLayer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: WORLD_W,
      height: WORLD_H,
      stroke: '#c0c4cc',
      strokeWidth: 1,
      dash: [8, 6],
      listening: false,
    }),
  )
}

function applyZoom(newScale: number, anchor?: { x: number; y: number }) {
  if (!stage) return
  const oldScale = stage.scaleX()
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
  const pointer = anchor ?? { x: stage.width() / 2, y: stage.height() / 2 }
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  }
  stage.scale({ x: clamped, y: clamped })
  stage.position({
    x: pointer.x - mousePointTo.x * clamped,
    y: pointer.y - mousePointTo.y * clamped,
  })
  zoomPercent.value = Math.round(clamped * 100)
}

function zoomIn() {
  if (!stage) return
  applyZoom(stage.scaleX() * ZOOM_STEP, {
    x: stage.width() / 2,
    y: stage.height() / 2,
  })
}

function zoomOut() {
  if (!stage) return
  applyZoom(stage.scaleX() / ZOOM_STEP, {
    x: stage.width() / 2,
    y: stage.height() / 2,
  })
}

function zoomReset() {
  if (!stage) return
  stage.scale({ x: 1, y: 1 })
  stage.position({ x: 0, y: 0 })
  zoomPercent.value = 100
}

function nodesBoundingBox() {
  const nodes = design.document.nodes
  if (!nodes.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const app = nodeAppearance(n)
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + app.width)
    maxY = Math.max(maxY, n.y + app.height + 14)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function pointerWorld(): { x: number; y: number } | null {
  const p = stage?.getPointerPosition()
  if (!p || !stage) return null
  const s = stage.scaleX()
  return { x: (p.x - stage.x()) / s, y: (p.y - stage.y()) / s }
}

function rectsIntersect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/** 缩放平移使所有部件居中显示 */
function zoomFitNodes() {
  if (!stage) return
  const bb = nodesBoundingBox()
  if (!bb || bb.width < 1 || bb.height < 1) {
    zoomFitWorld()
    return
  }
  const padding = 80
  const sx = (stage.width() - padding * 2) / bb.width
  const sy = (stage.height() - padding * 2) / bb.height
  const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)))
  stage.scale({ x: s, y: s })
  stage.position({
    x: (stage.width() - bb.width * s) / 2 - bb.minX * s,
    y: (stage.height() - bb.height * s) / 2 - bb.minY * s,
  })
  zoomPercent.value = Math.round(s * 100)
}

function zoomFitWorld() {
  if (!stage) return
  const padding = 40
  const sx = (stage.width() - padding * 2) / WORLD_W
  const sy = (stage.height() - padding * 2) / WORLD_H
  const s = Math.min(sx, sy, 1)
  stage.scale({ x: s, y: s })
  stage.position({
    x: (stage.width() - WORLD_W * s) / 2,
    y: (stage.height() - WORLD_H * s) / 2,
  })
  zoomPercent.value = Math.round(s * 100)
}

function zoomFit() {
  zoomFitNodes()
}

function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault()
  if (!stage) return
  const pointer = stage.getPointerPosition() ?? { x: stage.width() / 2, y: stage.height() / 2 }
  const direction = e.evt.deltaY > 0 ? -1 : 1
  const newScale = direction > 0 ? stage.scaleX() * ZOOM_STEP : stage.scaleX() / ZOOM_STEP
  applyZoom(newScale, pointer)
}

function isStageBackground(target: Konva.Node) {
  if (target === stage) return true
  const name = target.name() || ''
  if (name.startsWith('edge-')) return false
  return !target.findAncestor((n: Konva.Node) => (n.name() || '').startsWith('node-'), true)
}

function setPanCursor(pan: boolean) {
  if (!containerRef.value) return
  containerRef.value.style.cursor = pan ? 'grab' : 'default'
}

function startPan() {
  if (!stage) return
  isPanning = true
  stage.draggable(true)
  setPanCursor(true)
  if (containerRef.value) containerRef.value.style.cursor = 'grabbing'
}

function endPan() {
  if (!stage) return
  isPanning = false
  stage.draggable(false)
  setPanCursor(spacePressed)
}

function updateEdgeGeometry(edgeId: string) {
  const edge = design.document.edges.find((e) => e.id === edgeId)
  const visual = edgePipes.get(edgeId)
  if (!edge || !visual) return
  const a = portAbs(edge.from.nodeId, 'out')
  const b = portAbs(edge.to.nodeId, 'in')
  updatePipeGeometry(visual, a, b, edge.line.odMm)
  const heat = edgeHeatLines.get(edgeId)
  if (heat) {
    const offset = pipeOuterWidth(edge.line.odMm) / 2 + 6
    heat.points([a.x, a.y - offset, b.x, b.y - offset])
  }
}

function updateEdgesForNodes(nodeIds: string[]) {
  const idSet = new Set(nodeIds)
  for (const edge of design.document.edges) {
    if (idSet.has(edge.from.nodeId) || idSet.has(edge.to.nodeId)) {
      updateEdgeGeometry(edge.id)
    }
  }
  layer?.batchDraw()
}

function styleImageNodeBody(rect: Konva.Rect, selected: boolean) {
  rect.fill('transparent')
  rect.shadowBlur(0)
  rect.shadowOpacity(0)
  rect.stroke(selected ? '#409EFF' : 'transparent')
  rect.strokeWidth(selected ? 2 : 0)
}

function updateNodeStroke(nodeId: string) {
  const group = nodeGroups.get(nodeId)
  const node = design.document.nodes.find((n) => n.id === nodeId)
  if (!group || !node) return
  const rect = group.findOne('.body') as Konva.Rect | undefined
  if (!rect) return
  const selected = design.isNodeSelected(node.id)
  const hasImage = !!group.findOne('.custom-image')
  if (hasImage) {
    styleImageNodeBody(rect, selected)
    return
  }
  rect.stroke(selected ? '#409EFF' : '#606266')
  rect.strokeWidth(selected ? 3 : 2)
  rect.shadowBlur(selected ? 8 : 0)
}

function clearConnectPreview() {
  previewLine?.destroy()
  previewLine = null
  connectHint.value = ''
  uiLayer?.batchDraw()
}

function updateConnectPreview() {
  if (!uiLayer || !design.connectFrom) return
  const from = portAbs(design.connectFrom.nodeId, design.connectFrom.port)
  const pos = pointerWorld() ?? from
  if (!previewLine) {
    previewLine = new Konva.Line({
      points: [from.x, from.y, pos.x, pos.y],
      stroke: '#a0cfff',
      strokeWidth: 14,
      lineCap: 'round',
      dash: [10, 8],
      opacity: 0.85,
      listening: false,
    })
    uiLayer.add(previewLine)
  } else {
    previewLine.points([from.x, from.y, pos.x, pos.y])
  }
  uiLayer.batchDraw()
}

function highlightPorts() {
  nodeGroups.forEach((group, nodeId) => {
    const node = design.document.nodes.find((n) => n.id === nodeId)
    if (!node) return
    for (const port of nodeAppearance(node).ports) {
      const circle = group.findOne(`.port-${port.id}`) as Konva.Circle | undefined
      if (!circle) continue
      if (port.direction === 'in') {
        const active = !!design.connectFrom && design.connectFrom.nodeId !== nodeId
        circle.radius(active ? 9 : 7)
        circle.stroke(active ? '#409EFF' : '#fff')
        circle.strokeWidth(active ? 3 : 1)
      } else {
        const isSource =
          design.connectFrom?.nodeId === nodeId && design.connectFrom.port === port.id
        circle.radius(isSource ? 9 : 7)
        circle.stroke(isSource ? '#E6A23C' : '#fff')
        circle.strokeWidth(isSource ? 3 : 1)
      }
    }
  })
  layer?.batchDraw()
}

function beginConnect(nodeId: string, portId: string) {
  if (demo.animating) return
  design.startConnect(nodeId, portId)
  connectHint.value = locale.t('canvas.connectHint')
  highlightPorts()
  updateConnectPreview()
}

function completeConnect(nodeId: string, portId: string) {
  if (!design.connectFrom) return
  if (design.connectFrom.nodeId === nodeId) {
    design.connectFrom = null
    clearConnectPreview()
    highlightPorts()
    return
  }
  design.finishConnect(nodeId, portId)
  design.connectFrom = null
  clearConnectPreview()
  const done = locale.t('canvas.connected')
  connectHint.value = done
  setTimeout(() => {
    if (connectHint.value === done) connectHint.value = ''
  }, 2000)
  redraw()
}

function attachNodeImage(group: Konva.Group, node: DesignNode, selected: boolean) {
  const url = design.resolveNodeImageUrl(node)
  if (!url) return
  loadImage(url)
    .then((img) => {
      if (!nodeGroups.has(node.id)) return
      group.findOne('.custom-image')?.destroy()
      const app = nodeAppearance(node)
      const pad = 2
      const kImg = new Konva.Image({
        name: 'custom-image',
        image: img,
        x: pad,
        y: pad,
        width: app.width - pad * 2,
        height: app.height - pad * 2,
        opacity: 1,
        listening: false,
      })
      const body = group.findOne('.body') as Konva.Rect | undefined
      if (body) {
        body.moveToBottom()
        styleImageNodeBody(body, selected)
      }
      group.add(kImg)
      for (const port of app.ports) {
        group.findOne(`.port-${port.id}`)?.moveToTop()
      }
      layer?.batchDraw()
    })
    .catch(() => {})
}

function rebuildFlowDots() {
  if (!flowLayer) return
  flowLayer.destroyChildren()
  flowDots = []
  if (!demo.animating) return
  const flowStates = computeFlowEdgeStates(design.document)
  for (const edge of design.document.edges) {
    const state = flowStates.get(edge.id)
    const dotCount = flowDotsForEdge(FLOW_DOTS_PER_EDGE, state)
    for (let i = 0; i < dotCount; i++) {
      const glow = new Konva.Circle({
        radius: 14,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientEndRadius: 14,
        fillRadialGradientColorStops: [0, 'rgba(121,196,255,0.55)', 1, 'rgba(64,158,255,0)'],
        listening: false,
      })
      const core = new Konva.Circle({
        radius: 5,
        fill: '#79c4ff',
        stroke: '#ffffff',
        strokeWidth: 1.5,
        shadowBlur: 18,
        shadowColor: '#409EFF',
        shadowOpacity: 1,
        opacity: 0.95,
        listening: false,
      })
      flowLayer.add(glow)
      flowLayer.add(core)
      const denom = Math.max(1, dotCount)
      flowDots.push({ edgeId: edge.id, t: i / denom, core, glow })
    }
  }
}

function flowTick() {
  if (!demo.animating || !flowLayer) {
    stopFlowAnimation()
    return
  }
  const speed = 0.003 + demo.flowSpeed * 0.0007
  const flowStates = computeFlowEdgeStates(design.document)
  for (const dot of flowDots) {
    const edge = design.document.edges.find((e) => e.id === dot.edgeId)
    if (!edge) continue
    const state = flowStates.get(edge.id)
    if (!state?.active) continue
    dot.t += speed
    if (dot.t >= 1) dot.t -= 1
    const a = portAbs(edge.from.nodeId, edge.from.port)
    const b = portAbs(edge.to.nodeId, edge.to.port)
    positionFlowDot(dot, a, b)
    const pulse = 0.75 + 0.25 * Math.sin(dot.t * Math.PI * 2)
    dot.core.opacity(0.7 + pulse * 0.3)
    dot.glow.opacity(0.35 + pulse * 0.35)
  }
  flowLayer.batchDraw()
  flowRaf = requestAnimationFrame(flowTick)
}

function startFlowAnimation() {
  if (flowRaf != null) return
  rebuildFlowDots()
  flowRaf = requestAnimationFrame(flowTick)
}

function stopFlowAnimation() {
  if (flowRaf != null) {
    cancelAnimationFrame(flowRaf)
    flowRaf = null
  }
  flowLayer?.destroyChildren()
  flowDots = []
}

function drawSymbolBody(
  group: Konva.Group,
  node: DesignNode,
  app: ComponentAppearance,
  color: string,
  stroke: string,
  selected: boolean,
) {
  const sym = getPidSymbol(node.type)
  const sx = app.width / sym.width
  const sy = app.height / sym.height

  if (!app.imageUrl) {
    const symbolGroup = new Konva.Group({ scaleX: sx, scaleY: sy, listening: false })
    for (const d of sym.paths) {
      symbolGroup.add(
        new Konva.Path({
          data: d,
          stroke,
          strokeWidth: 2,
          fill: color + '30',
          lineJoin: 'round',
          lineCap: 'round',
          listening: false,
        }),
      )
    }
    for (const d of sym.details ?? []) {
      symbolGroup.add(
        new Konva.Path({
          data: d,
          stroke: '#909399',
          strokeWidth: 1,
          listening: false,
        }),
      )
    }
    group.add(symbolGroup)
  }

  group.add(
    new Konva.Rect({
      name: 'body',
      width: app.width,
      height: app.height,
      fill: app.imageUrl ? 'transparent' : 'rgba(0,0,0,0.001)',
      stroke: app.imageUrl ? (selected ? '#409EFF' : 'transparent') : selected ? '#409EFF' : 'transparent',
      strokeWidth: app.imageUrl ? (selected ? 2 : 0) : selected ? 2 : 0,
      cornerRadius: app.imageUrl ? 4 : 0,
      shadowBlur: app.imageUrl ? 0 : selected ? 8 : 0,
      shadowColor: '#409EFF',
    }),
  )

  group.add(
    new Konva.Text({
      text: nodeLabel(node.type),
      y: app.height + 2,
      width: app.width,
      fontSize: 10,
      fill: '#606266',
      align: 'center',
      listening: false,
    }),
  )
}

function createPort(
  group: Konva.Group,
  node: DesignNode,
  port: PortLayout,
  app: ComponentAppearance,
) {
  let radius = 7
  let opacity = 1
  if (node.type === 'three_way_valve' && port.direction === 'out') {
    const active = node.params.activeOut === 'out_b' ? 'out_b' : 'out_a'
    if (port.id === active) radius = 9
    else opacity = 0.45
  }
  const circle = new Konva.Circle({
    x: port.x * app.width,
    y: port.y * app.height,
    radius,
    opacity,
    fill: port.direction === 'in' ? '#409EFF' : '#67C23A',
    stroke: '#fff',
    strokeWidth: 2,
    name: `port-${port.id}`,
    hitStrokeWidth: 22,
  })
  circle.on('mousedown touchstart', (e) => {
    e.cancelBubble = true
    group.stopDrag()
  })
  circle.on('click tap', (e) => {
    e.cancelBubble = true
    if (port.direction === 'out') beginConnect(node.id, port.id)
    else if (design.connectFrom) completeConnect(node.id, port.id)
  })
  return circle
}

function portPointInNode(app: ComponentAppearance, portId: string) {
  const port = app.ports.find((p) => p.id === portId)
  if (!port) return { x: app.width / 2, y: app.height / 2 }
  return { x: port.x * app.width, y: port.y * app.height }
}

function setValveFlow(nodeId: string, activeOut: 'out_a' | 'out_b') {
  const node = design.document.nodes.find((n) => n.id === nodeId)
  if (!node || node.type !== 'three_way_valve') return
  if (node.params.activeOut === activeOut) return
  design.patchNodeParams(nodeId, { activeOut })
  refreshThreeWayValveUi(nodeId)
  if (demo.animating) {
    rebuildFlowDots()
    refreshFlowEdgeStyles()
  }
}

function refreshFlowEdgeStyles() {
  if (!layer || !demo.animating) return
  const flowStates = computeFlowEdgeStates(design.document)
  for (const edge of design.document.edges) {
    const visual = edgePipes.get(edge.id)
    if (!visual) continue
    const a = portAbs(edge.from.nodeId, edge.from.port)
    const b = portAbs(edge.to.nodeId, edge.to.port)
    const flowDimmed = !flowStates.get(edge.id)?.active
    updatePipeGeometry(visual, a, b, edge.line.odMm)
    const outerStroke = flowDimmed ? '#d4d7dc' : '#5a6068'
    const innerStroke = flowDimmed ? '#e8eaed' : '#d0d4d9'
    visual.outer.stroke(outerStroke)
    visual.inner.stroke(innerStroke)
  }
  layer.batchDraw()
}

function refreshThreeWayValveUi(nodeId: string) {
  const group = nodeGroups.get(nodeId)
  const node = design.document.nodes.find((n) => n.id === nodeId)
  if (!group || !node) return
  const app = nodeAppearance(node)
  group.findOne('.flow-pointer')?.destroy()
  addThreeWayValvePointer(group, node, app)
  for (const port of app.ports) {
    const circle = group.findOne(`.port-${port.id}`) as Konva.Circle | undefined
    if (!circle) continue
    const active = node.params.activeOut === 'out_b' ? 'out_b' : 'out_a'
    if (port.direction === 'out') {
      if (port.id === active) {
        circle.radius(9)
        circle.opacity(1)
      } else {
        circle.radius(7)
        circle.opacity(0.45)
      }
    }
    circle.moveToTop()
  }
  layer?.batchDraw()
}

function addThreeWayValvePointer(group: Konva.Group, node: DesignNode, app: ComponentAppearance) {
  const active = node.params.activeOut === 'out_b' ? 'out_b' : 'out_a'
  const center = { x: app.width * 0.48, y: app.height * 0.46 }
  const target = portPointInNode(app, active)

  const pointer = new Konva.Group({ name: 'flow-pointer' })

  const shaft = new Konva.Arrow({
    name: 'flow-shaft',
    points: [center.x, center.y, target.x, target.y],
    stroke: '#E6A23C',
    fill: '#E6A23C',
    strokeWidth: 4,
    pointerLength: 12,
    pointerWidth: 12,
    listening: false,
  })

  const pivot = new Konva.Circle({
    name: 'flow-pivot',
    x: center.x,
    y: center.y,
    radius: 10,
    fill: '#303133',
    stroke: '#fff',
    strokeWidth: 2,
    hitStrokeWidth: 24,
  })
  pivot.on('mousedown touchstart', (e) => {
    e.cancelBubble = true
    group.stopDrag()
  })
  pivot.on('click tap', (e) => {
    e.cancelBubble = true
    const next = active === 'out_a' ? 'out_b' : 'out_a'
    setValveFlow(node.id, next)
  })

  for (const portId of ['out_a', 'out_b'] as const) {
    const pt = portPointInNode(app, portId)
    const isActive = portId === active
    const hit = new Konva.Circle({
      name: `flow-target-${portId}`,
      x: pt.x,
      y: pt.y,
      radius: 16,
      fill: isActive ? 'rgba(230,162,60,0.4)' : 'rgba(0,0,0,0.02)',
      stroke: isActive ? '#E6A23C' : '#909399',
      strokeWidth: isActive ? 2 : 1,
      dash: isActive ? undefined : [4, 3],
      hitStrokeWidth: 28,
    })
    hit.on('mousedown touchstart', (e) => {
      e.cancelBubble = true
      group.stopDrag()
    })
    hit.on('click tap', (e) => {
      e.cancelBubble = true
      setValveFlow(node.id, portId)
    })
    const label = new Konva.Text({
      name: `flow-label-${portId}`,
      x: pt.x - 6,
      y: pt.y - 5,
      text: portId === 'out_a' ? 'A' : 'B',
      fontSize: 11,
      fontStyle: 'bold',
      fill: isActive ? '#E6A23C' : '#909399',
      listening: false,
    })
    pointer.add(hit)
    pointer.add(label)
  }

  pointer.add(shaft)
  pointer.add(pivot)
  group.add(pointer)
}

function redraw() {
  if (!layer || isDragging) return
  layer.destroyChildren()
  nodeGroups.clear()
  edgePipes.clear()
  edgeHeatLines.clear()

  const flowStates = demo.animating ? computeFlowEdgeStates(design.document) : null

  for (const edge of design.document.edges) {
    const a = portAbs(edge.from.nodeId, edge.from.port)
    const b = portAbs(edge.to.nodeId, edge.to.port)
    const selected = design.selectedEdgeId === edge.id
    const flowDimmed = !!(flowStates && !flowStates.get(edge.id)?.active)
    const visual = createPipeVisual(edge.id, a, b, selected, edge.line.odMm, flowDimmed)
    edgePipes.set(edge.id, visual)
    layer.add(visual.group)

    if (edge.line.traceHeated) {
      const offset = pipeOuterWidth(edge.line.odMm) / 2 + 6
      const heat = new Konva.Line({
        points: [a.x, a.y - offset, b.x, b.y - offset],
        stroke: '#F56C6C',
        strokeWidth: 3,
        dash: [8, 5],
        lineCap: 'round',
        listening: false,
      })
      edgeHeatLines.set(edge.id, heat)
      layer.add(heat)
    }
  }

  if (demo.animating) rebuildFlowDots()

  for (const node of design.document.nodes) {
    const def = catalog.getByType(node.type)
    const cat = def?.category ?? ''
    const color = symbolColor(cat)
    const stroke = '#606266'
    const selected = design.isNodeSelected(node.id)
    const app = nodeAppearance(node)

    const group = new Konva.Group({
      x: node.x,
      y: node.y,
      draggable: true,
      name: `node-${node.id}`,
      dragDistance: 4,
    })

    drawSymbolBody(group, node, app, color, stroke, selected)
    for (const port of app.ports) {
      group.add(createPort(group, node, port, app))
    }
    if (node.type === 'three_way_valve') {
      addThreeWayValvePointer(group, node, app)
      for (const port of app.ports) {
        group.findOne(`.port-${port.id}`)?.moveToTop()
      }
    }

    group.on('dragstart', (e) => {
      if ((e.target.name() || '').startsWith('port-')) {
        group.stopDrag()
        return
      }
      isDragging = true
      if (!design.isNodeSelected(node.id)) {
        design.selectNode(node.id, false)
      }
      design.selectedEdgeId = null
      dragLeaderId = node.id
      dragLeaderStart = { x: group.x(), y: group.y() }
      multiDragStarts = {}
      for (const id of design.selectedNodeIds) {
        const n = design.document.nodes.find((x) => x.id === id)
        if (n) multiDragStarts[id] = { x: n.x, y: n.y }
      }
      group.moveToTop()
      for (const id of design.selectedNodeIds) {
        nodeGroups.get(id)?.moveToTop()
      }
      layer?.batchDraw()
    })

    group.on('dragmove', () => {
      const leader = dragLeaderId ? nodeGroups.get(dragLeaderId) : null
      if (!leader || !dragLeaderId) {
        updateEdgesForNodes([node.id])
        return
      }
      const dx = leader.x() - dragLeaderStart.x
      const dy = leader.y() - dragLeaderStart.y
      for (const id of design.selectedNodeIds) {
        if (id === dragLeaderId) continue
        const start = multiDragStarts[id]
        const g = nodeGroups.get(id)
        if (start && g) {
          g.position({ x: start.x + dx, y: start.y + dy })
        }
      }
      updateEdgesForNodes([...design.selectedNodeIds])
    })

    group.on('dragend', () => {
      for (const id of design.selectedNodeIds) {
        const g = nodeGroups.get(id)
        if (!g) continue
        const x = Math.round(g.x())
        const y = Math.round(g.y())
        g.position({ x, y })
        design.moveNode(id, x, y)
      }
      updateEdgesForNodes([...design.selectedNodeIds])
      design.commitMove()
      dragLeaderId = null
      multiDragStarts = {}
      isDragging = false
      layer?.batchDraw()
    })

    group.on('click tap', (e) => {
      const tname = e.target.name() || ''
      if (tname.startsWith('port-') || tname.startsWith('flow-')) return
      e.cancelBubble = true
      if (e.evt.shiftKey) {
        design.selectNode(node.id, true)
      } else if (!design.isNodeSelected(node.id)) {
        design.selectNode(node.id, false)
      }
      design.selectedEdgeId = null
      if (!isDragging) {
        nodeGroups.forEach((_, id) => updateNodeStroke(id))
        layer?.batchDraw()
      }
    })

    nodeGroups.set(node.id, group)
    layer.add(group)
    attachNodeImage(group, node, selected)
  }

  layer.draw()
  highlightPorts()
  if (design.connectFrom) updateConnectPreview()
  if (demo.animating) rebuildFlowDots()
}

/** 从浏览器拖放事件换算画布坐标（getPointerPosition 在 drop 时往往仍是旧值） */
function pointerFromDrop(e: DragEvent): { x: number; y: number } | null {
  if (!stage || !containerRef.value) return null
  stage.setPointersPositions(e)
  let pos = stage.getPointerPosition()
  if (pos) return pos
  const box = containerRef.value.getBoundingClientRect()
  const scaleX = stage.width() / box.width
  const scaleY = stage.height() / box.height
  return {
    x: (e.clientX - box.left) * scaleX,
    y: (e.clientY - box.top) * scaleY,
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = demo.animating ? 'none' : 'copy'
  }
  stage?.setPointersPositions(e)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  if (demo.animating) {
    ElMessage.warning(locale.t('demo.designLocked'))
    return
  }
  const type = e.dataTransfer?.getData('componentType')
  if (!type || !stage) return
  const pos = pointerFromDrop(e)
  if (!pos) return
  const def = catalog.getByType(type)
  const app = resolveNodeAppearance(
    { id: '', type, x: 0, y: 0, params: {} },
    design.document,
    def ?? undefined,
  )
  design.addNode(type, Math.round(pos.x - app.width / 2), Math.round(pos.y - app.height / 2))
  redraw()
}

function finishMarquee(addToSelection: boolean) {
  if (!selectRect || !selectStartWorld) return
  const x = selectRect.x()
  const y = selectRect.y()
  const w = selectRect.width()
  const h = selectRect.height()
  const ids =
    w > 4 && h > 4
      ? design.document.nodes
          .filter((n) => {
            const app = nodeAppearance(n)
            return rectsIntersect(x, y, w, h, n.x, n.y, app.width, app.height + 14)
          })
          .map((n) => n.id)
      : []
  if (ids.length) {
    if (addToSelection) {
      design.selectNodes([...new Set([...design.selectedNodeIds, ...ids])])
    } else {
      design.selectNodes(ids)
    }
  } else if (!addToSelection) {
    design.clearNodeSelection()
  }
  selectRect.destroy()
  selectRect = null
  selectStartWorld = null
  isMarquee = false
  suppressBackgroundClick = true
  redraw()
}

function onStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
  if (suppressBackgroundClick) {
    suppressBackgroundClick = false
    return
  }
  const target = e.target
  const name = target.name() || ''
  if (name.startsWith('edge-')) {
    design.selectedEdgeId = name.replace('edge-', '')
    design.clearNodeSelection()
    design.connectFrom = null
    clearConnectPreview()
    redraw()
    return
  }
  const nodeGroup = target.findAncestor((n: Konva.Node) => (n.name() || '').startsWith('node-'), true)
  if (nodeGroup) return

  design.clearNodeSelection()
  design.selectedEdgeId = null
  design.connectFrom = null
  clearConnectPreview()
  redraw()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !(e.target as HTMLElement).matches('input, textarea')) {
    e.preventDefault()
    spacePressed = true
    setPanCursor(true)
  }
  if (e.key === 'Escape') {
    if (design.connectFrom) {
      design.connectFrom = null
      clearConnectPreview()
      highlightPorts()
    }
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spacePressed = false
    endPan()
    setPanCursor(false)
  }
}

function exportSnapshot() {
  if (!stage) return ''
  const url = stage.toDataURL({ pixelRatio: 2 })
  emit('snapshot', url)
  return url
}

defineExpose({ exportSnapshot, redraw, zoomFitNodes })

onMounted(() => {
  if (!containerRef.value) return
  stage = new Konva.Stage({
    container: containerRef.value,
    width: props.width,
    height: props.height,
  })
  gridLayer = new Konva.Layer({ listening: false })
  layer = new Konva.Layer()
  flowLayer = new Konva.Layer({ listening: false })
  uiLayer = new Konva.Layer({ listening: false })
  stage.add(gridLayer)
  stage.add(layer)
  stage.add(flowLayer)
  stage.add(uiLayer)
  drawGrid()
  stage.on('click tap', onStageClick)
  stage.on('wheel', onWheel)
  stage.on('mousedown', (e) => {
    const evt = e.evt
    const wantPan =
      evt.button === 1 ||
      (spacePressed && evt.button === 0 && isStageBackground(e.target))
    if (wantPan) {
      startPan()
      return
    }
    if (evt.button === 0 && !spacePressed && isStageBackground(e.target)) {
      const w = pointerWorld()
      if (!w || !layer) return
      isMarquee = true
      selectStartWorld = w
      selectRect = new Konva.Rect({
        x: w.x,
        y: w.y,
        width: 0,
        height: 0,
        fill: 'rgba(64, 158, 255, 0.15)',
        stroke: '#409EFF',
        strokeWidth: 1,
        dash: [6, 4],
        listening: false,
        name: 'marquee',
      })
      layer.add(selectRect)
      selectRect.moveToTop()
    }
  })
  stage.on('mousemove', () => {
    if (design.connectFrom) updateConnectPreview()
    if (isMarquee && selectStartWorld && selectRect) {
      const w = pointerWorld()
      if (!w) return
      const x = Math.min(selectStartWorld.x, w.x)
      const y = Math.min(selectStartWorld.y, w.y)
      const width = Math.abs(w.x - selectStartWorld.x)
      const height = Math.abs(w.y - selectStartWorld.y)
      selectRect.position({ x, y })
      selectRect.size({ width, height })
      layer?.batchDraw()
    }
  })
  stage.on('mouseup', (e) => {
    if (isPanning) endPan()
    if (isMarquee) finishMarquee(e.evt.shiftKey)
  })
  stage.on('mouseleave', () => {
    if (isPanning) endPan()
    if (isMarquee) finishMarquee(false)
  })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  redraw()
  nextTick(() => zoomFitNodes())
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  stopFlowAnimation()
  clearConnectPreview()
  nodeGroups.clear()
  edgePipes.clear()
  edgeHeatLines.clear()
  stage?.destroy()
})

watch(
  () => design.document.nodes.length,
  () => {
    if (!isDragging) redraw()
  },
)

watch(
  () => design.historyIndex,
  () => {
    if (!isDragging) redraw()
  },
)

watch(
  () => design.document.edges,
  () => {
    if (!isDragging) redraw()
  },
  { deep: true },
)

watch(
  () => design.connectFrom,
  () => {
    if (!isDragging) {
      highlightPorts()
      if (design.connectFrom) updateConnectPreview()
      else clearConnectPreview()
    }
  },
)

watch(
  () => [props.width, props.height],
  () => {
    stage?.width(props.width)
    stage?.height(props.height)
    drawGrid()
    redraw()
  },
)

watch(
  () => design.selectedNodeIds,
  () => {
    if (!isDragging) {
      nodeGroups.forEach((_, id) => updateNodeStroke(id))
      layer?.batchDraw()
    }
  },
  { deep: true },
)

watch(
  () => design.fitViewTick,
  () => {
    nextTick(() => zoomFitNodes())
  },
)

watch(
  () => demo.animating,
  (v) => {
    if (v) {
      if (design.connectFrom) {
        design.connectFrom = null
        clearConnectPreview()
      }
      startFlowAnimation()
    } else {
      stopFlowAnimation()
    }
    if (!isDragging) {
      highlightPorts()
      redraw()
    }
  },
)

watch(
  () => design.imageRevision,
  () => {
    if (!isDragging) redraw()
  },
)

watch(
  () => design.document.componentLayouts,
  () => {
    if (!isDragging) redraw()
  },
  { deep: true },
)

watch(
  () => locale.locale,
  () => {
    if (!isDragging) redraw()
  },
)

watch(
  () => design.document.edges.length,
  () => {
    if (demo.animating) rebuildFlowDots()
  },
)

watch(
  () =>
    design.document.nodes
      .map((n) => `${n.id}:${n.type}:${JSON.stringify(n.params)}`)
      .join('|'),
  () => {
    if (isDragging) return
    if (demo.animating) rebuildFlowDots()
    redraw()
  },
)
</script>

<template>
  <div class="canvas-wrap-outer">
    <p v-if="connectHint" class="connect-hint">{{ connectHint }}</p>
    <div class="canvas-area">
      <div
        ref="containerRef"
        class="canvas"
        :class="{ 'flow-locked': demo.animating }"
        @dragover="onDragOver"
        @drop="onDrop"
      />
      <div class="zoom-bar">
        <el-button-group size="small">
          <el-button @click="zoomOut">−</el-button>
          <el-button disabled class="zoom-label">{{ zoomPercent }}%</el-button>
          <el-button @click="zoomIn">+</el-button>
        </el-button-group>
        <el-button size="small" @click="zoomFit">{{ locale.t('canvas.zoomFit') }}</el-button>
        <el-button size="small" @click="zoomReset">{{ locale.t('canvas.zoomReset') }}</el-button>
      </div>
    </div>
    <div class="legend">
      <span><i class="dot in" />蓝色 = 入口</span>
      <span><i class="dot out" />绿色 = 出口</span>
      <span>框选多选 · Shift 加减选 · 多选后可一起拖动 · 滚轮缩放 · 空格平移</span>
      <span class="world-size">画板 {{ WORLD_W }}×{{ WORLD_H }}</span>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrap-outer {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.canvas-area {
  position: relative;
  flex: 1;
  min-height: 0;
}
.zoom-bar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.zoom-label {
  min-width: 52px !important;
  padding: 0 4px !important;
}
.world-size {
  margin-left: auto;
  color: #909399;
}
.connect-hint {
  margin: 0;
  padding: 6px 12px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
  border-bottom: 1px solid #d9ecff;
}
.canvas {
  flex: 1;
  width: 100%;
  min-height: 0;
  background: #fff;
}
.canvas.flow-locked {
  outline: 2px dashed #e6a23c;
  outline-offset: -2px;
}
.legend {
  display: flex;
  gap: 16px;
  padding: 6px 12px;
  font-size: 11px;
  color: #606266;
  background: #fafafa;
  border-top: 1px solid #ebeef5;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.dot.in {
  background: #409eff;
}
.dot.out {
  background: #67c23a;
}
</style>
