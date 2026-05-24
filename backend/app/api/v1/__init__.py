from fastapi import APIRouter

from app.api.v1 import components, designs, export, projects, simulation, uploads, validation

router = APIRouter()
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(designs.router, prefix="/designs", tags=["designs"])
router.include_router(components.router, prefix="/components", tags=["components"])
router.include_router(simulation.router, prefix="/simulation", tags=["simulation"])
router.include_router(validation.router, prefix="/validation", tags=["validation"])
router.include_router(export.router, prefix="/export", tags=["export"])
router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
