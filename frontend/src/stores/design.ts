import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { designsApi } from '@/api/client'
import { useCatalogStore } from '@/stores/catalog'
import type { ComponentLayoutConfig, DesignDocument, DesignEdge, DesignNode } from '@/types/design'
import { emptyDesign } from '@/types/design'
import { primaryInPort, primaryOutPort } from '@/utils/componentAppearance'
import { builtinSymbolImage, isBuiltinComponentType } from '@/utils/builtinComponents'
import { clearImageCache } from '@/utils/imageLoader'

const MAX_HISTORY = 40
/** 无定制时的参考尺寸（居中拖放） */
export const NODE_W = 100
export const NODE_H = 64

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export const useDesignStore = defineStore('design', () => {
  const document = ref<DesignDocument>(emptyDesign())
  const designId = ref<number | null>(null)
  const designName = ref('未命名方案')
  /** 多选列表 */
  const selectedNodeIds = ref<string[]>([])
  /** 兼容属性面板：多选时取第一个 */
  const selectedNodeId = computed({
    get: () => selectedNodeIds.value[0] ?? null,
    set: (id: string | null) => {
      selectedNodeIds.value = id ? [id] : []
    },
  })
  const selectedEdgeId = ref<string | null>(null)
  const connectFrom = ref<{ nodeId: string; port: string } | null>(null)
  const dirty = ref(false)
  const history = ref<DesignDocument[]>([])
  const historyIndex = ref(-1)
  const imageRevision = ref(0)
  /** 递增后画布自动缩放到所有部件居中 */
  const fitViewTick = ref(0)

  const selectedNode = computed(() =>
    document.value.nodes.find((n) => n.id === selectedNodeId.value) ?? null,
  )

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  const selectedCount = computed(() => selectedNodeIds.value.length)

  function snapshotsEqual(a: DesignDocument, b: DesignDocument) {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  function isNodeSelected(nodeId: string) {
    return selectedNodeIds.value.includes(nodeId)
  }

  function requestFitView() {
    fitViewTick.value += 1
  }

  function selectNodes(ids: string[]) {
    selectedNodeIds.value = [...new Set(ids)]
    selectedEdgeId.value = null
  }

  function selectNode(nodeId: string, additive = false) {
    if (additive) {
      if (isNodeSelected(nodeId)) {
        selectedNodeIds.value = selectedNodeIds.value.filter((id) => id !== nodeId)
      } else {
        selectedNodeIds.value = [...selectedNodeIds.value, nodeId]
      }
    } else {
      selectedNodeIds.value = [nodeId]
    }
    selectedEdgeId.value = null
  }

  function clearNodeSelection() {
    selectedNodeIds.value = []
  }

  function pushHistory() {
    const snap = clone(document.value)
    const current = history.value[historyIndex.value]
    if (current && snapshotsEqual(current, snap)) return
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(snap)
    if (history.value.length > MAX_HISTORY) history.value.shift()
    historyIndex.value = history.value.length - 1
  }

  function initHistory() {
    history.value = [clone(document.value)]
    historyIndex.value = 0
  }

  function undo() {
    if (historyIndex.value <= 0) return
    historyIndex.value -= 1
    document.value = clone(history.value[historyIndex.value])
    clearNodeSelection()
    dirty.value = true
  }

  function redo() {
    if (historyIndex.value >= history.value.length - 1) return
    historyIndex.value += 1
    document.value = clone(history.value[historyIndex.value])
    clearNodeSelection()
    dirty.value = true
  }

  function markDirty() {
    dirty.value = true
    pushHistory()
  }

  function loadDocument(doc: DesignDocument, id?: number, name?: string) {
    document.value = doc
    if (!document.value.componentImages) document.value.componentImages = {}
    if (!document.value.componentLayouts) document.value.componentLayouts = {}
    designId.value = id ?? null
    designName.value = name ?? doc.projectMeta.name
    clearNodeSelection()
    selectedEdgeId.value = null
    dirty.value = false
    initHistory()
    requestFitView()
  }

  function resolveNodeImageUrl(node: DesignNode): string | null {
    if (isBuiltinComponentType(node.type)) return builtinSymbolImage(node.type)
    const custom = node.params.customImageUrl
    if (typeof custom === 'string' && custom.length > 0) return custom
    return document.value.componentImages?.[node.type] ?? null
  }

  function setComponentImage(type: string, url: string | null) {
    if (!document.value.componentImages) document.value.componentImages = {}
    if (url) document.value.componentImages[type] = url
    else delete document.value.componentImages[type]
    const layout = document.value.componentLayouts?.[type]
    if (layout) layout.imageUrl = url
    clearImageCache()
    imageRevision.value += 1
    markDirty()
  }

  function setComponentLayout(type: string, layout: ComponentLayoutConfig) {
    if (!document.value.componentLayouts) document.value.componentLayouts = {}
    document.value.componentLayouts[type] = layout
    if (layout.imageUrl) {
      if (!document.value.componentImages) document.value.componentImages = {}
      document.value.componentImages[type] = layout.imageUrl
    }
    clearImageCache()
    imageRevision.value += 1
    markDirty()
  }

  function setNodeAppearanceSize(nodeId: string, width: number, height: number) {
    const n = document.value.nodes.find((x) => x.id === nodeId)
    if (!n) return
    n.params = { ...n.params, appearanceWidth: width, appearanceHeight: height }
    markDirty()
  }

  function resetNodeAppearance(nodeId: string) {
    const n = document.value.nodes.find((x) => x.id === nodeId)
    if (!n) return
    const next = { ...n.params }
    delete next.appearanceWidth
    delete next.appearanceHeight
    delete next.portOverrides
    n.params = next
    markDirty()
  }

  function setNodeCustomImage(nodeId: string, url: string | null) {
    const n = document.value.nodes.find((x) => x.id === nodeId)
    if (!n) return
    const next = { ...n.params }
    if (url) next.customImageUrl = url
    else delete next.customImageUrl
    n.params = next
    clearImageCache()
    imageRevision.value += 1
    markDirty()
  }

  async function save() {
    if (!designId.value) return
    await designsApi.update(designId.value, {
      name: designName.value,
      config_json: document.value,
    })
    dirty.value = false
  }

  function addNode(type: string, x: number, y: number) {
    const catalog = useCatalogStore()
    const def = catalog.getByType(type)
    const node: DesignNode = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      params: { ...(def?.defaults_json ?? {}) },
    }
    document.value.nodes.push(node)
    selectNodes([node.id])
    markDirty()
  }

  function removeSelected() {
    if (selectedNodeIds.value.length > 0) {
      const remove = new Set(selectedNodeIds.value)
      document.value.nodes = document.value.nodes.filter((n) => !remove.has(n.id))
      document.value.edges = document.value.edges.filter(
        (e) => !remove.has(e.from.nodeId) && !remove.has(e.to.nodeId),
      )
      clearNodeSelection()
      markDirty()
      requestFitView()
    } else if (selectedEdgeId.value) {
      document.value.edges = document.value.edges.filter((e) => e.id !== selectedEdgeId.value)
      selectedEdgeId.value = null
      markDirty()
    }
  }

  function updateNodeParams(nodeId: string, params: Record<string, unknown>) {
    const n = document.value.nodes.find((x) => x.id === nodeId)
    if (n) {
      n.params = params
      markDirty()
    }
  }

  function patchNodeParams(nodeId: string, patch: Record<string, unknown>) {
    const n = document.value.nodes.find((x) => x.id === nodeId)
    if (n) {
      n.params = { ...n.params, ...patch }
      markDirty()
    }
  }

  function moveNode(nodeId: string, x: number, y: number) {
    const n = document.value.nodes.find((x) => x.id === nodeId)
    if (n) {
      n.x = x
      n.y = y
      dirty.value = true
    }
  }

  function commitMove() {
    const current = history.value[historyIndex.value]
    if (current && snapshotsEqual(current, document.value)) return
    pushHistory()
  }

  function startConnect(nodeId: string, port: string) {
    connectFrom.value = { nodeId, port }
  }

  function finishConnect(toNodeId: string, toPort: string) {
    if (!connectFrom.value || connectFrom.value.nodeId === toNodeId) {
      connectFrom.value = null
      return
    }
    const edge: DesignEdge = {
      id: crypto.randomUUID(),
      from: { nodeId: connectFrom.value.nodeId, port: connectFrom.value.port },
      to: { nodeId: toNodeId, port: toPort },
      line: { odMm: 6, lengthM: 1, traceHeated: false, insulation: true, material: '316SS' },
    }
    document.value.edges.push(edge)
    connectFrom.value = null
    markDirty()
  }

  function insertDemoChain() {
    const chain = [
      'sample_probe',
      'sample_line',
      'pressure_regulator',
      'coalescing_filter',
      'particulate_filter',
      'knockout_pot',
      'heat_exchanger',
      'flow_meter',
      'mfc',
      'analyzer_interface',
      'vent_bpr',
    ]
    const catalog = useCatalogStore()
    document.value.nodes = []
    document.value.edges = []
    let x = 80
    const y = 200
    const ids: string[] = []
    for (const type of chain) {
      const def = catalog.getByType(type)
      const id = crypto.randomUUID()
      ids.push(id)
      document.value.nodes.push({
        id,
        type,
        x,
        y,
        params: { ...(def?.defaults_json ?? {}) },
      })
      x += 140
    }
    for (let i = 0; i < ids.length - 1; i++) {
      const fromType = document.value.nodes.find((n) => n.id === ids[i])?.type
      const toType = document.value.nodes.find((n) => n.id === ids[i + 1])?.type
      document.value.edges.push({
        id: crypto.randomUUID(),
        from: {
          nodeId: ids[i],
          port: primaryOutPort(catalog.getByType(fromType ?? '') ?? undefined),
        },
        to: {
          nodeId: ids[i + 1],
          port: primaryInPort(catalog.getByType(toType ?? '') ?? undefined),
        },
        line: { odMm: 6, lengthM: 1.5, traceHeated: i === 1, insulation: true, material: '316SS' },
      })
    }
    selectNodes(ids)
    markDirty()
    requestFitView()
  }

  return {
    document,
    designId,
    designName,
    selectedNodeIds,
    selectedNodeId,
    selectedEdgeId,
    selectedNode,
    selectedCount,
    connectFrom,
    dirty,
    fitViewTick,
    loadDocument,
    save,
    addNode,
    removeSelected,
    updateNodeParams,
    patchNodeParams,
    moveNode,
    commitMove,
    startConnect,
    finishConnect,
    insertDemoChain,
    undo,
    redo,
    canUndo,
    canRedo,
    markDirty,
    historyIndex,
    resolveNodeImageUrl,
    setComponentImage,
    setComponentLayout,
    setNodeAppearanceSize,
    resetNodeAppearance,
    setNodeCustomImage,
    imageRevision,
    isNodeSelected,
    selectNode,
    selectNodes,
    clearNodeSelection,
    requestFitView,
    NODE_W,
    NODE_H,
  }
})
