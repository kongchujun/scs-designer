from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.design_doc import DesignDocument


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    meta_json: dict[str, Any] | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    meta_json: dict[str, Any] | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    meta_json: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DesignCreate(BaseModel):
    project_id: int
    name: str
    config_json: DesignDocument | dict[str, Any] | None = None


class DesignUpdate(BaseModel):
    name: str | None = None
    config_json: DesignDocument | dict[str, Any] | None = None
    thumbnail: str | None = None


class DesignOut(BaseModel):
    id: int
    project_id: int
    name: str
    config_json: dict[str, Any]
    thumbnail: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComponentOut(BaseModel):
    id: int
    type: str
    label: str
    label_en: str
    category: str
    symbol_uri: str | None
    param_schema_json: dict[str, Any]
    defaults_json: dict[str, Any]
    ports_json: dict[str, Any]
    engineering_notes_zh: str | None

    model_config = {"from_attributes": True}


class ValidationRequest(BaseModel):
    design: DesignDocument


class ExportPdfRequest(BaseModel):
    design: DesignDocument
    snapshot_base64: str | None = None
    simulation_summary: dict[str, Any] | None = None
