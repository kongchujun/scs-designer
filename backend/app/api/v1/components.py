from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.component import ComponentDefinition
from app.schemas.api import ComponentOut

router = APIRouter()


@router.get("", response_model=list[ComponentOut])
async def list_components(db: AsyncSession = Depends(get_db)) -> list[ComponentDefinition]:
    result = await db.execute(
        select(ComponentDefinition).order_by(ComponentDefinition.category, ComponentDefinition.id)
    )
    return list(result.scalars().all())
