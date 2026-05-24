from sqlalchemy import String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class ComponentDefinition(Base):
    __tablename__ = "component_definitions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    label_en: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol_uri: Mapped[str | None] = mapped_column(String(255), nullable=True)
    param_schema_json: Mapped[dict] = mapped_column(JSON().with_variant(SQLiteJSON, "sqlite"), nullable=False)
    defaults_json: Mapped[dict] = mapped_column(JSON().with_variant(SQLiteJSON, "sqlite"), nullable=False)
    ports_json: Mapped[dict] = mapped_column(JSON().with_variant(SQLiteJSON, "sqlite"), nullable=False, default=dict)
    engineering_notes_zh: Mapped[str | None] = mapped_column(Text, nullable=True)
