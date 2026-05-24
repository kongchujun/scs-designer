"""Simplified engineering simulation for SCS designs."""

from __future__ import annotations

import math
from collections import defaultdict, deque

from app.schemas.design_doc import (
    DesignDocument,
    NodeSimulationResult,
    SimulationResponse,
    SimulationSetpoints,
)


def _line_volume_ml(od_mm: float, length_m: float) -> float:
    r_m = (od_mm / 1000) / 2
    vol_m3 = math.pi * r_m**2 * length_m
    return vol_m3 * 1_000_000


def _topo_order(design: DesignDocument) -> list[str]:
    adj: dict[str, list[str]] = defaultdict(list)
    indeg: dict[str, int] = defaultdict(int)
    nodes = {n.id for n in design.nodes}
    for n in nodes:
        indeg.setdefault(n, 0)
    for e in design.edges:
        if e.from_.nodeId in nodes and e.to.nodeId in nodes:
            adj[e.from_.nodeId].append(e.to.nodeId)
            indeg[e.to.nodeId] += 1
    q = deque([n for n in nodes if indeg[n] == 0])
    order: list[str] = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(order) < len(nodes):
        return [n.id for n in design.nodes]
    return order


def run_simulation(design: DesignDocument, setpoints: SimulationSetpoints) -> SimulationResponse:
    node_map = {n.id: n for n in design.nodes}
    order = _topo_order(design)
    edge_by_to: dict[str, list] = defaultdict(list)
    for e in design.edges:
        edge_by_to[e.to.nodeId].append(e)

    q_lph = setpoints.flowLph
    # limit by MFC/needle
    for n in design.nodes:
        if n.type in ("mfc", "needle_valve"):
            sp = float(n.params.get("setpointLph", q_lph))
            max_f = float(n.params.get("maxFlowLph", sp))
            q_lph = min(q_lph, sp, max_f if n.type == "mfc" else sp)
        elif n.type == "flow_rate_regulator":
            pct = float(n.params.get("flowPercent", 80)) / 100.0
            max_f = float(n.params.get("maxFlowLph", q_lph))
            q_lph = min(q_lph, max(0.05, pct) * max_f)

    p_bar = setpoints.pressureBar
    t_c = setpoints.temperatureC
    total_lag = 0.0
    total_dp = 0.0
    alarms: list[str] = []
    results: list[NodeSimulationResult] = []

    for nid in order:
        node = node_map.get(nid)
        if not node:
            continue
        params = node.params
        status = "ok"
        msg = None
        lag = 0.0

        holdup = float(params.get("holdupVolumeMl", 0))
        dp = float(params.get("dPBar", 0))

        for e in edge_by_to.get(nid, []):
            vol = _line_volume_ml(e.line.odMm, e.line.lengthM)
            holdup += vol
            if e.line.traceHeated:
                t_c = max(t_c, 45.0)

        if q_lph > 0 and holdup > 0:
            lag = (holdup / 1000) / (q_lph / 3600)  # mL -> L, L/h -> L/s

        if node.type == "pressure_regulator":
            p_bar = float(params.get("outletBar", p_bar))
            dp += float(params.get("dPBar", 0.5))
        elif node.type == "heat_exchanger":
            t_c = float(params.get("targetTempC", t_c))
        elif node.type in ("coalescing_filter", "particulate_filter"):
            alarm_dp = float(params.get("dPAlarmBar", 0.8))
            if dp >= alarm_dp:
                status = "alarm"
                msg = "过滤器压降过高，存在堵塞风险"
                alarms.append(f"{node.type}@{nid}: ΔP 报警")
        elif node.type == "analyzer_interface":
            target = float(params.get("lagTargetS", 60))
            if total_lag + lag > target:
                status = "warn"
                msg = f"累计滞后 {total_lag + lag:.1f}s 超过目标 {target}s"

        total_lag += lag
        total_dp += dp
        p_bar = max(0.1, p_bar - dp * 0.1)

        if t_c > 60:
            status = "warn" if status == "ok" else status
            alarms.append(f"温度偏高 @ {nid}: {t_c:.1f}°C")
        if p_bar < 0.5:
            status = "alarm" if status != "alarm" else status
            alarms.append(f"压力过低 @ {nid}: {p_bar:.2f} bar")

        results.append(
            NodeSimulationResult(
                nodeId=nid,
                pressureBar=round(p_bar, 3),
                temperatureC=round(t_c, 2),
                flowLph=round(q_lph, 3),
                lagContributionS=round(lag, 3),
                status=status,  # type: ignore[arg-type]
                message=msg,
            )
        )

    if total_lag > 60:
        alarms.append(f"系统总滞后 {total_lag:.1f}s 超过典型目标 60s")

    return SimulationResponse(
        totalLagS=round(total_lag, 2),
        totalPressureDropBar=round(total_dp, 3),
        outletTemperatureC=round(t_c, 2),
        effectiveFlowLph=round(q_lph, 3),
        nodes=results,
        alarms=alarms,
    )
