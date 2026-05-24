import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
ALLOWED = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_BYTES = 5 * 1024 * 1024


@router.post("/image")
async def upload_image(file: UploadFile = File(...)) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(400, "缺少文件名")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"仅支持: {', '.join(sorted(ALLOWED))}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "文件不能超过 5MB")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / name
    dest.write_bytes(data)

    return {"url": f"/api/v1/uploads/files/{name}", "filename": name}


@router.get("/files/{filename}")
async def get_uploaded_file(filename: str) -> FileResponse:
    """提供已上传图像（与上传接口返回的 URL 路径一致）"""
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "非法文件名")
    path = UPLOAD_DIR / filename
    if not path.is_file():
        raise HTTPException(404, "文件不存在")
    return FileResponse(path)
