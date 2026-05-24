from fastapi import APIRouter

from app.schemas.api import ValidationRequest
from app.schemas.design_doc import ValidationResponse
from app.services.validation import validate_design

router = APIRouter()


@router.post("/check", response_model=ValidationResponse)
async def validation_check(body: ValidationRequest) -> ValidationResponse:
    return validate_design(body.design)
