"""Design validation: dead legs, materials, Ex protection checklist."""

from __future__ import annotations

from collections import defaultdict

from app.schemas.design_doc import DesignDocument, ValidationIssue, ValidationResponse


def validate_design(design: DesignDocument) -> ValidationResponse:
    issues: list[ValidationIssue] = []
    dead_legs: list[str] = []

    nodes = {n.id: n for n in design.nodes}
    out_edges: dict[str, list] = defaultdict(list)
    in_edges: dict[str, list] = defaultdict(list)
    for e in design.edges:
        out_edges[e.from_.nodeId].append(e)
        in_edges[e.to.nodeId].append(e)

    for nid, node in nodes.items():
        has_in = nid in in_edges or node.type == "sample_probe"
        has_out = nid in out_edges or node.type in ("vent_bpr", "analyzer_interface")
        if has_in and not has_out and node.type not in ("vent_bpr",):
            dead_legs.append(nid)
            issues.append(
                ValidationIssue(
                    level="warning",
                    code="DEAD_LEG",
                    message=f"组件「{node.type}」可能存在死腿或无出口支路",
                    nodeIds=[nid],
                )
            )

        if node.type == "sample_probe" and not node.params.get("doubleBlockBleed", False):
            issues.append(
                ValidationIssue(
                    level="warning",
                    code="DBB_MISSING",
                    message="取样探头未配置双重隔离+泄放 (DBB)",
                    nodeIds=[nid],
                )
            )

        if node.type == "bypass_loop" and nid not in in_edges:
            issues.append(
                ValidationIssue(
                    level="error",
                    code="BYPASS_UNCONNECTED",
                    message="快速旁路未接入主Process流路",
                    nodeIds=[nid],
                )
            )

    meta = design.projectMeta
    if meta.corrosiveService:
        for nid, node in nodes.items():
            mat = str(node.params.get("material", "316SS"))
            if mat == "316SS" and node.type in (
                "sample_probe",
                "sample_line",
                "pressure_regulator",
            ):
                issues.append(
                    ValidationIssue(
                        level="warning",
                        code="MATERIAL_CORROSION",
                        message=f"腐蚀性介质建议使用 Hastelloy 或 PTFE 衬里，当前为 {mat}",
                        nodeIds=[nid],
                    )
                )

    if meta.protection == "purged":
        has_cal = any(n.type == "cal_gas_inlet" for n in design.nodes)
        if not has_cal:
            issues.append(
                ValidationIssue(
                    level="error",
                    code="PURGE_NO_CAL",
                    message="吹扫保护 (purged) 需配置标气接入路径",
                )
            )

    checklist = [
        {
            "item": "防爆型式",
            "value": meta.protection,
            "ok": meta.protection != "none" or meta.hazardArea == "safe",
        },
        {
            "item": "危险区域",
            "value": meta.hazardArea,
            "ok": True,
        },
        {
            "item": "机柜材质",
            "value": meta.enclosure.material,
            "ok": True,
        },
        {
            "item": "双重隔离 (取样点)",
            "value": "已配置" if not any(i.code == "DBB_MISSING" for i in issues) else "缺失",
            "ok": not any(i.code == "DBB_MISSING" for i in issues),
        },
        {
            "item": "死腿检测",
            "value": f"{len(dead_legs)} 处",
            "ok": len(dead_legs) == 0,
        },
        {
            "item": "检修通道",
            "value": "≥600mm",
            "ok": meta.enclosure.wMm >= 600,
        },
    ]

    return ValidationResponse(issues=issues, deadLegs=dead_legs, checklist=checklist)
