import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.models import (
    SalidaRequest,
    RetornoRequest,
    CatalogoResponse,
    EstadoResponse
)
from backend.google_service import google_service
from backend.database import (
    init_db,
    get_viaje_by_id_local,
    get_viajes_activos_local
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

@router.get("/catalogos", response_model=CatalogoResponse)
def get_catalogos(recargar: bool = Query(default=False, description="Forzar recarga omitiendo caché")):
    """Devuelve proyectos, usuarios, inventario consolidado y categorías."""
    try:
        data = google_service.get_catalogos(recargar=recargar)
        return CatalogoResponse(**data)
    except Exception as e:
        logger.error(f"Error al obtener catálogos: {e}")
        raise HTTPException(status_code=500, detail=f"Error consultando catálogos: {str(e)}")

@router.get("/viajes/activos")
def get_viajes_activos():
    """Lista los viajes en curso para el Dashboard."""
    try:
        return google_service.get_viajes_activos()
    except Exception as e:
        logger.error(f"Error al listar viajes activos: {e}")
        return get_viajes_activos_local()

@router.get("/viajes/{id_viaje}")
def get_viaje_detalle(id_viaje: str):
    """Obtiene el detalle completo de un viaje por su ID."""
    viaje = get_viaje_by_id_local(id_viaje)
    if not viaje:
        # Intentar buscar entre activos
        activos = google_service.get_viajes_activos()
        for a in activos:
            if a.get("id_viaje") == id_viaje:
                return a
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return viaje

@router.post("/viajes/salida")
def registrar_salida(payload: SalidaRequest):
    """
    Registra la salida multiproyecto.
    Sube la firma a Drive y crea las filas correspondientes en Sheets y SQLite local.
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

        # 3. Registrar filas
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

@router.post("/viajes/retorno")
def registrar_retorno(payload: RetornoRequest):
    """
    Registra la devolución, valida el prorrateo de costos (exacto al 100%) y actualiza Sheets/SQLite.
    """
    try:
        # Validación estricta del 100% de prorrateo
        suma_porcentajes = sum(p.porcentaje for p in payload.prorrateo)
        if abs(suma_porcentajes - 100.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de los porcentajes de prorrateo debe ser exactamente 100.0%. Suma recibida: {suma_porcentajes:.2f}%"
            )

        # 1. Subir firma digital de retorno
        firma_url, _ = google_service.upload_signature(
            base64_str=payload.firma_r_base64,
            filename_prefix=f"retorno_{payload.id_viaje[:8]}"
        )

        # 2. Registrar retorno y prorrateo
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
        viaje = get_viaje_by_id_local(id_viaje)
        if not viaje:
            # Buscar en memoria o remotos
            activos = google_service.get_viajes_activos()
            for a in activos:
                if a.get("id_viaje") == id_viaje:
                    viaje = a
                    break

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
