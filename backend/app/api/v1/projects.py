from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.schemas.api import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter()


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)) -> list[Project]:
    result = await db.execute(select(Project).order_by(Project.id.desc()))
    return list(result.scalars().all())


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)) -> Project:
    project = Project(name=body.name, description=body.description, meta_json=body.meta_json)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int, body: ProjectUpdate, db: AsyncSession = Depends(get_db)
) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.meta_json is not None:
        project.meta_json = body.meta_json
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)) -> None:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    await db.delete(project)
    await db.commit()
