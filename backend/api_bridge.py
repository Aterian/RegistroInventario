import os
import sys
import json
import uuid
import logging
import subprocess
import urllib.request
from datetime import datetime
from typing import Dict, Any, Optional, List

from backend.config import (
    cargar_configuracion,
    guardar_configuracion,
    extraer_spreadsheet_id,
    PDFS_DIR
)
from backend.google_service import google_service
from backend.database import (
    init_db,
    get_viaje_by_id_local,
    get_viajes_activos_local,
    get_todos_los_viajes_local,
    save_stock_minimo_local,
    obtener_sesion_activa,
    guardar_sesion_activa,
    borrar_sesion,
    obtener_avatar_por_dni
)
from backend.pdf_service import generate_remito_pdf

logger = logging.getLogger("ingeap.api_bridge")
APP_VERSION = "1.3.1"


class ApiBridge:
    """
    Puente nativo de comunicación entre el frontend React y el backend Python
    expuesto a través de window.pywebview.api.
    Reemplaza la necesidad de ejecutar un servidor local HTTP en escritorio.
    """

    def __init__(self, ventana=None):
        self._ventana = ventana

    def set_ventana(self, ventana):
        self._ventana = ventana

    # ------------------------------------------------------------------
    # ESTADO Y CONECTIVIDAD
    # ------------------------------------------------------------------
    def get_estado(self) -> Dict[str, Any]:
        """Comprueba el estado del sistema, base de datos y Google Cloud."""
        try:
            conn_status = google_service.check_connection()
            viajes_activos = google_service.get_viajes_activos()
            return {
                "estado": "ONLINE",
                "google_connected": conn_status.get("connected", False),
                "sheets_inventario": conn_status.get("inventario_ok", False),
                "sheets_roster": conn_status.get("roster_ok", False),
                "drive_connected": conn_status.get("drive_ok", False),
                "local_db_ok": True,
                "viajes_activos_count": len(viajes_activos),
                "app_version": APP_VERSION,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_estado: {e}")
            return {
                "estado": "DEGRADED",
                "google_connected": False,
                "sheets_inventario": False,
                "sheets_roster": False,
                "drive_connected": False,
                "local_db_ok": True,
                "viajes_activos_count": 0,
                "app_version": APP_VERSION,
                "timestamp": datetime.now().isoformat()
            }

    # ------------------------------------------------------------------
    # CATÁLOGOS Y CRUD DE ELEMENTOS
    # ------------------------------------------------------------------
    def get_catalogos(self, recargar: bool = False) -> Dict[str, Any]:
        """Retorna catálogos unificados, proyectos y personal."""
        try:
            return google_service.get_catalogos(recargar=recargar)
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_catalogos: {e}")
            return {"proyectos": [], "usuarios": [], "inventario": [], "categorias": [], "error": str(e)}

    def crear_elemento(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Agrega un nuevo elemento al catálogo."""
        try:
            categoria = data.get("categoria", "Materiales")
            creado = google_service.crear_elemento(categoria, data)
            return {"success": True, "elemento": creado}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en crear_elemento: {e}")
            return {"success": False, "error": str(e)}

    def editar_elemento(self, categoria: str, id_elemento: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Modifica los atributos de un elemento."""
        try:
            ok = google_service.editar_elemento(categoria, id_elemento, data)
            return {"success": ok, "id_elemento": id_elemento}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en editar_elemento: {e}")
            return {"success": False, "error": str(e)}

    def eliminar_elemento(self, categoria: str, id_elemento: str) -> Dict[str, Any]:
        """Da de baja un elemento del inventario."""
        try:
            ok = google_service.eliminar_elemento(categoria, id_elemento)
            return {"success": ok, "id_elemento": id_elemento}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en eliminar_elemento: {e}")
            return {"success": False, "error": str(e)}

    def marcar_mantenimiento(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Marca un elemento como En Mantenimiento."""
        try:
            id_elem = data.get("id_elemento")
            tipo_m = data.get("tipo_mantenimiento", "Preventivo")
            fecha_ini = data.get("fecha_inicio")
            obs = data.get("observaciones", "")
            res = google_service.marcar_mantenimiento(id_elem, tipo_m, fecha_ini, obs)
            return {"success": True, "resultado": res}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en marcar_mantenimiento: {e}")
            return {"success": False, "error": str(e)}

    def finalizar_mantenimiento(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Finaliza el mantenimiento registrando la fecha de fin y retornando a inventario."""
        try:
            id_elem = data.get("id_elemento")
            res = google_service.finalizar_mantenimiento(id_elem)
            return {"success": True, "resultado": res}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en finalizar_mantenimiento: {e}")
            return {"success": False, "error": str(e)}

    def actualizar_stock(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Actualiza el stock actual de un elemento directamente."""
        try:
            cat = data.get("categoria", "Materiales")
            id_elem = data.get("id_elemento")
            stk = float(data.get("nuevo_stock", data.get("stock_actual", 0)))
            obs = data.get("observaciones", "")
            res = google_service.actualizar_stock_elemento(cat, id_elem, stk, obs)
            return {"success": True, "resultado": res}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en actualizar_stock: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------

    # TABLERO DE ALERTAS Y STOCK MÍNIMO
    # ------------------------------------------------------------------
    def get_alertas(self) -> Dict[str, Any]:
        """Calcula el tablero de vencimientos de documentos y faltantes de stock."""
        try:
            return google_service.get_alertas_dashboard()
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_alertas: {e}")
            return {"total_alertas": 0, "documentos": [], "stock": []}

    def set_stock_minimo(self, id_elemento: str, stock_minimo: float) -> Dict[str, Any]:
        """Define o actualiza el umbral de stock mínimo para un artículo."""
        try:
            save_stock_minimo_local(id_elemento, float(stock_minimo))
            if google_service._memory_cache.get("data"):
                google_service._memory_cache["data"] = None
            return {"success": True, "id_elemento": id_elemento, "stock_minimo": stock_minimo}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en set_stock_minimo: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # SOLICITUDES DE COMPRAS
    # ------------------------------------------------------------------
    def get_solicitudes(self, estado: Optional[str] = None) -> List[Dict[str, Any]]:
        """Recupera la lista de solicitudes de compra."""
        try:
            return google_service.get_solicitudes(estado)
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_solicitudes: {e}")
            return []

    def crear_solicitud(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nueva solicitud de compra."""
        try:
            sol = google_service.crear_solicitud(data)
            return {"success": True, "solicitud": sol}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en crear_solicitud: {e}")
            return {"success": False, "error": str(e)}

    def actualizar_solicitud(self, id_solicitud: str, estado: str, observaciones: Optional[str] = None) -> Dict[str, Any]:
        """Modifica el estado de una solicitud (Aprobada, Comprada, Descartada)."""
        try:
            ok = google_service.actualizar_solicitud(id_solicitud, estado, observaciones)
            return {"success": ok, "id_solicitud": id_solicitud}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en actualizar_solicitud: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # MOVIMIENTOS DE STOCK (KARDEX)
    # ------------------------------------------------------------------
    def get_movimientos(self, limit: int = 100, filtro: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retorna el historial de movimientos de inventario."""
        try:
            return google_service.get_movimientos(limit=limit, filtro_elemento=filtro)
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_movimientos: {e}")
            return []

    def registrar_movimiento(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Asienta un movimiento manual en el Kardex."""
        try:
            mov = google_service.registrar_movimiento(data)
            return {"success": True, "movimiento": mov}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en registrar_movimiento: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # VIAJES: SALIDA, RETORNO, HISTORIAL Y DETALLES
    # ------------------------------------------------------------------
    def get_viajes_activos(self) -> List[Dict[str, Any]]:
        """Retorna todos los viajes actualmente en terreno."""
        try:
            return google_service.get_viajes_activos()
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_viajes_activos: {e}")
            return get_viajes_activos_local()

    def get_todos_los_viajes(self) -> List[Dict[str, Any]]:
        """Retorna el historial completo de viajes."""
        try:
            return get_todos_los_viajes_local()
        except Exception as e:
            logger.error(f"[ApiBridge] Error en get_todos_los_viajes: {e}")
            return []

    def get_viaje_detalle(self, id_viaje: str) -> Dict[str, Any]:
        """Obtiene la información y desglose de un viaje."""
        viaje = get_viaje_by_id_local(id_viaje)
        if not viaje:
            return {"success": False, "error": "Viaje no encontrado"}
        return {"success": True, "viaje": viaje}

    def registrar_salida(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa el despacho de salida de inventario."""
        try:
            id_viaje = data.get("id_viaje") or str(uuid.uuid4())
            proyectos = data.get("proyectos", [])
            items = data.get("items", [])
            user_s = data.get("user_s", "")
            firma_b64 = data.get("firma_s", "")
            fecha_s = data.get("fecha_s")

            # Procesar firma
            firma_link, _ = google_service.upload_signature(firma_b64, f"salida_{id_viaje[:8]}")

            filas = google_service.registrar_salida(
                id_viaje=id_viaje,
                proyectos=proyectos,
                items=items,
                user_s=user_s,
                firma_s=firma_link,
                fecha_s=fecha_s
            )
            return {"success": True, "id_viaje": id_viaje, "filas_creadas": len(filas)}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en registrar_salida: {e}")
            return {"success": False, "error": str(e)}

    def editar_salida(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Modifica los elementos asignados a una salida activa."""
        try:
            id_viaje = data.get("id_viaje")
            items = data.get("items", [])
            user_s = data.get("user_s")
            return google_service.editar_salida(id_viaje=id_viaje, items=items, user_s=user_s)
        except Exception as e:
            logger.error(f"[ApiBridge] Error en editar_salida: {e}")
            return {"success": False, "error": str(e)}

    def registrar_retorno(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa la devolución de inventario y prorrateo de costos."""
        try:
            id_viaje = data.get("id_viaje")
            items_retorno = data.get("items", [])
            prorrateos = data.get("prorrateos", [])
            user_r = data.get("user_r", "")
            firma_b64 = data.get("firma_r", "")
            fecha_r = data.get("fecha_r")

            firma_link, _ = google_service.upload_signature(firma_b64, f"retorno_{id_viaje[:8]}")

            filas = google_service.registrar_retorno(
                id_viaje=id_viaje,
                items_retorno=items_retorno,
                prorrateos=prorrateos,
                user_r=user_r,
                firma_r=firma_link,
                fecha_r=fecha_r
            )
            return {"success": True, "id_viaje": id_viaje, "filas_actualizadas": len(filas)}
        except Exception as e:
            logger.error(f"[ApiBridge] Error en registrar_retorno: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # GENERACIÓN Y VISUALIZACIÓN DE REMITO PDF
    # ------------------------------------------------------------------
    def generar_remito_pdf(self, id_viaje: str) -> Dict[str, Any]:
        """Genera el remito oficial en PDF con firmas estampadas."""
        try:
            viaje = get_viaje_by_id_local(id_viaje)
            if not viaje:
                return {"success": False, "error": "Viaje no encontrado para generar PDF"}
            pdf_path = generate_remito_pdf(viaje)
            return {"success": True, "pdf_path": str(pdf_path), "id_viaje": id_viaje}
        except Exception as e:
            logger.error(f"[ApiBridge] Error generando PDF: {e}")
            return {"success": False, "error": str(e)}

    def abrir_remito_pdf(self, id_viaje: str) -> Dict[str, Any]:
        """Abre el archivo PDF generado en el visor predeterminado del sistema operativo."""
        try:
            viaje = get_viaje_by_id_local(id_viaje)
            if not viaje:
                return {"success": False, "error": "Viaje no encontrado"}
            pdf_path = generate_remito_pdf(viaje)
            if os.path.exists(pdf_path):
                if sys.platform == "win32":
                    os.startfile(pdf_path)
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", pdf_path])
                else:
                    subprocess.Popen(["xdg-open", pdf_path])
                return {"success": True}
            return {"success": False, "error": "El archivo PDF no pudo crearse"}
        except Exception as e:
            logger.error(f"[ApiBridge] Error abriendo PDF: {e}")
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # SESIÓN Y PERFIL (Persistencia local estilo ReporteDiario)
    # ------------------------------------------------------------------
    def obtener_estado_sesion(self) -> Dict[str, Any]:
        """Recupera la sesión activa actual."""
        sesion = obtener_sesion_activa()
        if sesion:
            return {"logueado": True, "usuario": sesion}
        return {"logueado": False, "usuario": None}

    def iniciar_sesion(self, nombre: str, dni: str) -> Dict[str, Any]:
        """Guarda la sesión activa del usuario."""
        try:
            nom = nombre.strip()
            d = dni.strip()
            avatar = obtener_avatar_por_dni(d)
            guardar_sesion_activa(nombre=nom, dni=d, avatar=avatar)
            return {"exito": True, "usuario": {"nombre": nom, "dni": d, "avatar": avatar}}
        except Exception as e:
            return {"exito": False, "error": str(e)}

    def cerrar_sesion(self) -> Dict[str, Any]:
        """Cierra la sesión activa actual."""
        borrar_sesion()
        return {"exito": True}

    def guardar_avatar(self, avatar_base64: str) -> Dict[str, Any]:
        """Actualiza la imagen de perfil en Base64."""
        try:
            sesion = obtener_sesion_activa()
            if sesion:
                guardar_sesion_activa(
                    nombre=sesion.get("nombre", ""),
                    dni=sesion.get("dni", ""),
                    mail=sesion.get("mail", ""),
                    avatar=avatar_base64,
                    area=sesion.get("area", "")
                )
            return {"exito": True}
        except Exception as e:
            return {"exito": False, "error": str(e)}

    # ------------------------------------------------------------------
    # CONFIGURACIÓN DE GOOGLE SHEETS
    # ------------------------------------------------------------------
    def obtener_config_sheets(self) -> Dict[str, Any]:
        """Retorna la configuración actual de Google Sheets y credenciales."""
        return cargar_configuracion()

    def guardar_config_sheets(self, nueva_config: Dict[str, Any]) -> Dict[str, Any]:
        """Actualiza y persiste la configuración en AppData."""
        try:
            cfg = cargar_configuracion()
            if "spreadsheet_inventario" in nueva_config:
                cfg["spreadsheet_inventario"] = nueva_config["spreadsheet_inventario"]
            if "spreadsheet_roster" in nueva_config:
                cfg["spreadsheet_roster"] = nueva_config["spreadsheet_roster"]
            if "credentials_file" in nueva_config:
                cfg["credentials_file"] = nueva_config["credentials_file"]
            if "github_repo" in nueva_config:
                cfg["github_repo"] = nueva_config["github_repo"]
            
            guardar_configuracion(cfg)
            google_service.init_clients()
            return {"exito": True, "config": cfg}
        except Exception as e:
            return {"exito": False, "error": str(e)}

    def probar_conexion_sheets(self) -> Dict[str, Any]:
        """Prueba la conexión a los libros configurados."""
        return google_service.check_connection()

    # ------------------------------------------------------------------
    # MANEJO DE VENTANA PYWEBVIEW
    # ------------------------------------------------------------------
    def minimizar_a_bandeja(self) -> Dict[str, Any]:
        """Oculta la ventana en la bandeja del sistema (System Tray)."""
        if self._ventana:
            try:
                self._ventana.hide()
            except Exception as e:
                logger.warning(f"[ApiBridge] Error al minimizar: {e}")
        return {"exito": True}

    def redimensionar_ventana(self, ancho: int, alto: int) -> Dict[str, Any]:
        """Redimensiona dinámicamente la ventana."""
        if self._ventana:
            try:
                self._ventana.resize(ancho, alto)
            except Exception as e:
                logger.warning(f"[ApiBridge] Error al redimensionar: {e}")
        return {"exito": True}

    def maximizar_ventana(self) -> Dict[str, Any]:
        if self._ventana:
            try:
                self._ventana.maximize()
            except Exception as e:
                logger.warning(f"[ApiBridge] Error al maximizar: {e}")
        return {"exito": True}

    def restaurar_ventana(self) -> Dict[str, Any]:
        if self._ventana:
            try:
                self._ventana.restore()
            except Exception as e:
                logger.warning(f"[ApiBridge] Error al restaurar: {e}")
        return {"exito": True}

    # ------------------------------------------------------------------
    # AUTO-ACTUALIZADOR DESDE GITHUB RELEASES
    # ------------------------------------------------------------------
    def verificar_actualizacion(self) -> Dict[str, Any]:
        """Verifica en GitHub si existe una versión superior disponible."""
        try:
            cfg = cargar_configuracion()
            repo = cfg.get("github_repo", "Aterian/RegistroInventario")
            if not repo:
                return {"actualizacion_disponible": False, "version_actual": APP_VERSION}

            url = f"https://api.github.com/repos/{repo}/releases/latest"
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IngeapInventario-App",
                    "Accept": "application/vnd.github.v3+json"
                }
            )
            import ssl
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                tag = data.get("tag_name", "").lstrip("v").strip()
                assets = data.get("assets", [])

                exe_asset = next((a for a in assets if "instalador" not in a.get("name", "").lower() and a.get("name", "").lower().endswith(".exe")), None)
                if not exe_asset:
                    exe_asset = next((a for a in assets if a.get("name", "").lower().endswith(".exe")), None)

                url_descarga = exe_asset.get("browser_download_url", "") if exe_asset else ""

                if tag and tag != APP_VERSION and url_descarga:
                    return {
                        "actualizacion_disponible": True,
                        "version_actual": APP_VERSION,
                        "version_nueva": tag,
                        "notas": data.get("body", "") or "Mejoras y correcciones en esta versión.",
                        "url_descarga": url_descarga
                    }
        except Exception as e:
            logger.info(f"[AutoUpdate] Sin conexión o verificación omitida: {e}")

        return {"actualizacion_disponible": False, "version_actual": APP_VERSION}

    def aplicar_actualizacion(self, url_descarga: str) -> Dict[str, Any]:
        """Descarga e instala la actualización reemplazando el ejecutable de forma segura."""
        if not getattr(sys, "frozen", False):
            return {"exito": False, "error": "La actualización automática solo aplica sobre el ejecutable (.exe)."}

        try:
            temp_dir = os.environ.get("TEMP", os.path.expanduser("~"))
            nuevo_exe = os.path.join(temp_dir, "IngeapInventario_update.exe")

            req = urllib.request.Request(
                url_descarga,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IngeapInventario-App",
                    "Accept": "*/*"
                }
            )
            import ssl
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=120, context=ctx) as resp, open(nuevo_exe, "wb") as f:
                f.write(resp.read())

            no_window_flag = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
            try:
                subprocess.run(
                    ["powershell", "-NoProfile", "-NonInteractive", "-Command", f"Unblock-File -LiteralPath '{nuevo_exe}' -ErrorAction SilentlyContinue"],
                    creationflags=no_window_flag,
                    timeout=5
                )
            except Exception:
                pass

            ruta_actual_exe = sys.executable
            ruta_bat = os.path.join(temp_dir, "update_ingeap_inventario.bat")

            contenido_bat = f"""@echo off
setlocal enabledelayedexpansion
taskkill /F /IM IngeapInventario.exe >nul 2>&1
taskkill /F /IM Ingeap-Inventario.exe >nul 2>&1

set INTENTO=0
:INTENTO_COPIA
set /a INTENTO+=1
timeout /t 1 /nobreak >nul

copy /y "{nuevo_exe}" "{ruta_actual_exe}" >nul 2>&1
if !ERRORLEVEL! equ 0 goto EXITO_COPIA

taskkill /F /IM IngeapInventario.exe >nul 2>&1
if !INTENTO! lss 30 goto INTENTO_COPIA
goto LIMPIEZA

:EXITO_COPIA
del /f /q "{nuevo_exe}" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '{ruta_actual_exe}' -ErrorAction SilentlyContinue" >nul 2>&1

set _MEIPASS=
set _MEIPASS2=
set _PYI_APPLICATION_HOME_DIR=
set _PYI_PARENT_PROCESS_LEVEL=
set _PYI_ARCHIVE_FILE=
set _PYI_SPLASH_IPC=

start "" "{ruta_actual_exe}"

:LIMPIEZA
(goto) 2>nul & del "%~f0"
"""
            with open(ruta_bat, "w", encoding="utf-8") as f:
                f.write(contenido_bat)

            subprocess.Popen([ruta_bat], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
            sys.exit(0)
        except Exception as e:
            logger.error(f"[AutoUpdate] Error al aplicar actualización: {e}")
            return {"exito": False, "error": str(e)}
