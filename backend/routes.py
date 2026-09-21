import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.models import (
    SalidaRequest,
    RetornoRequest,
    CatalogoResponse,
    EstadoResponse,
    ElementoCreateRequest,
    ElementoUpdateRequest,
    StockMinimoRequest,
    StockUpdateRequest,
    MantenimientoRequest,
    SolicitudCreateRequest,
    SolicitudUpdateRequest,
    MovimientoCreateRequest
)
from backend.google_service import google_service
from backend.database import (
    init_db,
    get_viaje_by_id_local,
    get_viajes_activos_local,
    get_todos_los_viajes_local,
    save_stock_minimo_local
)
from backend.pdf_service import generate_remito_pdf

logger = logging.getLogger("ingeap.routes")

router = APIRouter(prefix="/api", tags=["Operaciones"])

@router.get("/estado", response_model=EstadoResponse)
def get_estado():
    """Comprueba la conexión del servidor local y el enlace con Google."""
    try:
        conn_status = google_service.check_connection()
        viajes_activos = google_service.get_viajes_activos()

        return EstadoResponse(
            estado="ONLINE",
            google_connected=conn_status.get("connected", False),
            sheets_inventario=conn_status.get("inventario_ok", False),
            sheets_roster=conn_status.get("roster_ok", False),
            local_db_ok=True,
            viajes_activos_count=len(viajes_activos),
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Error comprobando estado del servidor: {e}")
        return EstadoResponse(
            estado="DEGRADED",
            google_connected=False,
            sheets_inventario=False,
            sheets_roster=False,
            local_db_ok=True,
            viajes_activos_count=0,
            timestamp=datetime.now().isoformat()
        )

# ----------------------------------------------------------------------
# CATÁLOGO GENERAL & CRUD
# ----------------------------------------------------------------------
@router.get("/catalogos")
def get_catalogos(recargar: bool = Query(default=False, description="Forzar recarga omitiendo caché")):
    """Devuelve proyectos, usuarios, inventario consolidado (con repuestos y docs) y categorías."""
    try:
        data = google_service.get_catalogos(recargar=recargar)
        return data
    except Exception as e:
        logger.error(f"Error al obtener catálogos: {e}")
        raise HTTPException(status_code=500, detail=f"Error consultando catálogos: {str(e)}")

@router.post("/catalogos")
def crear_elemento_catalogo(payload: ElementoCreateRequest):
    """Agrega un nuevo elemento al catálogo generando un UUID individual."""
    try:
        data_dict = payload.dict()
        creado = google_service.crear_elemento(payload.categoria, data_dict)
        return {"success": True, "elemento": creado}
    except Exception as e:
        logger.error(f"Error creando elemento en catálogo: {e}")
        raise HTTPException(status_code=500, detail=f"Error al crear elemento: {str(e)}")

@router.put("/catalogos/{categoria}/{id_elemento}")
def editar_elemento_catalogo(categoria: str, id_elemento: str, payload: ElementoUpdateRequest):
    """Modifica los datos de un elemento existente del catálogo."""
    try:
        data_dict = {k: v for k, v in payload.dict().items() if v is not None}
        ok = google_service.editar_elemento(categoria, id_elemento, data_dict)
        return {"success": ok, "id_elemento": id_elemento}
    except Exception as e:
        logger.error(f"Error editando elemento {id_elemento}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al editar elemento: {str(e)}")

@router.delete("/catalogos/{categoria}/{id_elemento}")
def eliminar_elemento_catalogo(categoria: str, id_elemento: str):
    """Marca un elemento como baja en el catálogo."""
    try:
        ok = google_service.eliminar_elemento(categoria, id_elemento)
        return {"success": ok, "id_elemento": id_elemento}
    except Exception as e:
        logger.error(f"Error dando de baja elemento {id_elemento}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al dar de baja elemento: {str(e)}")

@router.post("/catalogos/mantenimiento/{id_elemento}")
def marcar_mantenimiento(id_elemento: str, payload: MantenimientoRequest):
    """Marca un elemento en mantenimiento."""
    try:
        res = google_service.marcar_mantenimiento(id_elemento, payload.tipo_mantenimiento, payload.fecha_inicio, payload.observaciones or "")
        return {"success": True, "resultado": res}
    except Exception as e:
        logger.error(f"Error marcando mantenimiento para {id_elemento}: {e}")
        raise HTTPException(status_code=500, detail=f"Error marcando mantenimiento: {str(e)}")

@router.post("/catalogos/mantenimiento-fin/{id_elemento}")
def finalizar_mantenimiento(id_elemento: str):
    """Finaliza el mantenimiento y retorna el elemento a disponible."""
    try:
        res = google_service.finalizar_mantenimiento(id_elemento)
        return {"success": True, "resultado": res}
    except Exception as e:
        logger.error(f"Error finalizando mantenimiento para {id_elemento}: {e}")
        raise HTTPException(status_code=500, detail=f"Error finalizando mantenimiento: {str(e)}")

@router.post("/catalogos/stock/{categoria}/{id_elemento}")
def actualizar_stock_directo(categoria: str, id_elemento: str, payload: StockUpdateRequest):
    """Actualiza directamente el stock actual de un elemento."""
    try:
        res = google_service.actualizar_stock_elemento(categoria, id_elemento, payload.stock_actual, payload.observaciones or "")
        return {"success": True, "resultado": res}
    except Exception as e:
        logger.error(f"Error actualizando stock para {id_elemento}: {e}")
        raise HTTPException(status_code=500, detail=f"Error actualizando stock: {str(e)}")

# ----------------------------------------------------------------------
# TABLERO DE CONTROL Y ALERTAS
# ----------------------------------------------------------------------
@router.get("/alertas")
def get_alertas_dashboard():
    """Retorna el tablero de control con alertas de vencimiento (60d/30d) y stock crítico."""
    try:
        return google_service.get_alertas_dashboard()
    except Exception as e:
        logger.error(f"Error calculando alertas: {e}")
        raise HTTPException(status_code=500, detail=f"Error calculando alertas: {str(e)}")

@router.post("/stock-minimo")
def configurar_stock_minimo(payload: StockMinimoRequest):
    """Permite al usuario definir el stock mínimo deseado para un elemento."""
    try:
        save_stock_minimo_local(payload.id_elemento, payload.stock_minimo)
        return {"success": True, "id_elemento": payload.id_elemento, "stock_minimo": payload.stock_minimo}
    except Exception as e:
        logger.error(f"Error guardando stock mínimo: {e}")
        raise HTTPException(status_code=500, detail=f"Error guardando stock mínimo: {str(e)}")

# ----------------------------------------------------------------------
# SOLICITUDES Y COMPRAS PENDIENTES
# ----------------------------------------------------------------------
@router.get("/solicitudes")
def get_solicitudes(estado: Optional[str] = Query(default=None, description="Filtro por estado (Pendiente, Aprobada, etc.)")):
    """Lista las solicitudes de compra registradas."""
    try:
        return google_service.get_solicitudes(filtro_estado=estado)
    except Exception as e:
        logger.error(f"Error consultando solicitudes: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar solicitudes: {str(e)}")

@router.post("/solicitudes")
def crear_solicitud(payload: SolicitudCreateRequest):
    """Registra una nueva solicitud de compra con UUID."""
    try:
        sol = google_service.crear_solicitud(payload.dict())
        return {"success": True, "solicitud": sol}
    except Exception as e:
        logger.error(f"Error creando solicitud de compra: {e}")
        raise HTTPException(status_code=500, detail=f"Error al crear solicitud: {str(e)}")

@router.patch("/solicitudes/{id_solicitud}")
def actualizar_solicitud(id_solicitud: str, payload: SolicitudUpdateRequest):
    """Actualiza el estado de una solicitud (Aprobada, Comprada, Descartada)."""
    try:
        ok = google_service.actualizar_solicitud(id_solicitud, payload.estado, payload.observaciones)
        return {"success": ok, "id_solicitud": id_solicitud, "estado": payload.estado}
    except Exception as e:
        logger.error(f"Error actualizando solicitud {id_solicitud}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar solicitud: {str(e)}")

# ----------------------------------------------------------------------
# MOVIMIENTOS DE STOCK (KARDEX)
# ----------------------------------------------------------------------
@router.get("/movimientos")
def get_movimientos(
    limit: int = Query(default=100, ge=1, le=500),
    filtro: Optional[str] = Query(default=None, description="Filtrar por elemento o código")
):
    """Consulta los movimientos históricos de stock."""
    try:
        return google_service.get_movimientos(limit=limit, filtro_elemento=filtro)
    except Exception as e:
        logger.error(f"Error consultando movimientos: {e}")
        raise HTTPException(status_code=500, detail=f"Error consultando movimientos: {str(e)}")

@router.post("/movimientos")
def registrar_movimiento_manual(payload: MovimientoCreateRequest):
    """Registra un movimiento manual de stock (ej. ingreso por compra de estacas, ajuste)."""
    try:
        mov = google_service.registrar_movimiento(payload.dict())
        return {"success": True, "movimiento": mov}
    except Exception as e:
        logger.error(f"Error registrando movimiento manual: {e}")
        raise HTTPException(status_code=500, detail=f"Error registrando movimiento: {str(e)}")

# ----------------------------------------------------------------------
# VIAJES (ACTIVOS, SALIDA, RETORNO, DETALLE, HISTORIAL)
# ----------------------------------------------------------------------
@router.get("/viajes/activos")
def get_viajes_activos():
    """Lista los viajes en curso para el Dashboard."""
    try:
        return google_service.get_viajes_activos()
    except Exception as e:
        logger.error(f"Error al listar viajes activos: {e}")
        return get_viajes_activos_local()

@router.get("/viajes/todos")
def get_todos_los_viajes():
    """Retorna el historial completo de viajes con desglose de ítems."""
    try:
        return google_service.get_todos_los_viajes()
    except Exception as e:
        logger.error(f"Error al listar todos los viajes: {e}")
        return get_todos_los_viajes_local()

@router.get("/viajes/{id_viaje}")
@router.get("/viajes/{id_viaje}/detalle")
def get_viaje_detalle(id_viaje: str):
    """Obtiene el desglose completo de un viaje (ítems, proyectos, firmas, lecturas)."""
    viaje = google_service.get_viaje_detalle(id_viaje)
    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return viaje

@router.post("/viajes/salida")
def registrar_salida(payload: SalidaRequest):
    """
    Registra la salida multiproyecto.
    Sube la firma a Drive y crea las filas en Sheets, SQLite y Kardex de movimientos.
    """
    try:
        id_viaje = str(uuid.uuid4())
        
        # 1. Subir firma digital
        firma_url, _ = google_service.upload_signature(
            base64_str=payload.firma_s_base64,
            filename_prefix=f"salida_{id_viaje[:8]}"
        )

        # 2. Obtener denominaciones de proyectos seleccionados
        catalogos = google_service.get_catalogos(recargar=False)
        proyectos_map = {str(p["id_proyecto"]): p.get("denominacion", "") for p in catalogos.get("proyectos", [])}
        
        proyectos_asignados = []
        for p_id in payload.proyectos_ids:
            denom = proyectos_map.get(str(p_id), f"Proyecto #{p_id}")
            proyectos_asignados.append({
                "id_proyecto": str(p_id),
                "denominacion": denom
            })

        # 3. Registrar filas y egresos
        items_dict = [it.dict() for it in payload.items]
        filas = google_service.registrar_salida(
            id_viaje=id_viaje,
            proyectos=proyectos_asignados,
            items=items_dict,
            user_s=payload.user_s,
            firma_s=firma_url,
            fecha_s=payload.fecha_s
        )

        return {
            "success": True,
            "message": "Salida de viaje registrada exitosamente",
            "id_viaje": id_viaje,
            "filas_registradas": len(filas),
            "firma_url": firma_url
        }
    except Exception as e:
        logger.error(f"Error registrando salida de viaje: {e}")
        raise HTTPException(status_code=500, detail=f"Error al registrar salida: {str(e)}")

@router.put("/viajes/{id_viaje}/items")
def editar_items_salida(id_viaje: str, payload: Dict[str, Any]):
    """
    Modifica los elementos asignados a una salida activa.
    Actualiza SQLite, Google Sheets y Kardex.
    """
    try:
        items = payload.get("items", [])
        user_s = payload.get("user_s")
        res = google_service.editar_salida(id_viaje=id_viaje, items=items, user_s=user_s)
        return res
    except Exception as e:
        logger.error(f"Error editando salida {id_viaje}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/viajes/retorno")
def registrar_retorno(payload: RetornoRequest):
    """
    Registra la devolución, valida el prorrateo de costos (exacto al 100%) y asienta reingreso en Kardex.
    """
    try:
        suma_porcentajes = sum(p.porcentaje for p in payload.prorrateo)
        if abs(suma_porcentajes - 100.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de los porcentajes de prorrateo debe ser exactamente 100.0%. Suma recibida: {suma_porcentajes:.2f}%"
            )

        firma_url, _ = google_service.upload_signature(
            base64_str=payload.firma_r_base64,
            filename_prefix=f"retorno_{payload.id_viaje[:8]}"
        )

        items_retorno_dict = [it.dict() for it in payload.items]
        prorrateo_dict = [p.dict() for p in payload.prorrateo]

        filas_actualizadas = google_service.registrar_retorno(
            id_viaje=payload.id_viaje,
            items_retorno=items_retorno_dict,
            prorrateos=prorrateo_dict,
            user_r=payload.user_r,
            firma_r=firma_url,
            fecha_r=payload.fecha_r
        )

        return {
            "success": True,
            "message": "Devolución registrada exitosamente",
            "id_viaje": payload.id_viaje,
            "filas_actualizadas": len(filas_actualizadas),
            "firma_url": firma_url
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registrando retorno: {e}")
        raise HTTPException(status_code=500, detail=f"Error al registrar retorno: {str(e)}")

@router.get("/viajes/{id_viaje}/pdf")
def descargar_remito_pdf(id_viaje: str):
    """Compila y entrega el remito en PDF con firmas estampadas listo para descargar o imprimir."""
    try:
        viaje = google_service.get_viaje_detalle(id_viaje)
        if not viaje:
            raise HTTPException(status_code=404, detail="No se encontraron datos para el viaje solicitado")

        pdf_path = generate_remito_pdf(viaje)
        
        filename = f"Remito_Ingeap_{id_viaje[:8]}.pdf"
        return FileResponse(
            path=pdf_path,
            filename=filename,
            media_type="application/pdf"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generando PDF para viaje {id_viaje}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
