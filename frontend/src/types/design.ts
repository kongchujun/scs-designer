export type HazardArea = 'safe' | 'zone1' | 'zone2'
export type Protection = 'none' | 'Ex_d' | 'Ex_p' | 'purged'
export type NodeStatus = 'ok' | 'warn' | 'alarm'

export interface ProjectMeta {
  name: string
  service: string
  hazardArea: HazardArea
  protection: Protection
  enclosure: {
    wMm: number
    hMm: number
    dMm: number
    material: '316SS' | 'Hastelloy' | 'PTFE_lined'
  }
  corrosiveService?: boolean
}

/** 按组件 type 保存的外观定制（尺寸、端口位置、默认图） */
export interface ComponentLayoutConfig {
  width: number
  height: number
  ports: Array<{
    id: string
    direction: 'in' | 'out'
    x: number
    y: number
    label?: string
  }>
  imageUrl?: string | null
}

export interface DesignNode {
  id: string
  type: string
  x: number
  y: number
  rotation?: number
  params: Record<string, unknown>
}

export interface PortRef {
  nodeId: string
  port: string
}

export interface EdgeLine {
  odMm?: number
  lengthM: number
  traceHeated: boolean
  insulation: boolean
  material: string
}

export interface DesignEdge {
  id: string
  from: PortRef
  to: PortRef
  line: EdgeLine
}

export interface SimulationDefaults {
  flowLph: number
  pressureBar: number
  temperatureC: number
}

export interface DesignDocument {
  schemaVersion: '1.0'
  projectMeta: ProjectMeta
  nodes: DesignNode[]
  edges: DesignEdge[]
  simulationDefaults?: SimulationDefaults
  /** 按组件 type 绑定上传的图像 URL（兼容旧数据） */
  componentImages?: Record<string, string>
  /** 按组件 type 定制：受限尺寸、端口位置、示意图 */
  componentLayouts?: Record<string, ComponentLayoutConfig>
}

export interface ComponentDef {
  id: number
  type: string
  label: string
  label_en: string
  category: string
  symbol_uri: string | null
  param_schema_json: Record<string, unknown>
  defaults_json: Record<string, unknown>
  ports_json: Record<string, string[]>
  engineering_notes_zh: string | null
}

export interface NodeSimulationResult {
  nodeId: string
  pressureBar: number
  temperatureC: number
  flowLph: number
  lagContributionS: number
  status: NodeStatus
  message?: string | null
}

export interface SimulationResponse {
  totalLagS: number
  totalPressureDropBar: number
  outletTemperatureC: number
  effectiveFlowLph: number
  nodes: NodeSimulationResult[]
  alarms: string[]
}

export interface ValidationIssue {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}

export interface ValidationResponse {
  issues: ValidationIssue[]
  deadLegs: string[]
  checklist: Array<{ item: string; value: string; ok: boolean }>
}

export function emptyDesign(name = '未命名方案'): DesignDocument {
  return {
    schemaVersion: '1.0',
    projectMeta: {
      name,
      service: '天然气',
      hazardArea: 'zone1',
      protection: 'Ex_d',
      corrosiveService: false,
      enclosure: { wMm: 800, hMm: 2000, dMm: 600, material: '316SS' },
    },
    nodes: [],
    edges: [],
    simulationDefaults: { flowLph: 2, pressureBar: 2, temperatureC: 40 },
    componentImages: {},
    componentLayouts: {},
  }
}
