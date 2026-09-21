import os
import io
import time
import base64
import uuid
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import gspread
from gspread.utils import rowcol_to_a1
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from backend.config import (
    CREDENTIALS_FILE,
    SHEET_INVENTARIO_NAME,
    SHEET_ROSTER_NAME,
    SHEET_REGISTRO_GASTOS_TAB,
    SHEET_SOLICITUDES_TAB,
    SHEET_MOVIMIENTOS_TAB,
    SHEET_CONTROL_M_TAB,
    SHEET_CONTROL_I_TAB,
    CATALOG_TABS,
    DRIVE_SIGNATURES_FOLDER_ID,
    CACHE_TTL_SECONDS,
    UPLOADS_DIR,
    ALERT_DAYS_WARNING,
    ALERT_DAYS_CRITICAL
)
from backend.database import (
    save_catalogo_cache_local,
    get_catalogo_cache_local,
    save_proyectos_usuarios_cache_local,
    get_proyectos_usuarios_cache_local,
    save_viaje_salida_local,
    save_viaje_retorno_local,
    mark_viaje_as_synced,
    get_viajes_activos_local,
    get_viaje_by_id_local,
    save_elemento_catalogo_local,
    save_stock_minimo_local,
    delete_elemento_catalogo_local,
    update_elemento_mantenimiento_local,
    update_elemento_stock_local,
    get_todos_los_viajes_local,
    save_solicitud_local,
    get_solicitudes_local,
    update_solicitud_local,
    save_movimiento_local,
    get_movimientos_local,
    save_stock_minimo_local,
    get_stock_minimos_local,
    save_elemento_catalogo_local,
    delete_elemento_catalogo_local
)


logger = logging.getLogger("ingeap.google_service")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

REGISTRO_GASTOS_COLUMNS = [
    "id_gasto",
    "id_viaje",
    "id_proyecto",
    "proyecto",
    "tipo",
    "elemento",
    "fecha_s",
    "fecha_r",
    "unidad_s",
    "unidad_r",
    "costo_u",
    "costo_t",
    "user_s",
    "firma_s",
    "user_r",
    "firma_r",
    "fecha_hora_s",
    "fecha_hora_r",
    "unidad_medida"
]


SOLICITUDES_COLUMNS = [
    "id_solicitud",
    "fecha",
    "solicitante",
    "elemento",
    "categoria",
    "cantidad",
    "prioridad",
    "id_proyecto",
    "proyecto",
    "estado",
    "observaciones",
    "fecha_hora"
]

MOVIMIENTOS_COLUMNS = [
    "id_movimiento",
    "fecha_hora",
    "tipo_movimiento",
    "id_elemento",
    "categoria",
    "elemento",
    "codigo_interno",
    "cantidad",
    "id_viaje",
    "proyecto",
    "usuario",
    "observaciones"
]

CATEGORY_CONFIG = {
    "Indumentaria": {"tab": "1_0_Indumentaria", "id_col": "ID_indumentaria", "name_cols": ["Tipo", "Marca", "Modelo"]},
    "Instrumental": {"tab": "2_0_Instrumental", "id_col": "ID_instrumental", "name_cols": ["Subtipo", "Marca", "Modelo"]},
    "Accesorios": {"tab": "2_1_Accesorios", "id_col": "ID_accesorio", "name_cols": ["Clase", "Marca", "Descripcion"]},
    "Adicional": {"tab": "2_1_Adicional", "id_col": "ID_adicional", "name_cols": ["Tipo", "Descripcion"]},
    "Repuestos": {"tab": "2_1_Instrumental_repuestos", "id_col": "id_repuesto", "name_cols": ["nombre", "marca"]},
    "Movilidad": {"tab": "3_0_Movilidad", "id_col": "ID_movilidad", "name_cols": ["Tipo", "Marca", "Modelo", "Patente"]},
    "Informatica": {"tab": "4_0_Informatica", "id_col": "ID_informatica", "name_cols": ["Tipo", "Marca", "Modelo"]},
    "Herramientas": {"tab": "5_0_Herramientas", "id_col": "ID_herramienta", "name_cols": ["Tipo", "Marca"]},
    "Materiales": {"tab": "6_0_Materiales", "id_col": "ID_material", "name_cols": ["Tipo", "Marca", "Detalle"]}
}

def parse_date_flexible(d_str: Any) -> Optional[datetime]:
    """Intenta parsear cadenas de fecha comunes a datetime."""
    if not d_str:
        return None
    s = str(d_str).strip()
    if not s or s.lower() in ["none", "no aplica", "-", ""]:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%d/%m/%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s.split(" ")[0] if " " in s and len(fmt) <= 10 else s, fmt)
        except Exception:
            pass
    return None


def calcular_unidad_medida(tipo: str, elemento: str, modo_costeo: str = "") -> str:
    """Calcula la unidad de medida según categoría o modo de costeo configurado."""
    if modo_costeo:
        mc = modo_costeo.strip().lower()
        if "km" in mc:
            return "km"
        if "dia" in mc or "día" in mc:
            return "días de uso"
        if "ciclo" in mc:
            return "ciclos de batería"
        if "cant" in mc:
            return "cantidad"
        if "ning" in mc or "sin" in mc:
            return ""
        return modo_costeo

    t = (tipo or "").strip().lower()
    e = (elemento or "").strip().lower()
    if "movilidad" in t:
        return "km"
    elif "dron" in t or "dron" in e:
        return "ciclos de batería"
    elif "instrumental" in t:
        return "días de uso"
    elif "adicional" in t:
        return "días de uso"
    elif "accesorio" in t:
        return ""
    elif "material" in t or "herramienta" in t or "indumentaria" in t or "repuesto" in t:
        return "cantidad"
    return "cantidad"



class GoogleService:
    def __init__(self):
        self.credentials: Optional[Credentials] = None
        self.gc: Optional[gspread.Client] = None
        self.drive_service: Optional[Any] = None
        self.is_connected = False
        
        # Caché en memoria para catálogos
        self._memory_cache = {
            "data": None,
            "expires_at": 0
        }
        
        self.init_clients()

    def _open_sheet(self, name_or_id: str) -> gspread.Spreadsheet:
        """Abre un Google Sheet por ID, URL o Título."""
        if not self.gc:
            raise ValueError("Google Client no inicializado.")
        from backend.config import extraer_spreadsheet_id
        clean = extraer_spreadsheet_id(name_or_id)
        if len(clean) > 20 and " " not in clean:
            try:
                return self.gc.open_by_key(clean)
            except Exception:
                pass
        return self.gc.open(clean)

    def _open_inventario_sheet(self) -> gspread.Spreadsheet:
        from backend.config import cargar_configuracion
        cfg = cargar_configuracion()
        return self._open_sheet(cfg.get("spreadsheet_inventario", SHEET_INVENTARIO_NAME))

    def _open_roster_sheet(self) -> gspread.Spreadsheet:
        from backend.config import cargar_configuracion
        cfg = cargar_configuracion()
        return self._open_sheet(cfg.get("spreadsheet_roster", SHEET_ROSTER_NAME))

    def init_clients(self) -> bool:
        """Inicializa los clientes de Google Sheets y Google Drive con búsqueda de credenciales."""
        from backend.config import buscar_archivo_credenciales, cargar_configuracion
        cfg = cargar_configuracion()
        cred_path = buscar_archivo_credenciales(cfg.get("credentials_file", "credentials.json"))

        if not cred_path or not os.path.exists(cred_path):
            logger.warning(f"Archivo de credenciales de Google no encontrado. Operando en modo local/contingencia.")
            self.is_connected = False
            return False

        try:
            self.credentials = Credentials.from_service_account_file(
                cred_path,
                scopes=SCOPES
            )
            self.gc = gspread.authorize(self.credentials)
            self.drive_service = build("drive", "v3", credentials=self.credentials, cache_discovery=False)
            self.is_connected = True
            logger.info(f"Clientes de Google Sheets y Drive conectados exitosamente usando {cred_path}.")
            return True
        except Exception as e:
            logger.error(f"Error al autenticar con Google APIs: {e}")
            self.is_connected = False
            return False

    def check_connection(self) -> Dict[str, Any]:
        """Comprueba el estado de la conexión a Google Sheets y Drive."""
        from backend.config import buscar_archivo_credenciales, cargar_configuracion
        cfg = cargar_configuracion()
        cred_path = buscar_archivo_credenciales(cfg.get("credentials_file", "credentials.json"))

        if not self.is_connected and cred_path and os.path.exists(cred_path):
            self.init_clients()

        status = {
            "connected": self.is_connected,
            "inventario_ok": False,
            "roster_ok": False,
            "drive_ok": False,
            "credentials_path": cred_path or "",
            "credentials_exists": bool(cred_path and os.path.exists(cred_path))
        }

        if not self.is_connected or not self.gc:
            return status

        sheet_inv = cfg.get("spreadsheet_inventario", SHEET_INVENTARIO_NAME)
        sheet_ros = cfg.get("spreadsheet_roster", SHEET_ROSTER_NAME)

        try:
            self._open_sheet(sheet_inv)
            status["inventario_ok"] = True
        except Exception as e:
            logger.warning(f"No se pudo abrir hoja de inventario '{sheet_inv}': {e}")

        try:
            self._open_sheet(sheet_ros)
            status["roster_ok"] = True
        except Exception as e:
            logger.warning(f"No se pudo abrir hoja de roster '{sheet_ros}': {e}")

        if self.drive_service:
            try:
                self.drive_service.files().list(pageSize=1).execute()
                status["drive_ok"] = True
            except Exception as e:
                logger.warning(f"No se pudo consultar Google Drive: {e}")

        return status

    # ----------------------------------------------------------------------
    # GESTIÓN DE FIRMAS Y GOOGLE DRIVE
    # ----------------------------------------------------------------------
    def upload_signature(self, base64_str: str, filename_prefix: str = "firma") -> Tuple[str, str]:
        """
        Decodifica la firma Base64, guarda copia local y la sube a Google Drive si está habilitado.
        Retorna: (enlace_publico_o_local, ruta_local).
        """
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]

            image_bytes = base64.b64decode(base64_str)
            filename = f"{filename_prefix}_{uuid.uuid4().hex[:8]}_{int(time.time())}.png"
            local_path = UPLOADS_DIR / filename

            with open(local_path, "wb") as f:
                f.write(image_bytes)

            drive_url = f"/api/uploads/firmas/{filename}"

            if self.is_connected and self.drive_service:
                try:
                    file_metadata = {
                        "name": filename,
                        "mimeType": "image/png"
                    }
                    if DRIVE_SIGNATURES_FOLDER_ID:
                        file_metadata["parents"] = [DRIVE_SIGNATURES_FOLDER_ID]

                    media = MediaIoBaseUpload(io.BytesIO(image_bytes), mimetype="image/png", resumable=False)
                    uploaded_file = self.drive_service.files().create(
                        body=file_metadata,
                        media_body=media,
                        fields="id, webViewLink, webContentLink"
                    ).execute()

                    file_id = uploaded_file.get("id")
                    self.drive_service.permissions().create(
                        fileId=file_id,
                        body={"type": "anyone", "role": "reader"}
                    ).execute()

                    drive_url = uploaded_file.get("webContentLink") or uploaded_file.get("webViewLink") or drive_url
                    logger.info(f"Firma subida a Google Drive con éxito: {drive_url}")
                except Exception as e:
                    logger.info(f"Firma guardada en servidor local ({e})")

            return drive_url, str(local_path)
        except Exception as e:
            logger.error(f"Error procesando firma base64: {e}")
            return "", ""

    # ----------------------------------------------------------------------
    # LECTURA DE CATÁLOGOS, DOCUMENTACIÓN Y ROSTER
    # ----------------------------------------------------------------------
    def get_catalogos(self, recargar: bool = False) -> Dict[str, Any]:
        """
        Retorna proyectos, usuarios, inventario unificado (con docs y repuestos) y categorías.
        Utiliza caché de 5 minutos o SQLite local si no hay conexión.
        """
        now = time.time()
        if not recargar and self._memory_cache["data"] and now < self._memory_cache["expires_at"]:
            return self._memory_cache["data"]

        stock_minimos = get_stock_minimos_local()

        if not self.is_connected or not self.gc:
            local_cat = get_catalogo_cache_local()
            local_meta = get_proyectos_usuarios_cache_local()
            # Enriquecer con stock mínimos guardados
            for it in local_cat:
                if it.get("id") in stock_minimos:
                    it["stock_minimo"] = stock_minimos[it["id"]]
            categorias = sorted(list({item.get("categoria", "") for item in local_cat if item.get("categoria")}))
            
            res = {
                "proyectos": local_meta.get("proyectos", []),
                "usuarios": local_meta.get("usuarios", []),
                "inventario": local_cat,
                "categorias": categorias,
                "origen": "local_cache",
                "timestamp": datetime.now().isoformat()
            }
            self._memory_cache["data"] = res
            self._memory_cache["expires_at"] = now + CACHE_TTL_SECONDS
            return res

        try:
            proyectos = self._read_proyectos()
            usuarios = self._read_usuarios()
            save_proyectos_usuarios_cache_local(proyectos, usuarios)

            inventario = self._read_inventario_unified()
            # Enriquecer con stock mínimos locales configurados
            for it in inventario:
                if it.get("id") in stock_minimos:
                    it["stock_minimo"] = stock_minimos[it["id"]]

            local_existente = get_catalogo_cache_local()
            if not local_existente or len(inventario) >= len(local_existente):
                save_catalogo_cache_local(inventario)
            else:
                logger.warning(f"[Cache] Inventario remoto tiene {len(inventario)} elementos pero la base local tiene {len(local_existente)}. Se conserva la base local más completa.")

            categorias = sorted(list({item.get("categoria", "") for item in inventario if item.get("categoria")}))

            result = {
                "proyectos": proyectos,
                "usuarios": usuarios,
                "inventario": inventario,
                "categorias": categorias,
                "origen": "google_sheets",
                "timestamp": datetime.now().isoformat()
            }

            self._memory_cache["data"] = result
            self._memory_cache["expires_at"] = now + CACHE_TTL_SECONDS
            return result

        except Exception as e:
            logger.error(f"Error consultando Google Sheets, recurriendo a base local: {e}")
            local_cat = get_catalogo_cache_local()
            local_meta = get_proyectos_usuarios_cache_local()
            for it in local_cat:
                if it.get("id") in stock_minimos:
                    it["stock_minimo"] = stock_minimos[it["id"]]
            categorias = sorted(list({item.get("categoria", "") for item in local_cat if item.get("categoria")}))
            return {
                "proyectos": local_meta.get("proyectos", []),
                "usuarios": local_meta.get("usuarios", []),
                "inventario": local_cat,
                "categorias": categorias,
                "origen": "local_fallback",
                "timestamp": datetime.now().isoformat()
            }

    def _read_proyectos(self) -> List[Dict[str, Any]]:
        """Lee la pestaña 0_proyectos del libro BBDD_asist_roster."""
        try:
            sh = self._open_roster_sheet()
            ws = sh.worksheet("0_proyectos")
            records = ws.get_all_records()
            proyectos = []
            for r in records:
                p_id = str(r.get("id_proyecto", "")).strip()
                denom = str(r.get("denominacion", "")).strip()
                area = str(r.get("area", "")).strip()
                if p_id or denom:
                    proyectos.append({
                        "id_proyecto": p_id,
                        "denominacion": denom,
                        "area": area
                    })
            return proyectos
        except Exception as e:
            logger.error(f"Error al leer 0_proyectos: {e}")
            return []

    def _read_usuarios(self) -> List[Dict[str, Any]]:
        """Lee la pestaña 0_usuarios del libro BBDD_asist_roster."""
        try:
            sh = self._open_roster_sheet()
            ws = sh.worksheet("0_usuarios")
            records = ws.get_all_records()
            usuarios = []
            for r in records:
                u_id = str(r.get("id_usuario", "")).strip()
                nombre = str(r.get("nombre", "")).strip()
                email = str(r.get("email", "")).strip()
                area = str(r.get("area", "")).strip()
                dni = str(r.get("dni", "")).strip()
                if u_id or nombre:
                    usuarios.append({
                        "id_usuario": u_id,
                        "nombre": nombre,
                        "email": email,
                        "area": area,
                        "dni": dni
                    })
            return usuarios
        except Exception as e:
            logger.error(f"Error al leer 0_usuarios: {e}")
            return []

    def _read_documentos_movilidad(self, sh: gspread.Spreadsheet) -> Dict[str, List[Dict[str, Any]]]:
        """Lee la pestaña 3_1_Control_M y agrupa documentos por ID_movilidad."""
        doc_map = {}
        try:
            ws = sh.worksheet(SHEET_CONTROL_M_TAB)
            records = ws.get_all_records()
            for r in records:
                m_id = str(r.get("ID_movilidad", "")).strip()
                if not m_id:
                    continue
                doc = {
                    "id_control": str(r.get("ID_control_m", "")),
                    "tipo_doc": str(r.get("Tipo_documento", "")).strip(),
                    "denominacion": str(r.get("Denominacion_doc", "")).strip(),
                    "doc_url": str(r.get("Doc_URL", "")).strip(),
                    "foto": str(r.get("Foto", "")).strip(),
                    "fecha_vencimiento": str(r.get("Fecha_vencimiento", "")).strip(),
                    "kilometraje_vencimiento": str(r.get("Kilometraje_vencimiento", "")).strip(),
                    "estado": str(r.get("Estado", "")).strip(),
                    "comentario": str(r.get("Comentario", "")).strip()
                }
                if m_id not in doc_map:
                    doc_map[m_id] = []
                doc_map[m_id].append(doc)
        except Exception as e:
            logger.warning(f"No se pudo leer {SHEET_CONTROL_M_TAB}: {e}")
        return doc_map

    def _read_documentos_instrumental(self, sh: gspread.Spreadsheet) -> Dict[str, List[Dict[str, Any]]]:
        """Lee la pestaña 2_1_Control_I y agrupa documentos y calibraciones por ID_instrumental."""
        doc_map = {}
        try:
            ws = sh.worksheet(SHEET_CONTROL_I_TAB)
            records = ws.get_all_records()
            for r in records:
                ins_id = str(r.get("ID_instrumental", "")).strip()
                if not ins_id:
                    continue
                doc = {
                    "id_control": str(r.get("ID_control_I", "")),
                    "clasificacion": str(r.get("Clasificacion", "")).strip(),
                    "tipo_doc": str(r.get("Tipo", "")).strip(),
                    "denominacion": f"{r.get('Clasificacion', '')} - {r.get('Tipo', '')}".strip(" -"),
                    "fecha_vencimiento": str(r.get("Vencimiento", "")).strip(),
                    "detalle": str(r.get("Detalle", "")).strip(),
                    "doc_url": str(r.get("URL", "")).strip(),
                    "estado": str(r.get("Estado", "")).strip()
                }
                if ins_id not in doc_map:
                    doc_map[ins_id] = []
                doc_map[ins_id].append(doc)
        except Exception as e:
            logger.warning(f"No se pudo leer {SHEET_CONTROL_I_TAB}: {e}")
        return doc_map

    def _is_baja(self, row: Dict[str, Any]) -> bool:
        """Determina si un ítem está dado de baja según las columnas de estado."""
        for col_name in ["Activo_baja", "Ativo_baja", "activo_baja", "ativo_baja", "Estado"]:
            val = str(row.get(col_name, "")).strip().upper()
            if val in ["SI", "TRUE", "1", "BAJA", "INACTIVO", "DESACTIVADO"]:
                return True
        return False

    def _read_inventario_unified(self) -> List[Dict[str, Any]]:
        """Lee todas las pestañas de Inventario v1.5 - Dev y las unifica."""
        unified_items = []
        try:
            sh = self._open_inventario_sheet()
        except Exception as e:
            logger.error(f"No se pudo abrir '{SHEET_INVENTARIO_NAME}': {e}")
            return []

        # Cargar mapas de documentación en memoria
        docs_mov_map = self._read_documentos_movilidad(sh)
        docs_ins_map = self._read_documentos_instrumental(sh)
        tabs_fallidas = []

        for tab_name in CATALOG_TABS:
            try:
                time.sleep(0.35)
                ws = sh.worksheet(tab_name)
                rows = ws.get_all_records()
                
                # Identificar categoría amigable
                if tab_name == "2_1_Instrumental_repuestos":
                    categoria_limpia = "Repuestos"
                else:
                    categoria_limpia = tab_name.split("_", 2)[-1]  # ej: 'Instrumental' de '2_0_Instrumental'

                for r in rows:
                    if self._is_baja(r):
                        continue

                    item_id = ""
                    codigo_int = str(r.get("Codigo_interno") or r.get("Numero_interno") or "").strip()
                    nombre_partes = []
                    n_serie = str(r.get("Numero_serie") or r.get("Patente") or "").strip()
                    imagen = str(r.get("Imagen") or "").strip()
                    url_carpeta = str(r.get("URL_carpeta") or "").strip()
                    subcategoria = ""
                    stock_minimo = 0.0
                    stock_actual = 0.0
                    compatibles_ids = []
                    documentos = []
                    es_dron = False

                    if tab_name == "1_0_Indumentaria":
                        item_id = str(r.get("ID_indumentaria", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        nombre_partes = [tipo, marca, modelo]
                        stock_minimo = float(r.get("Stock_minimo") or 0.0)

                    elif tab_name == "2_0_Instrumental":
                        item_id = str(r.get("ID_instrumental", ""))
                        subtipo = str(r.get("Subtipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        nombre_partes = [subtipo, marca, modelo]
                        if "dron" in subtipo.lower():
                            es_dron = True
                        documentos = docs_ins_map.get(item_id, [])

                    elif tab_name == "2_1_Accesorios":
                        item_id = str(r.get("ID_accesorio", ""))
                        clase = str(r.get("Clase", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        desc = str(r.get("Descripcion", "")).strip()
                        nombre_partes = [clase, marca, desc]

                    elif tab_name == "2_1_Adicional":
                        item_id = str(r.get("ID_adicional", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        desc = str(r.get("Descripcion", "")).strip()
                        nombre_partes = [tipo, desc]

                    elif tab_name == "2_1_Instrumental_repuestos":
                        item_id = str(r.get("id_repuesto", ""))
                        nom = str(r.get("nombre", "")).strip()
                        marca = str(r.get("marca", "")).strip()
                        nombre_partes = [nom, marca]
                        stock_actual = float(r.get("cantidad") or 0.0)
                        raw_comp = str(r.get("elementos_compatibles_ids", "")).strip()
                        if raw_comp:
                            compatibles_ids = [c.strip() for c in raw_comp.split(",") if c.strip()]

                    elif tab_name == "3_0_Movilidad":
                        item_id = str(r.get("ID_movilidad", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        patente = str(r.get("Patente", "")).strip()
                        nombre_partes = [tipo, marca, modelo, f"({patente})" if patente else ""]
                        documentos = docs_mov_map.get(item_id, [])

                    elif tab_name == "4_0_Informatica":
                        item_id = str(r.get("ID_informatica", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        prest = str(r.get("Prestaciones", "")).strip()
                        if "licencia" in tipo.lower() or "suscrip" in tipo.lower():
                            subcategoria = "Licencias y Suscripciones"
                        nombre_partes = [tipo, marca, modelo, f"[{prest}]" if prest else ""]

                    elif tab_name == "5_0_Herramientas":
                        item_id = str(r.get("ID_herramienta", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        nombre_partes = [tipo, marca]
                        stock_actual = 1.0

                    elif tab_name == "6_0_Materiales":
                        item_id = str(r.get("ID_material", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        det = str(r.get("Detalle", "")).strip()
                        nombre_partes = [tipo, marca, det]
                        stock_minimo = float(r.get("Cantidad_minima") or 0.0)
                        stock_actual = 10.0  # Base estándar o configurable

                    else:
                        item_id = str(list(r.values())[0]) if r else ""
                        nombre_partes = [str(v) for v in list(r.values())[1:4]]

                    nombre = " ".join([p for p in nombre_partes if p]).strip()
                    if not nombre and item_id:
                        nombre = f"{categoria_limpia} #{item_id}"

                    if not item_id and not codigo_int and not nombre:
                        continue

                    modo_costeo = str(r.get("Modo_costeo") or r.get("modo_costeo") or "").strip()
                    if not modo_costeo:
                        if categoria_limpia == "Movilidad":
                            modo_costeo = "KM"
                        elif categoria_limpia == "Instrumental":
                            modo_costeo = "Ciclos de batería" if es_dron else "Días de uso"
                        elif categoria_limpia == "Adicional":
                            modo_costeo = "Días de uso"
                        elif categoria_limpia == "Accesorios":
                            modo_costeo = ""
                        elif categoria_limpia in ["Materiales", "Herramientas", "Indumentaria", "Repuestos"]:
                            modo_costeo = "Cantidad"

                    en_mantenimiento = bool(r.get("En_mantenimiento") or r.get("en_mantenimiento") or False)
                    tipo_mantenimiento = str(r.get("Tipo_mantenimiento") or r.get("tipo_mantenimiento") or "").strip()
                    fecha_inicio_mantenimiento = str(r.get("Fecha_inicio_mantenimiento") or r.get("fecha_inicio_mantenimiento") or "").strip()
                    fecha_fin_mantenimiento = str(r.get("Fecha_fin_mantenimiento") or r.get("fecha_fin_mantenimiento") or "").strip()

                    if "Stock_actual" in r or "stock_actual" in r or "Stock" in r:
                        try:
                            stock_actual = float(r.get("Stock_actual") or r.get("stock_actual") or r.get("Stock") or stock_actual)
                        except Exception:
                            pass

                    final_id = str(item_id if item_id else (codigo_int if codigo_int else f"ITEM_{len(unified_items)+1}")).strip()

                    unified_items.append({
                        "id": final_id,
                        "categoria": categoria_limpia,
                        "subcategoria": subcategoria,
                        "codigo_interno": codigo_int,
                        "nombre": nombre,
                        "numero_serie": n_serie,
                        "imagen": imagen,
                        "url_carpeta": url_carpeta,
                        "documentos": documentos,
                        "stock_minimo": stock_minimo,
                        "stock_actual": stock_actual,
                        "elementos_compatibles_ids": compatibles_ids,
                        "es_dron": es_dron,
                        "modo_costeo": modo_costeo,
                        "en_mantenimiento": en_mantenimiento,
                        "tipo_mantenimiento": tipo_mantenimiento,
                        "fecha_inicio_mantenimiento": fecha_inicio_mantenimiento,
                        "fecha_fin_mantenimiento": fecha_fin_mantenimiento
                    })
            except Exception as e:
                logger.warning(f"No se pudo procesar pestaña '{tab_name}': {e}")
                tabs_fallidas.append(tab_name)
                continue

        # Superponer ajustes locales de SQLite (mantenimiento, stock, modo de costeo)
        try:
            local_items = get_catalogo_cache_local()
            if tabs_fallidas and local_items:
                cats_cargadas = {it.get("categoria") for it in unified_items if it.get("categoria")}
                restaurados = 0
                for it in local_items:
                    if it.get("categoria") not in cats_cargadas:
                        unified_items.append(it)
                        restaurados += 1
                if restaurados:
                    logger.info(f"[Resiliencia] Se preservaron {restaurados} elementos de categorías afectadas por fallas de conexión ({tabs_fallidas}).")

            local_map = {str(it.get("id")): it for it in local_items if it.get("id")}
            for u in unified_items:
                loc = local_map.get(str(u["id"]))
                if loc:
                    if "en_mantenimiento" in loc:
                        u["en_mantenimiento"] = bool(loc["en_mantenimiento"])
                    if "tipo_mantenimiento" in loc:
                        u["tipo_mantenimiento"] = loc["tipo_mantenimiento"]
                    if "fecha_inicio_mantenimiento" in loc:
                        u["fecha_inicio_mantenimiento"] = loc["fecha_inicio_mantenimiento"]
                    if "fecha_fin_mantenimiento" in loc:
                        u["fecha_fin_mantenimiento"] = loc["fecha_fin_mantenimiento"]
                    if "stock_actual" in loc and loc["stock_actual"] is not None:
                        u["stock_actual"] = float(loc["stock_actual"])
                    if "modo_costeo" in loc and loc["modo_costeo"]:
                        u["modo_costeo"] = loc["modo_costeo"]
        except Exception as e_loc:
            logger.warning(f"Error superponiendo caché local de catálogo: {e_loc}")

        return unified_items


    # ----------------------------------------------------------------------
    # TABLERO DE CONTROL Y ALERTAS (DOCUMENTOS Y STOCK)
    # ----------------------------------------------------------------------
    def get_alertas_dashboard(self) -> Dict[str, Any]:
        """
        Calcula alertas preventivas:
        - Documentos: 🟡 ALERTA (31 a 60 días), 🔴 CRITICO / VENCIDO (<= 30 días o vencido)
        - Stock: Materiales y herramientas donde stock_actual <= stock_minimo
        """
        catalogos = self.get_catalogos()
        items = catalogos.get("inventario", [])
        today = datetime.now()

        documentos_alerta = []
        stock_alerta = []

        total_vencidos = 0
        total_por_vencer = 0
        total_stock_bajo = 0

        for it in items:
            it_id = it.get("id")
            it_nombre = it.get("nombre")
            it_cat = it.get("categoria")
            it_cod = it.get("codigo_interno")
            docs = it.get("documentos", [])
            url_carpeta = it.get("url_carpeta", "")

            # Evaluar documentos
            for doc in docs:
                venc_str = doc.get("fecha_vencimiento")
                v_date = parse_date_flexible(venc_str)
                if v_date:
                    delta_dias = (v_date - today).days
                    nivel = None
                    if delta_dias < 0:
                        nivel = "VENCIDO"  # 🔴
                        total_vencidos += 1
                    elif delta_dias <= ALERT_DAYS_CRITICAL:  # <= 30
                        nivel = "CRITICO"  # 🔴
                        total_por_vencer += 1
                    elif delta_dias <= ALERT_DAYS_WARNING:   # 31 a 60
                        nivel = "ALERTA"   # 🟡
                        total_por_vencer += 1

                    if nivel:
                        documentos_alerta.append({
                            "id_elemento": it_id,
                            "elemento": it_nombre,
                            "categoria": it_cat,
                            "codigo_interno": it_cod,
                            "denominacion": doc.get("denominacion") or doc.get("tipo_doc") or "Documento",
                            "fecha_vencimiento": venc_str,
                            "dias_restantes": delta_dias,
                            "nivel": nivel,
                            "doc_url": doc.get("doc_url") or url_carpeta
                        })

            # Evaluar stock
            s_min = float(it.get("stock_minimo", 0.0) or 0.0)
            s_act = float(it.get("stock_actual", 0.0) or 0.0)
            if s_min > 0 and s_act <= s_min:
                total_stock_bajo += 1
                stock_alerta.append({
                    "id_elemento": it_id,
                    "elemento": it_nombre,
                    "categoria": it_cat,
                    "codigo_interno": it_cod,
                    "stock_actual": s_act,
                    "stock_minimo": s_min,
                    "nivel": "CRITICO" if s_act == 0 else "BAJO"
                })

        # Ordenar documentos por urgencia
        documentos_alerta.sort(key=lambda x: x["dias_restantes"])
        stock_alerta.sort(key=lambda x: x["stock_actual"])

        return {
            "resumen": {
                "vencidos": total_vencidos,
                "por_vencer": total_por_vencer,
                "stock_bajo": total_stock_bajo
            },
            "documentos_alerta": documentos_alerta,
            "stock_alerta": stock_alerta,
            "timestamp": datetime.now().isoformat()
        }

    # ----------------------------------------------------------------------
    # CRUD CATÁLOGO (ALTA, EDICIÓN, BAJA)
    # ----------------------------------------------------------------------
    def crear_elemento(self, categoria: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea un nuevo elemento en Google Sheets y en caché SQLite."""
        nuevo_id = str(uuid.uuid4())
        conf = CATEGORY_CONFIG.get(categoria, CATEGORY_CONFIG["Materiales"])
        tab_name = conf["tab"]

        data["id"] = nuevo_id
        data["categoria"] = categoria

        # Guardar en SQLite local
        save_elemento_catalogo_local(data)
        if data.get("stock_minimo"):
            save_stock_minimo_local(nuevo_id, float(data["stock_minimo"]))

        # Sincronizar en Google Sheets
        if self.is_connected and self.gc:
            try:
                sh = self._open_inventario_sheet()
                ws = sh.worksheet(tab_name)
                headers = ws.row_values(1)

                row_vals = []
                for h in headers:
                    val = ""
                    if h in [conf["id_col"], "id_repuesto"]:
                        val = nuevo_id
                    elif h in ["Tipo", "Subtipo", "Clase"]:
                        val = data.get("tipo") or data.get("subcategoria") or ""
                    elif h == "Marca":
                        val = data.get("marca", "")
                    elif h == "Modelo":
                        val = data.get("modelo", "")
                    elif h in ["Codigo_interno", "Numero_interno"]:
                        val = data.get("codigo_interno", "")
                    elif h in ["Numero_serie", "Patente"]:
                        val = data.get("numero_serie") or data.get("patente", "")
                    elif h in ["Cantidad_minima", "Stock_minimo"]:
                        val = data.get("stock_minimo", 0)
                    elif h == "cantidad":
                        val = data.get("stock_actual", 0)
                    elif h == "elementos_compatibles_ids":
                        comp = data.get("elementos_compatibles_ids", [])
                        val = ",".join(comp) if isinstance(comp, list) else str(comp)
                    elif h == "URL_carpeta":
                        val = data.get("url_carpeta", "")
                    elif h in ["Descripcion", "Detalle", "Observaciones"]:
                        val = data.get("observaciones", "")
                    elif h == "Fecha_hora":
                        val = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
                    row_vals.append(str(val))

                ws.append_row(row_vals)
                logger.info(f"Elemento {nuevo_id} creado en hoja {tab_name}.")
            except Exception as e:
                logger.error(f"Error escribiendo nuevo elemento en Sheets: {e}")

        # Invalidar caché en memoria
        self._memory_cache["data"] = None

        # Registrar en kardex de movimientos
        self.registrar_movimiento({
            "tipo_movimiento": "Alta catálogo",
            "id_elemento": nuevo_id,
            "categoria": categoria,
            "elemento": data.get("nombre", ""),
            "codigo_interno": data.get("codigo_interno", ""),
            "cantidad": float(data.get("stock_actual", 1.0) or 1.0),
            "usuario": "Sistema / Admin",
            "observaciones": "Alta de nuevo elemento en catálogo"
        })

        return data

    def editar_elemento(self, categoria: str, id_elemento: str, data: Dict[str, Any]) -> bool:
        """Modifica los datos de un elemento existente."""
        conf = CATEGORY_CONFIG.get(categoria, CATEGORY_CONFIG["Materiales"])
        tab_name = conf["tab"]

        # Actualizar stock mínimo local si vino especificado
        if "stock_minimo" in data and data["stock_minimo"] is not None:
            save_stock_minimo_local(id_elemento, float(data["stock_minimo"]))

        # Sincronizar en Google Sheets
        if self.is_connected and self.gc:
            try:
                sh = self._open_inventario_sheet()
                ws = sh.worksheet(tab_name)
                headers = ws.row_values(1)
                all_ids = ws.col_values(1)

                try:
                    row_idx = all_ids.index(str(id_elemento)) + 1
                except ValueError:
                    row_idx = None

                if row_idx:
                    current_row = ws.row_values(row_idx)
                    # Completar largo si faltan columnas
                    while len(current_row) < len(headers):
                        current_row.append("")

                    for key, val in data.items():
                        if key == "nombre":
                            pass # compuesto
                        for i, h in enumerate(headers):
                            if h in ["Tipo", "Subtipo", "Clase"] and key == "tipo":
                                current_row[i] = str(val)
                            elif h == "Marca" and key == "marca":
                                current_row[i] = str(val)
                            elif h == "Modelo" and key == "modelo":
                                current_row[i] = str(val)
                            elif h in ["Codigo_interno", "Numero_interno"] and key == "codigo_interno":
                                current_row[i] = str(val)
                            elif h in ["Numero_serie", "Patente"] and (key == "numero_serie" or key == "patente"):
                                current_row[i] = str(val)
                            elif h in ["Cantidad_minima", "Stock_minimo"] and key == "stock_minimo":
                                current_row[i] = str(val)
                            elif h == "elementos_compatibles_ids" and key == "elementos_compatibles_ids":
                                current_row[i] = ",".join(val) if isinstance(val, list) else str(val)
                            elif h == "URL_carpeta" and key == "url_carpeta":
                                current_row[i] = str(val)

                    ws.update(f"A{row_idx}:{gspread.utils.rowcol_to_a1(row_idx, len(headers))}", [current_row])
                    logger.info(f"Elemento {id_elemento} actualizado en Sheets fila {row_idx}.")
            except Exception as e:
                logger.error(f"Error editando elemento en Sheets: {e}")

        self._memory_cache["data"] = None
        return True

    def eliminar_elemento(self, categoria: str, id_elemento: str) -> bool:
        """Marca un elemento como baja en Sheets y lo quita de la caché activa."""
        conf = CATEGORY_CONFIG.get(categoria, CATEGORY_CONFIG["Materiales"])
        tab_name = conf["tab"]

        delete_elemento_catalogo_local(id_elemento)

        if self.is_connected and self.gc:
            try:
                sh = self._open_inventario_sheet()
                ws = sh.worksheet(tab_name)
                headers = ws.row_values(1)
                all_ids = ws.col_values(1)

                try:
                    row_idx = all_ids.index(str(id_elemento)) + 1
                except ValueError:
                    row_idx = None

                if row_idx:
                    baja_col_idx = None
                    for i, h in enumerate(headers):
                        if h in ["Activo_baja", "Ativo_baja", "Estado"]:
                            baja_col_idx = i + 1
                            break

                    if baja_col_idx:
                        ws.update_cell(row_idx, baja_col_idx, "SI")
                        logger.info(f"Elemento {id_elemento} marcado como BAJA en Sheets.")
            except Exception as e:
                logger.error(f"Error marcando baja en Sheets: {e}")

        self._memory_cache["data"] = None

        self.registrar_movimiento({
            "tipo_movimiento": "Baja",
            "id_elemento": id_elemento,
            "categoria": categoria,
            "elemento": f"Elemento #{id_elemento}",
            "usuario": "Sistema / Admin",
            "observaciones": "Baja de catálogo"
        })

        return True

    def marcar_mantenimiento(
        self,
        id_elemento: str,
        tipo_mantenimiento: str,
        fecha_inicio: Optional[str] = None,
        observaciones: str = ""
    ) -> Dict[str, Any]:
        """Marca un elemento como En Mantenimiento con su tipo y fecha de inicio."""
        if not fecha_inicio:
            fecha_inicio = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        res = update_elemento_mantenimiento_local(
            id_elemento=id_elemento,
            en_mantenimiento=True,
            tipo_mantenimiento=tipo_mantenimiento,
            fecha_inicio=fecha_inicio,
            fecha_fin="",
            observaciones=observaciones
        )
        self._memory_cache["data"] = None

        self.registrar_movimiento({
            "tipo_movimiento": "Ingreso a Mantenimiento",
            "id_elemento": id_elemento,
            "categoria": res.get("categoria", "") if res else "",
            "elemento": res.get("nombre", f"Item #{id_elemento}") if res else f"Item #{id_elemento}",
            "codigo_interno": res.get("codigo_interno", "") if res else "",
            "cantidad": 1.0,
            "usuario": "Oficina / Mantenimiento",
            "observaciones": f"Mantenimiento ({tipo_mantenimiento}): {observaciones}".strip()
        })
        return res or {"id": id_elemento, "en_mantenimiento": True, "tipo_mantenimiento": tipo_mantenimiento}

    def finalizar_mantenimiento(
        self,
        id_elemento: str
    ) -> Dict[str, Any]:
        """Finaliza el mantenimiento registrando automáticamente la fecha_fin actual."""
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        res = update_elemento_mantenimiento_local(
            id_elemento=id_elemento,
            en_mantenimiento=False,
            fecha_fin=now_str
        )
        self._memory_cache["data"] = None

        self.registrar_movimiento({
            "tipo_movimiento": "Retorno de Mantenimiento",
            "id_elemento": id_elemento,
            "categoria": res.get("categoria", "") if res else "",
            "elemento": res.get("nombre", f"Item #{id_elemento}") if res else f"Item #{id_elemento}",
            "codigo_interno": res.get("codigo_interno", "") if res else "",
            "cantidad": 1.0,
            "usuario": "Oficina / Mantenimiento",
            "observaciones": f"Reingreso al inventario operativo disponible"
        })
        return res or {"id": id_elemento, "en_mantenimiento": False, "fecha_fin": now_str}

    def actualizar_stock_elemento(
        self,
        categoria: str,
        id_elemento: str,
        nuevo_stock: float,
        observaciones: str = ""
    ) -> Dict[str, Any]:
        """Actualiza directamente el stock actual de un elemento (Materiales, Indumentaria, EPP)."""
        res = update_elemento_stock_local(id_elemento, nuevo_stock)
        self._memory_cache["data"] = None

        # Sincronizar en Sheets si es posible
        if self.is_connected and self.gc:
            try:
                conf = CATEGORY_CONFIG.get(categoria, CATEGORY_CONFIG["Materiales"])
                tab_name = conf["tab"]
                sh = self._open_inventario_sheet()
                ws = sh.worksheet(tab_name)
                headers = ws.row_values(1)
                all_ids = ws.col_values(1)
                if str(id_elemento) in all_ids:
                    row_idx = all_ids.index(str(id_elemento)) + 1
                    for i, h in enumerate(headers):
                        if h.lower() in ["cantidad", "stock_actual", "stock"]:
                            ws.update_cell(row_idx, i + 1, nuevo_stock)
                            break
            except Exception as e:
                logger.warning(f"No se pudo sincronizar nuevo stock en Sheets para {id_elemento}: {e}")

        self.registrar_movimiento({
            "tipo_movimiento": "Ajuste de Stock",
            "id_elemento": id_elemento,
            "categoria": categoria,
            "elemento": res.get("nombre", f"Item #{id_elemento}") if res else f"Item #{id_elemento}",
            "codigo_interno": res.get("codigo_interno", "") if res else "",
            "cantidad": float(nuevo_stock),
            "usuario": "Oficina / Inventario",
            "observaciones": observaciones or f"Ajuste directo de stock a {nuevo_stock}"
        })
        return res or {"id": id_elemento, "stock_actual": nuevo_stock}

    # ----------------------------------------------------------------------
    # SOLICITUDES Y COMPRAS PENDIENTES
    # ----------------------------------------------------------------------

    def _get_or_create_solicitudes_ws(self) -> Optional[gspread.Worksheet]:
        """Obtiene o crea automáticamente la pestaña 'solicitudes_compras'."""
        if not self.is_connected or not self.gc:
            return None
        try:
            sh = self._open_inventario_sheet()
            try:
                return sh.worksheet(SHEET_SOLICITUDES_TAB)
            except gspread.WorksheetNotFound:
                ws = sh.add_worksheet(title=SHEET_SOLICITUDES_TAB, rows=1000, cols=len(SOLICITUDES_COLUMNS) + 2)
                ws.append_row(SOLICITUDES_COLUMNS)
                return ws
        except Exception as e:
            logger.warning(f"No se pudo acceder a '{SHEET_SOLICITUDES_TAB}': {e}")
            return None

    def get_solicitudes(self, filtro_estado: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retorna la lista de solicitudes de compra."""
        ws = self._get_or_create_solicitudes_ws()
        if ws:
            try:
                records = ws.get_all_records(expected_headers=SOLICITUDES_COLUMNS)
                if filtro_estado and filtro_estado.lower() != "todas":
                    records = [r for r in records if str(r.get("estado", "")).lower() == filtro_estado.lower()]
                records.sort(key=lambda x: str(x.get("fecha_hora", "")), reverse=True)
                return records
            except Exception as e:
                logger.error(f"Error leyendo solicitudes de Sheets: {e}")

        return get_solicitudes_local(filtro_estado)

    def crear_solicitud(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nueva solicitud de compra con UUID."""
        req_id = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()
        now_date = now_iso[:10]

        sol_dict = {
            "id_solicitud": req_id,
            "fecha": data.get("fecha") or now_date,
            "solicitante": data.get("solicitante", ""),
            "elemento": data.get("elemento", ""),
            "categoria": data.get("categoria", ""),
            "cantidad": float(data.get("cantidad", 1.0) or 1.0),
            "prioridad": data.get("prioridad", "Media"),
            "id_proyecto": data.get("id_proyecto", ""),
            "proyecto": data.get("proyecto", ""),
            "estado": "Pendiente",
            "observaciones": data.get("observaciones", ""),
            "fecha_hora": now_iso
        }

        save_solicitud_local(sol_dict)

        ws = self._get_or_create_solicitudes_ws()
        if ws:
            try:
                row_vals = [sol_dict.get(c, "") for c in SOLICITUDES_COLUMNS]
                ws.append_row(row_vals)
            except Exception as e:
                logger.error(f"Error escribiendo solicitud en Sheets: {e}")

        return sol_dict

    def actualizar_solicitud(self, id_solicitud: str, estado: str, observaciones: Optional[str] = None) -> bool:
        """Actualiza el estado y observaciones de una solicitud de compra."""
        update_solicitud_local(id_solicitud, estado, observaciones)

        ws = self._get_or_create_solicitudes_ws()
        if ws:
            try:
                all_ids = ws.col_values(1)
                if id_solicitud in all_ids:
                    row_idx = all_ids.index(id_solicitud) + 1
                    estado_col = SOLICITUDES_COLUMNS.index("estado") + 1
                    ws.update_cell(row_idx, estado_col, estado)
                    if observaciones:
                        obs_col = SOLICITUDES_COLUMNS.index("observaciones") + 1
                        ws.update_cell(row_idx, obs_col, observaciones)
            except Exception as e:
                logger.error(f"Error actualizando solicitud en Sheets: {e}")

        return True

    # ----------------------------------------------------------------------
    # MOVIMIENTOS DE STOCK (KARDEX)
    # ----------------------------------------------------------------------
    def _get_or_create_movimientos_ws(self) -> Optional[gspread.Worksheet]:
        """Obtiene o crea automáticamente la pestaña 'movimientos_stock'."""
        if not self.is_connected or not self.gc:
            return None
        try:
            sh = self._open_inventario_sheet()
            try:
                return sh.worksheet(SHEET_MOVIMIENTOS_TAB)
            except gspread.WorksheetNotFound:
                ws = sh.add_worksheet(title=SHEET_MOVIMIENTOS_TAB, rows=2000, cols=len(MOVIMIENTOS_COLUMNS) + 2)
                ws.append_row(MOVIMIENTOS_COLUMNS)
                return ws
        except Exception as e:
            logger.warning(f"No se pudo acceder a '{SHEET_MOVIMIENTOS_TAB}': {e}")
            return None

    def registrar_movimiento(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Registra un movimiento en el Kardex (Salida, Retorno, Ingreso, Ajuste, Baja)."""
        mov_id = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()

        mov_dict = {
            "id_movimiento": mov_id,
            "fecha_hora": data.get("fecha_hora") or now_iso,
            "tipo_movimiento": data.get("tipo_movimiento", "Ingreso"),
            "id_elemento": data.get("id_elemento", ""),
            "categoria": data.get("categoria", ""),
            "elemento": data.get("elemento", ""),
            "codigo_interno": data.get("codigo_interno", ""),
            "cantidad": float(data.get("cantidad", 0.0) or 0.0),
            "id_viaje": data.get("id_viaje", ""),
            "proyecto": data.get("proyecto", ""),
            "usuario": data.get("usuario", ""),
            "observaciones": data.get("observaciones", "")
        }

        save_movimiento_local(mov_dict)

        ws = self._get_or_create_movimientos_ws()
        if ws:
            try:
                row_vals = [mov_dict.get(c, "") for c in MOVIMIENTOS_COLUMNS]
                ws.append_row(row_vals)
            except Exception as e:
                logger.error(f"Error escribiendo movimiento en Sheets: {e}")

        return mov_dict

    def get_movimientos(self, limit: int = 200, filtro_elemento: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retorna el historial de movimientos de stock."""
        ws = self._get_or_create_movimientos_ws()
        if ws:
            try:
                records = ws.get_all_records(expected_headers=MOVIMIENTOS_COLUMNS)
                if filtro_elemento:
                    records = [r for r in records if filtro_elemento.lower() in str(r.get("elemento", "")).lower() or filtro_elemento.lower() in str(r.get("id_elemento", "")).lower()]
                records.sort(key=lambda x: str(x.get("fecha_hora", "")), reverse=True)
                return records[:limit]
            except Exception as e:
                logger.error(f"Error leyendo movimientos de Sheets: {e}")

        return get_movimientos_local(limit, filtro_elemento)

    # ----------------------------------------------------------------------
    # TABLA DESTINO: REGISTRO DE GASTOS (SALIDAS Y RETORNOS)
    # ----------------------------------------------------------------------
    def _get_or_create_registro_gastos_ws(self) -> Optional[gspread.Worksheet]:
        """Obtiene o crea automáticamente la pestaña 'registro_gastos' en Sheets con columnas completas."""
        if not self.is_connected or not self.gc:
            return None

        from backend.config import cargar_configuracion
        cfg = cargar_configuracion()
        sheet_inv = cfg.get("spreadsheet_inventario", SHEET_INVENTARIO_NAME)
        sheet_ros = cfg.get("spreadsheet_roster", SHEET_ROSTER_NAME)

        for target_doc in [sheet_inv, sheet_ros]:
            try:
                sh = self._open_sheet(target_doc)
                try:
                    ws = sh.worksheet(SHEET_REGISTRO_GASTOS_TAB)
                    # Asegurar columnas nuevas en la fila de encabezados si no existen
                    try:
                        headers = ws.row_values(1)
                        if headers:
                            missing = [c for c in REGISTRO_GASTOS_COLUMNS if c not in headers]
                            if missing:
                                logger.info(f"Ampliando encabezados de '{SHEET_REGISTRO_GASTOS_TAB}' con: {missing}")
                                if ws.col_count < len(headers) + len(missing):
                                    ws.add_cols(len(missing) + 2)
                                for col_name in missing:
                                    ws.update_cell(1, len(headers) + 1, col_name)
                                    headers.append(col_name)
                    except Exception as err_h:
                        logger.warning(f"No se pudieron verificar encabezados de registro_gastos: {err_h}")
                    return ws
                except gspread.WorksheetNotFound:
                    logger.info(f"Creando pestaña '{SHEET_REGISTRO_GASTOS_TAB}' en '{target_doc}'...")
                    ws = sh.add_worksheet(title=SHEET_REGISTRO_GASTOS_TAB, rows=2000, cols=len(REGISTRO_GASTOS_COLUMNS) + 2)
                    ws.append_row(REGISTRO_GASTOS_COLUMNS)
                    return ws
            except Exception as e:
                logger.warning(f"No se pudo acceder a '{target_doc}' para registro_gastos: {e}")
                continue
        return None

    def registrar_salida(
        self,
        id_viaje: str,
        proyectos: List[Dict[str, Any]],
        items: List[Dict[str, Any]],
        user_s: str,
        firma_s: str,
        fecha_s: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Registra la salida multiproyecto y asienta los egresos en el Kardex."""
        if not fecha_s:
            fecha_s = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        now_iso = datetime.now().isoformat()
        filas_generadas = []
        proyectos_str = ", ".join([p.get("denominacion", "") for p in proyectos])

        for item in items:
            tipo = item.get("categoria", "")
            elemento = item.get("nombre", "")
            if item.get("codigo_interno"):
                elemento = f"[{item.get('codigo_interno')}] {elemento}"
            unidad_s = float(item.get("unidad_s", 0.0) or 0.0)
            costo_u = float(item.get("costo_u", 0.0) or 0.0)
            u_medida = item.get("unidad_medida") or calcular_unidad_medida(tipo, elemento, item.get("modo_costeo", ""))

            for proj in proyectos:
                id_gasto = str(uuid.uuid4())
                fila = {
                    "id_gasto": id_gasto,
                    "id_viaje": id_viaje,
                    "id_proyecto": str(proj.get("id_proyecto", "")),
                    "proyecto": str(proj.get("denominacion", "")),
                    "tipo": tipo,
                    "elemento": elemento,
                    "fecha_s": fecha_s,
                    "fecha_r": "",
                    "unidad_s": unidad_s,
                    "unidad_r": 0.0,
                    "costo_u": costo_u,
                    "costo_t": 0.0,
                    "user_s": user_s,
                    "firma_s": firma_s,
                    "user_r": "",
                    "firma_r": "",
                    "fecha_hora_s": now_iso,
                    "fecha_hora_r": "",
                    "unidad_medida": u_medida,
                    "fecha_hora": now_iso
                }
                filas_generadas.append(fila)

            # Registrar egreso en Kardex de stock
            self.registrar_movimiento({
                "tipo_movimiento": "Salida",
                "id_elemento": item.get("id", ""),
                "categoria": tipo,
                "elemento": elemento,
                "codigo_interno": item.get("codigo_interno", ""),
                "cantidad": unidad_s,
                "id_viaje": id_viaje,
                "proyecto": proyectos_str,
                "usuario": user_s,
                "observaciones": f"Despacho salida viaje {id_viaje[:8]}"
            })

        # Guardar en SQLite Local
        save_viaje_salida_local(
            id_viaje=id_viaje,
            proyectos=proyectos,
            filas_gastos=filas_generadas,
            user_s=user_s,
            firma_s=firma_s,
            fecha_s=fecha_s
        )

        # Guardar en Google Sheets
        ws = self._get_or_create_registro_gastos_ws()
        if ws:
            try:
                headers = ws.row_values(1)
                header_to_idx = {h.lower().strip(): i for i, h in enumerate(headers)}
                sheet_rows = []
                for f in filas_generadas:
                    row_vals = ["" for _ in range(len(headers))]
                    for k, val in f.items():
                        if k.lower() in header_to_idx:
                            row_vals[header_to_idx[k.lower()]] = val
                    sheet_rows.append(row_vals)
                ws.append_rows(sheet_rows)
                mark_viaje_as_synced(id_viaje)
                logger.info(f"Salida de viaje {id_viaje} registrada en Google Sheets.")
            except Exception as e:
                logger.error(f"Error escribiendo en Google Sheets: {e}. Queda en base local.")

        return filas_generadas

    def registrar_retorno(
        self,
        id_viaje: str,
        items_retorno: List[Dict[str, Any]],
        prorrateos: List[Dict[str, Any]],
        user_r: str,
        firma_r: str,
        fecha_r: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Registra el retorno de viaje, calcula costos con prorrateo y asienta reingreso en Kardex."""
        if not fecha_r:
            fecha_r = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        now_iso = datetime.now().isoformat()

        prorrateo_map = {}
        for p in prorrateos:
            p_id = str(p.get("id_proyecto", ""))
            pct = float(p.get("porcentaje", 0.0)) / 100.0
            prorrateo_map[p_id] = pct

        ws = self._get_or_create_registro_gastos_ws()
        all_records = []
        if ws:
            try:
                all_records = ws.get_all_records()
            except Exception as e:
                logger.warning(f"No se pudo consultar Sheets para retorno: {e}")

        filas_actualizadas = []
        retorno_dict = {str(ir.get("id_gasto")): ir for ir in items_retorno if ir.get("id_gasto")}
        retorno_by_elem = {str(ir.get("elemento")): ir for ir in items_retorno if ir.get("elemento")}

        # 1. Procesar en memoria y calcular
        if all_records:
            for r in all_records:
                if str(r.get("id_viaje")) == id_viaje:
                    g_id = str(r.get("id_gasto"))
                    elem_name = str(r.get("elemento"))
                    ir = retorno_dict.get(g_id) or retorno_by_elem.get(elem_name)
                    
                    if ir:
                        u_r = float(ir.get("unidad_r", 0.0) or 0.0)
                        u_s = float(r.get("unidad_s", 0.0) or 0.0)
                        costo_u = float(r.get("costo_u", 0.0) or 0.0)
                        tipo = str(r.get("tipo", "")).lower()
                        modo_c = str(r.get("modo_costeo", "")).lower()

                        p_id = str(r.get("id_proyecto", ""))
                        pct_aplicable = prorrateo_map.get(p_id, 1.0 / max(len(prorrateos), 1))

                        # Reglas de Costeo según modo de costeo / categoría
                        if "km" in modo_c or ("movilidad" in tipo and not modo_c):
                            # Odómetro: delta km
                            delta = max(0.0, u_r - u_s)
                            costo_t = delta * costo_u * pct_aplicable
                        elif "dias" in modo_c or "días" in modo_c or ("instrumental" in tipo and not modo_c) or ("adicional" in tipo and not modo_c):
                            # Días de uso
                            costo_t = u_r * costo_u * pct_aplicable
                        elif "ciclo" in modo_c or ("dron" in tipo and not modo_c):
                            # Ciclos de batería
                            costo_t = max(0.0, u_r - u_s) * costo_u * pct_aplicable if u_r > u_s else u_r * costo_u * pct_aplicable
                        elif "ning" in modo_c or "sin" in modo_c:
                            costo_t = 0.0
                        else:
                            # Materiales / Herramientas: consumo neto
                            consumo = max(0.0, u_s - u_r)
                            costo_t = consumo * costo_u * pct_aplicable

                        r["unidad_r"] = u_r
                        r["costo_t"] = round(costo_t, 2)
                        r["fecha_r"] = fecha_r
                        r["user_r"] = user_r
                        r["firma_r"] = firma_r
                        r["fecha_hora_r"] = now_iso
                        filas_actualizadas.append(r)

            # Sincronizar actualización en lote en Google Sheets mediante lookup dinámico de columnas
            if ws and filas_actualizadas:
                try:
                    all_ids = ws.col_values(1)
                    headers = ws.row_values(1)
                    header_to_col = {h.lower().strip(): i + 1 for i, h in enumerate(headers)}
                    cell_updates = []
                    for f in filas_actualizadas:
                        g_id = f.get("id_gasto")
                        if g_id in all_ids:
                            row_idx = all_ids.index(g_id) + 1
                            updates = [
                                ("fecha_r", fecha_r),
                                ("unidad_r", f.get("unidad_r")),
                                ("costo_t", f.get("costo_t")),
                                ("user_r", user_r),
                                ("firma_r", firma_r),
                                ("fecha_hora_r", now_iso),
                                ("fecha_hora", now_iso)
                            ]
                            for col_name, val in updates:
                                if col_name in header_to_col:
                                    col_idx = header_to_col[col_name]
                                    a1 = rowcol_to_a1(row_idx, col_idx)
                                    cell_updates.append({"range": a1, "values": [[val]]})
                    if cell_updates:
                        ws.batch_update(cell_updates)
                    logger.info(f"Retorno de viaje {id_viaje} sincronizado en Sheets.")
                except Exception as e:
                    logger.error(f"Error en batch_update retorno: {e}")

        # Si no hubo registros de Sheets, generar desde SQLite local
        if not filas_actualizadas:
            viaje_loc = get_viaje_by_id_local(id_viaje)
            if viaje_loc:
                for g in viaje_loc.get("items", []):
                    g_id = str(g.get("id_gasto"))
                    elem_name = str(g.get("elemento"))
                    ir = retorno_dict.get(g_id) or retorno_by_elem.get(elem_name)
                    u_r = float(ir.get("unidad_r", 0.0) or 0.0) if ir else 0.0
                    u_s = float(g.get("unidad_s", 0.0) or 0.0)
                    costo_u = float(g.get("costo_u", 0.0) or 0.0)
                    p_id = str(g.get("id_proyecto", ""))
                    pct = prorrateo_map.get(p_id, 1.0)
                    tipo = str(g.get("tipo", "")).lower()
                    modo_c = str(g.get("modo_costeo", "")).lower()

                    if "km" in modo_c or ("movilidad" in tipo and not modo_c):
                        delta = max(0.0, u_r - u_s)
                        costo_t = delta * costo_u * pct
                    elif "dias" in modo_c or "días" in modo_c or ("instrumental" in tipo and not modo_c) or ("adicional" in tipo and not modo_c):
                        costo_t = u_r * costo_u * pct
                    elif "ciclo" in modo_c or ("dron" in tipo and not modo_c):
                        costo_t = max(0.0, u_r - u_s) * costo_u * pct if u_r > u_s else u_r * costo_u * pct
                    elif "ning" in modo_c or "sin" in modo_c:
                        costo_t = 0.0
                    else:
                        consumo = max(0.0, u_s - u_r)
                        costo_t = consumo * costo_u * pct

                    filas_actualizadas.append({
                        "id_gasto": g_id,
                        "id_viaje": id_viaje,
                        "unidad_r": u_r,
                        "costo_t": round(costo_t, 2),
                        "fecha_r": fecha_r,
                        "user_r": user_r,
                        "firma_r": firma_r,
                        "fecha_hora": now_iso
                    })

        # Actualizar base de datos local SQLite
        save_viaje_retorno_local(
            id_viaje=id_viaje,
            filas_actualizadas=filas_actualizadas,
            user_r=user_r,
            firma_r=firma_r,
            fecha_r=fecha_r
        )

        # Registrar reingresos en Kardex
        for ir in items_retorno:
            self.registrar_movimiento({
                "tipo_movimiento": "Retorno",
                "id_elemento": str(ir.get("id_gasto") or ""),
                "categoria": "",
                "elemento": str(ir.get("elemento") or "Ítem retornado"),
                "cantidad": float(ir.get("unidad_r", 0.0) or 0.0),
                "id_viaje": id_viaje,
                "usuario": user_r,
                "observaciones": f"Retorno viaje {id_viaje[:8]}"
            })

        return filas_actualizadas

    def get_viajes_activos(self) -> List[Dict[str, Any]]:
        """Retorna los viajes actualmente activos."""
        ws = self._get_or_create_registro_gastos_ws()
        if not ws:
            return get_viajes_activos_local()

        try:
            records = ws.get_all_records()
            viajes_map = {}

            for r in records:
                id_viaje = str(r.get("id_viaje", "")).strip()
                if not id_viaje:
                    continue

                fecha_r = str(r.get("fecha_r", "")).strip()
                if id_viaje not in viajes_map:
                    viajes_map[id_viaje] = {
                        "id_viaje": id_viaje,
                        "fecha_s": r.get("fecha_s", ""),
                        "fecha_r": fecha_r,
                        "user_s": r.get("user_s", ""),
                        "firma_s": r.get("firma_s", ""),
                        "proyectos": set(),
                        "items": []
                    }

                p_name = r.get("proyecto", "")
                if p_name:
                    viajes_map[id_viaje]["proyectos"].add(p_name)

                viajes_map[id_viaje]["items"].append({
                    "id_gasto": r.get("id_gasto", ""),
                    "id_proyecto": r.get("id_proyecto", ""),
                    "proyecto": p_name,
                    "tipo": r.get("tipo", ""),
                    "elemento": r.get("elemento", ""),
                    "unidad_s": r.get("unidad_s", 0),
                    "unidad_r": r.get("unidad_r", 0),
                    "costo_u": r.get("costo_u", 0),
                    "costo_t": r.get("costo_t", 0)
                })

            activos = []
            for v in viajes_map.values():
                if not v["fecha_r"]:
                    v["proyectos"] = sorted(list(v["proyectos"]))
                    activos.append(v)

            activos.sort(key=lambda x: x.get("fecha_s", ""), reverse=True)
            return activos
        except Exception as e:
            logger.error(f"Error consultando viajes activos en Sheets: {e}. Usando local.")
            return get_viajes_activos_local()

    def get_viaje_detalle(self, id_viaje: str) -> Optional[Dict[str, Any]]:
        """Retorna el detalle completo de un viaje (ítems, proyectos, firmas y remito)."""
        # Intentar en SQLite local primero para máxima velocidad y fidelidad
        v = get_viaje_by_id_local(id_viaje)
        if v:
            return v

        # Fallback a Sheets si no estuviera en SQLite
        ws = self._get_or_create_registro_gastos_ws()
        if ws:
            try:
                records = ws.get_all_records()
                trip_records = [r for r in records if str(r.get("id_viaje")) == id_viaje]
                if trip_records:
                    r0 = trip_records[0]
                    proyectos = list({r.get("proyecto") for r in trip_records if r.get("proyecto")})
                    return {
                        "id_viaje": id_viaje,
                        "fecha_s": r0.get("fecha_s", ""),
                        "fecha_r": r0.get("fecha_r", ""),
                        "user_s": r0.get("user_s", ""),
                        "firma_s": r0.get("firma_s", ""),
                        "user_r": r0.get("user_r", ""),
                        "firma_r": r0.get("firma_r", ""),
                        "proyectos": [{"denominacion": p} for p in proyectos],
                        "items": trip_records,
                        "estado": "COMPLETADO" if r0.get("fecha_r") else "ACTIVO"
                    }
            except Exception as e:
                logger.error(f"Error buscando detalle de viaje {id_viaje}: {e}")

        return None

    def get_todos_los_viajes(self) -> List[Dict[str, Any]]:
        """Retorna todos los viajes (activos y finalizados)."""
        return get_todos_los_viajes_local()

# Instancia singleton para el servicio
google_service = GoogleService()
