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
    unidad_medida: Optional[str] = Field(default="", description="km, dias de uso, ciclos de bateria, cantidad")
    modo_costeo: Optional[str] = Field(default="", description="Modo de costeo configurado")

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
    modo_costeo: Optional[str] = ""
    en_mantenimiento: Optional[bool] = False
    tipo_mantenimiento: Optional[str] = ""
    fecha_inicio_mantenimiento: Optional[str] = ""
    fecha_fin_mantenimiento: Optional[str] = ""
    stock_actual: Optional[float] = 0.0
    stock_minimo: Optional[float] = 0.0

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

class ElementoCreateRequest(BaseModel):
    categoria: str
    nombre: str
    codigo_interno: Optional[str] = ""
    marca: Optional[str] = ""
    modelo: Optional[str] = ""
    numero_serie: Optional[str] = ""
    tipo: Optional[str] = ""
    subcategoria: Optional[str] = ""
    patente: Optional[str] = ""
    stock_minimo: Optional[float] = 0.0
    stock_actual: Optional[float] = 0.0
    modo_costeo: Optional[str] = ""
    en_mantenimiento: Optional[bool] = False
    tipo_mantenimiento: Optional[str] = ""
    fecha_inicio_mantenimiento: Optional[str] = ""
    fecha_fin_mantenimiento: Optional[str] = ""
    elementos_compatibles_ids: Optional[List[str]] = []
    url_carpeta: Optional[str] = ""
    observaciones: Optional[str] = ""

class ElementoUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    codigo_interno: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    tipo: Optional[str] = None
    subcategoria: Optional[str] = None
    patente: Optional[str] = None
    stock_minimo: Optional[float] = None
    stock_actual: Optional[float] = None
    modo_costeo: Optional[str] = None
    en_mantenimiento: Optional[bool] = None
    tipo_mantenimiento: Optional[str] = None
    fecha_inicio_mantenimiento: Optional[str] = None
    fecha_fin_mantenimiento: Optional[str] = None
    elementos_compatibles_ids: Optional[List[str]] = None
    url_carpeta: Optional[str] = None
    observaciones: Optional[str] = None

class StockMinimoRequest(BaseModel):
    id_elemento: str
    stock_minimo: float

class StockUpdateRequest(BaseModel):
    stock_actual: float
    observaciones: Optional[str] = ""

class MantenimientoRequest(BaseModel):
    tipo_mantenimiento: str
    fecha_inicio: Optional[str] = ""
    observaciones: Optional[str] = ""

class SolicitudCreateRequest(BaseModel):
    elemento: str
    categoria: Optional[str] = ""
    cantidad: float = 1.0
    solicitante: str
    prioridad: str = "Media"
    id_proyecto: Optional[str] = ""
    proyecto: Optional[str] = ""
    observaciones: Optional[str] = ""

class SolicitudUpdateRequest(BaseModel):
    estado: str
    observaciones: Optional[str] = None

class MovimientoCreateRequest(BaseModel):
    tipo_movimiento: str
    id_elemento: Optional[str] = ""
    categoria: Optional[str] = ""
    elemento: str
    codigo_interno: Optional[str] = ""
    cantidad: float
    id_viaje: Optional[str] = ""
    proyecto: Optional[str] = ""
    usuario: str
    observaciones: Optional[str] = ""


