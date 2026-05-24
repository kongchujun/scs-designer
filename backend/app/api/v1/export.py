from fastapi import APIRouter
from fastapi.responses import Response

from app.schemas.api import ExportPdfRequest
from app.services.export_pdf import generate_pdf

router = APIRouter()


@router.post("/pdf")
async def export_pdf(body: ExportPdfRequest) -> Response:
    pdf_bytes = generate_pdf(
        body.design,
        snapshot_base64=body.snapshot_base64,
        simulation_summary=body.simulation_summary,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="scs-design-report.pdf"'},
    )
