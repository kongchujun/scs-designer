from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.design import Design
from app.models.project import Project
from app.schemas.api import DesignCreate, DesignOut, DesignUpdate
from app.schemas.design_doc import DesignDocument

router = APIRouter()


def _default_config() -> dict[str, Any]:
    return DesignDocument().model_dump(by_alias=True)


def _normalize_config(raw: DesignDocument | dict[str, Any] | None) -> dict[str, Any]:
    if raw is None:
        return _default_config()
    if isinstance(raw, DesignDocument):
        return raw.model_dump(by_alias=True)
    return raw


@router.get("", response_model=list[DesignOut])
async def list_designs(
    project_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[Design]:
    q = select(Design).order_by(Design.updated_at.desc())
    if project_id is not None:
        q = q.where(Design.project_id == project_id)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.post("", response_model=DesignOut, status_code=201)
async def create_design(body: DesignCreate, db: AsyncSession = Depends(get_db)) -> Design:
    project = await db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    design = Design(
        project_id=body.project_id,
        name=body.name,
        config_json=_normalize_config(body.config_json),
    )
    db.add(design)
    await db.commit()
    await db.refresh(design)
    return design


@router.get("/{design_id}", response_model=DesignOut)
async def get_design(design_id: int, db: AsyncSession = Depends(get_db)) -> Design:
    design = await db.get(Design, design_id)
    if not design:
        raise HTTPException(404, "方案不存在")
    return design


@router.patch("/{design_id}", response_model=DesignOut)
async def update_design(
    design_id: int, body: DesignUpdate, db: AsyncSession = Depends(get_db)
) -> Design:
    design = await db.get(Design, design_id)
    if not design:
        raise HTTPException(404, "方案不存在")
    if body.name is not None:
        design.name = body.name
    if body.config_json is not None:
        design.config_json = _normalize_config(body.config_json)
    if body.thumbnail is not None:
        design.thumbnail = body.thumbnail
    await db.commit()
    await db.refresh(design)
    return design


@router.delete("/{design_id}", status_code=204)
async def delete_design(design_id: int, db: AsyncSession = Depends(get_db)) -> None:
    design = await db.get(Design, design_id)
    if not design:
        raise HTTPException(404, "方案不存在")
    await db.delete(design)
    await db.commit()
