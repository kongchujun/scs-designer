from fastapi import APIRouter

from app.schemas.design_doc import SimulationRequest, SimulationResponse
from app.services.simulation import run_simulation

router = APIRouter()


@router.post("/run", response_model=SimulationResponse)
async def simulation_run(body: SimulationRequest) -> SimulationResponse:
    return run_simulation(body.design, body.setpoints)
