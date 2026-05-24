"""PDF export via ReportLab."""

from __future__ import annotations

import base64
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.design_doc import DesignDocument


def _register_font() -> str:
    try:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        return "STSong-Light"
    except Exception:
        return "Helvetica"


def generate_pdf(
    design: DesignDocument,
    snapshot_base64: str | None = None,
    simulation_summary: dict | None = None,
) -> bytes:
    buf = io.BytesIO()
    font = _register_font()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleCN",
        parent=styles["Title"],
        fontName=font,
        fontSize=18,
    )
    body_style = ParagraphStyle(
        "BodyCN",
        parent=styles["Normal"],
        fontName=font,
        fontSize=10,
    )

    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm)
    story: list = []

    meta = design.projectMeta
    story.append(Paragraph("预处理箱 (SCS) 设计报告", title_style))
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"方案名称: {meta.name}", body_style))
    story.append(Paragraph(f"工艺介质: {meta.service}", body_style))
    story.append(Paragraph(f"防爆: {meta.protection} | 区域: {meta.hazardArea}", body_style))
    story.append(
        Paragraph(
            f"机柜: {meta.enclosure.wMm}×{meta.enclosure.hMm}×{meta.enclosure.dMm} mm, "
            f"{meta.enclosure.material}",
            body_style,
        )
    )
    story.append(Paragraph(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}", body_style))
    story.append(Spacer(1, 12))

    if snapshot_base64:
        try:
            raw = snapshot_base64.split(",", 1)[-1]
            img_data = base64.b64decode(raw)
            img = Image(io.BytesIO(img_data), width=160 * mm, height=90 * mm)
            story.append(Paragraph("P&ID 流程图", body_style))
            story.append(img)
            story.append(Spacer(1, 12))
        except Exception:
            pass

    if simulation_summary:
        story.append(Paragraph("仿真摘要", body_style))
        rows = [["指标", "值"]]
        for k, v in simulation_summary.items():
            rows.append([str(k), str(v)])
        t = Table(rows, colWidths=[80 * mm, 80 * mm])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTNAME", (0, 0), (-1, -1), font),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 12))

    story.append(Paragraph("组件清单", body_style))
    comp_rows = [["类型", "ID", "关键参数"]]
    for n in design.nodes:
        comp_rows.append([n.type, n.id[:8], str(n.params)[:80]])
    ct = Table(comp_rows, colWidths=[45 * mm, 30 * mm, 95 * mm])
    ct.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(ct)
    story.append(Spacer(1, 12))

    story.append(Paragraph("工程计算说明 (附录)", body_style))
    story.append(
        Paragraph(
            "滞后时间 t ≈ Σ(V_holdup / Q_eff)，V 为管段与组件滞留体积 (mL)，Q 为有效流量 (L/h)。"
            "压降为各组件 dP 与管段阻力之和的简化累加。本报告仅供方案评审，详细设计须按项目规范复核。",
            body_style,
        )
    )

    doc.build(story)
    return buf.getvalue()
