import type { DesignDocument, DesignEdge, DesignNode } from '@/types/design'

export interface FlowEdgeState {
  active: boolean
  /** 相对基准气泡数量的倍率（流速调节器下游会 < 1） */
  dotScale: number
}

function edgesFromNode(edges: DesignEdge[], nodeId: string): DesignEdge[] {
  return edges.filter((e) => e.from.nodeId === nodeId)
}

function sourceNodeIds(doc: DesignDocument): string[] {
  const hasIncoming = new Set(doc.edges.map((e) => e.to.nodeId))
  const ids = doc.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id)
  return ids.length ? ids : doc.nodes.map((n) => n.id)
}

function valveActiveOut(node: DesignNode): string {
  return node.params.activeOut === 'out_b' ? 'out_b' : 'out_a'
}

function regulatorScale(node: DesignNode): number {
  const pct = Number(node.params.flowPercent ?? 80)
  return Math.max(0.08, Math.min(1, pct / 100))
}

/**
 * 演示流动：从入口向前传播，三通阀只走选中出口，三通接管一分二，流速调节器缩小下游气泡密度。
 */
export function computeFlowEdgeStates(doc: DesignDocument): Map<string, FlowEdgeState> {
  const result = new Map<string, FlowEdgeState>()
  for (const e of doc.edges) {
    result.set(e.id, { active: false, dotScale: 1 })
  }
  if (!doc.edges.length) return result

  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]))
  const queue = sourceNodeIds(doc)
  const visited = new Set<string>()

  while (queue.length) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (!node) continue

    let outScale = 1
    if (node.type === 'flow_rate_regulator') {
      outScale = regulatorScale(node)
    }

    let nextEdges = edgesFromNode(doc.edges, nodeId)
    if (node.type === 'three_way_valve') {
      const active = valveActiveOut(node)
      nextEdges = nextEdges.filter((e) => e.from.port === active)
    }

    for (const edge of nextEdges) {
      const prev = result.get(edge.id)!
      result.set(edge.id, {
        active: true,
        dotScale: Math.min(prev.dotScale, outScale),
      })
      const targetId = edge.to.nodeId
      if (!visited.has(targetId)) queue.push(targetId)
    }
  }

  return result
}

export function flowDotsForEdge(
  baseCount: number,
  state: FlowEdgeState | undefined,
): number {
  if (!state?.active) return 0
  return Math.max(1, Math.round(baseCount * state.dotScale))
}
