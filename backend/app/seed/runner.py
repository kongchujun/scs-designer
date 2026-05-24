from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.component import ComponentDefinition
from app.seed.components import COMPONENT_SEED


async def seed_components(session: AsyncSession) -> None:
    result = await session.execute(select(ComponentDefinition))
    existing = {row.type: row for row in result.scalars().all()}
    added = False
    for row in COMPONENT_SEED:
        if row["type"] in existing:
            continue
        session.add(ComponentDefinition(**row))
        added = True
    if added:
        await session.commit()
