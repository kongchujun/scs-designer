from typing import Any, Literal

from pydantic import BaseModel, Field


class EnclosureMeta(BaseModel):
    wMm: float = 800
    hMm: float = 2000
    dMm: float = 600
    material: Literal["316SS", "Hastelloy", "PTFE_lined"] = "316SS"


class ProjectMeta(BaseModel):
    name: str = "未命名方案"
    service: str = "天然气"
    hazardArea: Literal["safe", "zone1", "zone2"] = "zone1"
    protection: Literal["none", "Ex_d", "Ex_p", "purged"] = "Ex_d"
    enclosure: EnclosureMeta = Field(default_factory=EnclosureMeta)
    corrosiveService: bool = False


class DesignNode(BaseModel):
    id: str
    type: str
    x: float
    y: float
    rotation: float = 0
    params: dict[str, Any] = Field(default_factory=dict)


class PortRef(BaseModel):
    nodeId: str
    port: str = "out"


class EdgeLine(BaseModel):
    odMm: float = 6.0
    lengthM: float = 1.0
    traceHeated: bool = False
    insulation: bool = True
    material: str = "316SS"


class DesignEdge(BaseModel):
    id: str
    from_: PortRef = Field(alias="from")
    to: PortRef
    line: EdgeLine = Field(default_factory=EdgeLine)

    model_config = {"populate_by_name": True}


class SimulationDefaults(BaseModel):
    flowLph: float = 2.0
    pressureBar: float = 2.0
    temperatureC: float = 40.0


class DesignDocument(BaseModel):
    schemaVersion: Literal["1.0"] = "1.0"
    projectMeta: ProjectMeta = Field(default_factory=ProjectMeta)
    nodes: list[DesignNode] = Field(default_factory=list)
    edges: list[DesignEdge] = Field(default_factory=list)
    simulationDefaults: SimulationDefaults = Field(default_factory=SimulationDefaults)
    # 按组件 type 配置的自定义图像 URL（上传后返回的路径）
    componentImages: dict[str, str] = Field(default_factory=dict)
    # 按 type 定制尺寸、端口位置、示意图
    componentLayouts: dict[str, Any] = Field(default_factory=dict)


class SimulationSetpoints(BaseModel):
    flowLph: float = 2.0
    pressureBar: float = 2.0
    temperatureC: float = 40.0


class SimulationRequest(BaseModel):
    design: DesignDocument
    setpoints: SimulationSetpoints = Field(default_factory=SimulationSetpoints)


class NodeSimulationResult(BaseModel):
    nodeId: str
    pressureBar: float
    temperatureC: float
    flowLph: float
    lagContributionS: float
    status: Literal["ok", "warn", "alarm"] = "ok"
    message: str | None = None


class SimulationResponse(BaseModel):
    totalLagS: float
    totalPressureDropBar: float
    outletTemperatureC: float
    effectiveFlowLph: float
    nodes: list[NodeSimulationResult]
    alarms: list[str] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    level: Literal["info", "warning", "error"]
    code: str
    message: str
    nodeIds: list[str] = Field(default_factory=list)
    edgeIds: list[str] = Field(default_factory=list)


class ValidationResponse(BaseModel):
    issues: list[ValidationIssue]
    deadLegs: list[str] = Field(default_factory=list)
    checklist: list[dict[str, Any]] = Field(default_factory=list)
