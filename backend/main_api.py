import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import UPLOADS_DIR, PROJECT_ROOT, STATIC_DIR
from backend.database import init_db
from backend.routes import router

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ingeap.main_api")

app = FastAPI(
    title="Ingeap - Sistema de Inventario y Viajes Multiproyecto",
    description="API para control de retiros, retornos, asignación multiproyecto y remitos",
    version="1.0.0"
)

# Configuración de CORS total para acceso desde Android (Capacitor) y red LAN
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Base de Datos SQLite
@app.on_event("startup")
def startup_event():
    logger.info("Inicializando servicios y base de datos SQLite...")
    init_db()

# Montar carpeta de subidas (firmas generadas)
app.mount("/api/uploads/firmas", StaticFiles(directory=str(UPLOADS_DIR)), name="firmas")

# Incluir rutas de negocio
app.include_router(router)

# Si existe la compilación de frontend (dist), servirla
dist_dir = STATIC_DIR
if dist_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(dist_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = dist_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_dir / "index.html")
else:
    @app.get("/")
    async def root_status():
        return {
            "name": "Ingeap - Sistema de Gestión de Inventario y Viajes Multiproyecto",
            "status": "ONLINE",
            "api_docs": "/docs",
            "frontend": "Modo desarrollo o no compilado aún"
        }
