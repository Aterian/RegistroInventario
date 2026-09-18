from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ItemSalidaDTO(BaseModel):
    id: str
    categoria: str
    codigo_interno: Optional[str] = ""
    nombre: str
    numero_serie: Optional[str] = ""
    unidad_s: float = Field(default=0.0, description="Unidad inicial (odómetro o cantidad)")
    costo_u: float = Field(default=0.0, description="Costo unitario de uso")

class SalidaRequest(BaseModel):
    proyectos_ids: List[str] = Field(min_length=1, description="Lista de IDs de proyectos asignados")
    items: List[ItemSalidaDTO] = Field(min_length=1, description="Lista de ítems de inventario retirados")
    user_s: str = Field(description="Nombre o ID del usuario que retira")
    firma_s_base64: str = Field(description="Imagen PNG de la firma en formato Base64")
    fecha_s: Optional[str] = Field(default=None, description="Fecha y hora de salida (YYYY-MM-DD HH:MM:SS)")

class ItemRetornoDTO(BaseModel):
    id_gasto: Optional[str] = None
    elemento: Optional[str] = ""
    unidad_r: float = Field(default=0.0, description="Unidad final al retorno")

class ProyectoProrrateoDTO(BaseModel):
    id_proyecto: str
    porcentaje: float = Field(ge=0.0, le=100.0, description="Porcentaje de asignación (0-100)")

class RetornoRequest(BaseModel):
    id_viaje: str = Field(description="UUID compartido del viaje")
    items: List[ItemRetornoDTO] = Field(min_length=1, description="Lecturas finales por ítem")
    prorrateo: List[ProyectoProrrateoDTO] = Field(min_length=1, description="Prorrateo de proyectos (suma exacta 100%)")
    user_r: str = Field(description="Nombre o ID del usuario que recibe")
    firma_r_base64: str = Field(description="Imagen PNG de la firma de retorno en Base64")
    fecha_r: Optional[str] = Field(default=None, description="Fecha y hora de retorno (YYYY-MM-DD HH:MM:SS)")

class CatalogoItemUnified(BaseModel):
    id: str
    categoria: str
    codigo_interno: Optional[str] = ""
    nombre: str
    numero_serie: Optional[str] = ""
    imagen: Optional[str] = ""

class CatalogoResponse(BaseModel):
    proyectos: List[Dict[str, Any]]
    usuarios: List[Dict[str, Any]]
    inventario: List[CatalogoItemUnified]
    categorias: List[str]
    origen: str = "google_sheets"
    timestamp: str

class EstadoResponse(BaseModel):
    estado: str
    google_connected: bool
    sheets_inventario: bool
    sheets_roster: bool
    local_db_ok: bool
    viajes_activos_count: int
    timestamp: str
