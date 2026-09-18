import os
import io
import time
import base64
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from backend.config import (
    CREDENTIALS_FILE,
    SHEET_INVENTARIO_NAME,
    SHEET_ROSTER_NAME,
    SHEET_REGISTRO_GASTOS_TAB,
    CATALOG_TABS,
    DRIVE_SIGNATURES_FOLDER_ID,
    CACHE_TTL_SECONDS,
    UPLOADS_DIR
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
    get_viaje_by_id_local
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
    "fecha_hora"
]

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

    def init_clients(self) -> bool:
        """Inicializa los clientes de Google Sheets y Google Drive."""
        if not os.path.exists(CREDENTIALS_FILE):
            logger.warning(f"Archivo de credenciales de Google no encontrado en {CREDENTIALS_FILE}. Operando en modo local/contingencia.")
            self.is_connected = False
            return False

        try:
            self.credentials = Credentials.from_service_account_file(
                CREDENTIALS_FILE,
                scopes=SCOPES
            )
            self.gc = gspread.authorize(self.credentials)
            self.drive_service = build("drive", "v3", credentials=self.credentials, cache_discovery=False)
            self.is_connected = True
            logger.info("Clientes de Google Sheets y Drive conectados exitosamente.")
            return True
        except Exception as e:
            logger.error(f"Error al autenticar con Google APIs: {e}")
            self.is_connected = False
            return False

    def check_connection(self) -> Dict[str, Any]:
        """Comprueba el estado de la conexión a Google Sheets y Drive."""
        if not self.is_connected and os.path.exists(CREDENTIALS_FILE):
            self.init_clients()

        status = {
            "connected": self.is_connected,
            "inventario_ok": False,
            "roster_ok": False,
            "drive_ok": False,
            "credentials_path": CREDENTIALS_FILE,
            "credentials_exists": os.path.exists(CREDENTIALS_FILE)
        }

        if not self.is_connected or not self.gc:
            return status

        try:
            self.gc.open(SHEET_INVENTARIO_NAME)
            status["inventario_ok"] = True
        except Exception as e:
            logger.warning(f"No se pudo abrir hoja de inventario '{SHEET_INVENTARIO_NAME}': {e}")

        try:
            self.gc.open(SHEET_ROSTER_NAME)
            status["roster_ok"] = True
        except Exception as e:
            logger.warning(f"No se pudo abrir hoja de roster '{SHEET_ROSTER_NAME}': {e}")

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
        Decodifica la firma Base64, guarda copia local y la sube a Google Drive.
        Retorna una tupla: (enlace_publico_o_local, ruta_local).
        """
        try:
            # Limpiar header Data URL si existe
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]

            image_bytes = base64.b64decode(base64_str)
            filename = f"{filename_prefix}_{uuid.uuid4().hex[:8]}_{int(time.time())}.png"
            local_path = UPLOADS_DIR / filename

            # Guardar siempre copia local para remitos rápidos y offline
            with open(local_path, "wb") as f:
                f.write(image_bytes)

            drive_url = f"/api/uploads/firmas/{filename}"

            # Si hay conexión a Google Drive, subir y hacer pública
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

                    # Asignar permisos públicos de lectura
                    self.drive_service.permissions().create(
                        fileId=file_id,
                        body={"type": "anyone", "role": "reader"}
                    ).execute()

                    drive_url = uploaded_file.get("webContentLink") or uploaded_file.get("webViewLink") or drive_url
                    logger.info(f"Firma subida a Google Drive con éxito: {drive_url}")
                except Exception as e:
                    logger.warning(f"No se pudo subir la firma a Drive (usando ruta local): {e}")

            return drive_url, str(local_path)
        except Exception as e:
            logger.error(f"Error procesando firma base64: {e}")
            return "", ""

    # ----------------------------------------------------------------------
    # LECTURA DE CATÁLOGOS (SHEETS -> FORMATO UNIFICADO)
    # ----------------------------------------------------------------------
    def get_catalogos(self, recargar: bool = False) -> Dict[str, Any]:
        """
        Retorna proyectos, usuarios, inventario unificado y categorías.
        Utiliza caché de 5 minutos o SQLite local si no hay conexión.
        """
        now = time.time()
        if not recargar and self._memory_cache["data"] and now < self._memory_cache["expires_at"]:
            return self._memory_cache["data"]

        if not self.is_connected or not self.gc:
            # Respaldo desde SQLite local
            local_cat = get_catalogo_cache_local()
            local_meta = get_proyectos_usuarios_cache_local()
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
            # 1. Leer Proyectos y Usuarios desde BBDD_asist_roster
            proyectos = self._read_proyectos()
            usuarios = self._read_usuarios()
            save_proyectos_usuarios_cache_local(proyectos, usuarios)

            # 2. Leer Inventario v1.5 y unificar
            inventario = self._read_inventario_unified()
            save_catalogo_cache_local(inventario)

            categorias = sorted(list({item.get("categoria", "") for item in inventario if item.get("categoria")}))

            result = {
                "proyectos": proyectos,
                "usuarios": usuarios,
                "inventario": inventario,
                "categorias": categorias,
                "origen": "google_sheets",
                "timestamp": datetime.now().isoformat()
            }

            # Actualizar caché en memoria
            self._memory_cache["data"] = result
            self._memory_cache["expires_at"] = now + CACHE_TTL_SECONDS
            return result

        except Exception as e:
            logger.error(f"Error consultando Google Sheets, recurriendo a base local: {e}")
            local_cat = get_catalogo_cache_local()
            local_meta = get_proyectos_usuarios_cache_local()
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
            sh = self.gc.open(SHEET_ROSTER_NAME)
            ws = sh.worksheet("0_proyectos")
            records = ws.get_all_records()
            proyectos = []
            for r in records:
                # Normalizar claves
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
            sh = self.gc.open(SHEET_ROSTER_NAME)
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

    def _is_baja(self, row: Dict[str, Any]) -> bool:
        """Determina si un ítem está dado de baja según las columnas de baja."""
        for col_name in ["Activo_baja", "Ativo_baja", "activo_baja", "ativo_baja", "Estado"]:
            val = str(row.get(col_name, "")).strip().upper()
            if val in ["SI", "TRUE", "1", "BAJA", "INACTIVO", "DESACTIVADO"]:
                return True
        return False

    def _read_inventario_unified(self) -> List[Dict[str, Any]]:
        """Lee todas las 8 pestañas de Inventario v1.5 y las unifica."""
        unified_items = []
        try:
            sh = self.gc.open(SHEET_INVENTARIO_NAME)
        except Exception as e:
            logger.error(f"No se pudo abrir '{SHEET_INVENTARIO_NAME}': {e}")
            return []

        for tab_name in CATALOG_TABS:
            try:
                ws = sh.worksheet(tab_name)
                rows = ws.get_all_records()
                categoria_limpia = tab_name.split("_", 2)[-1]  # ej: 'Instrumental' de '2_0_Instrumental'

                for r in rows:
                    if self._is_baja(r):
                        continue

                    # Extraer campos según la pestaña
                    item_id = ""
                    codigo_int = str(r.get("Codigo_interno") or r.get("Numero_interno") or "").strip()
                    nombre_partes = []
                    n_serie = str(r.get("Numero_serie") or r.get("Patente") or "").strip()
                    imagen = str(r.get("Imagen") or "").strip()

                    if tab_name == "1_0_Indumentaria":
                        item_id = str(r.get("ID_indumentaria", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        nombre_partes = [tipo, marca, modelo]
                    elif tab_name == "2_0_Instrumental":
                        item_id = str(r.get("ID_instrumental", ""))
                        subtipo = str(r.get("Subtipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        nombre_partes = [subtipo, marca, modelo]
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
                    elif tab_name == "3_0_Movilidad":
                        item_id = str(r.get("ID_movilidad", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        patente = str(r.get("Patente", "")).strip()
                        nombre_partes = [tipo, marca, modelo, f"({patente})" if patente else ""]
                    elif tab_name == "4_0_Informatica":
                        item_id = str(r.get("ID_informatica", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        modelo = str(r.get("Modelo", "")).strip()
                        prest = str(r.get("Prestaciones", "")).strip()
                        nombre_partes = [tipo, marca, modelo, f"[{prest}]" if prest else ""]
                    elif tab_name == "5_0_Herramientas":
                        item_id = str(r.get("ID_herramienta", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        nombre_partes = [tipo, marca]
                    elif tab_name == "6_0_Materiales":
                        item_id = str(r.get("ID_material", ""))
                        tipo = str(r.get("Tipo", "")).strip()
                        marca = str(r.get("Marca", "")).strip()
                        det = str(r.get("Detalle", "")).strip()
                        nombre_partes = [tipo, marca, det]
                    else:
                        item_id = str(list(r.values())[0]) if r else ""
                        nombre_partes = [str(v) for v in list(r.values())[1:4]]

                    nombre = " ".join([p for p in nombre_partes if p]).strip()
                    if not nombre and item_id:
                        nombre = f"{categoria_limpia} #{item_id}"

                    if not item_id and not codigo_int and not nombre:
                        continue

                    # ID único compuesto si faltara
                    final_id = item_id if item_id else f"{categoria_limpia}_{codigo_int or uuid.uuid4().hex[:6]}"

                    unified_items.append({
                        "id": final_id,
                        "categoria": categoria_limpia,
                        "codigo_interno": codigo_int,
                        "nombre": nombre,
                        "numero_serie": n_serie,
                        "imagen": imagen
                    })
            except Exception as e:
                logger.warning(f"No se pudo procesar pestaña '{tab_name}': {e}")
                continue

        return unified_items

    # ----------------------------------------------------------------------
    # TABLA DESTINO: REGISTRO DE GASTOS (ESCRITURA)
    # ----------------------------------------------------------------------
    def _get_or_create_registro_gastos_ws(self) -> Optional[gspread.Worksheet]:
        """Obtiene o crea automáticamente la pestaña 'registro_gastos' en Sheets."""
        if not self.is_connected or not self.gc:
            return None

        # Intentar en hoja Inventario v1.5, o Roster si no estuviera disponible
        for target_doc in [SHEET_INVENTARIO_NAME, SHEET_ROSTER_NAME]:
            try:
                sh = self.gc.open(target_doc)
                try:
                    ws = sh.worksheet(SHEET_REGISTRO_GASTOS_TAB)
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
        """
        Registra la salida multiproyecto:
        Genera 1 fila por ítem x cada proyecto con el mismo id_viaje.
        Guarda en SQLite local y en Google Sheets si hay conexión.
        """
        if not fecha_s:
            fecha_s = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        now_iso = datetime.now().isoformat()
        filas_generadas = []

        for item in items:
            tipo = item.get("categoria", "")
            elemento = item.get("nombre", "")
            if item.get("codigo_interno"):
                elemento = f"[{item.get('codigo_interno')}] {elemento}"
            unidad_s = float(item.get("unidad_s", 0.0) or 0.0)
            costo_u = float(item.get("costo_u", 0.0) or 0.0)

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
                    "fecha_hora": now_iso
                }
                filas_generadas.append(fila)

        # 1. Guardar en SQLite Local (resiliencia)
        save_viaje_salida_local(
            id_viaje=id_viaje,
            proyectos=proyectos,
            filas_gastos=filas_generadas,
            user_s=user_s,
            firma_s=firma_s,
            fecha_s=fecha_s
        )

        # 2. Guardar en Google Sheets si está disponible
        ws = self._get_or_create_registro_gastos_ws()
        if ws:
            try:
                sheet_rows = []
                for f in filas_generadas:
                    row_vals = [f.get(col, "") for col in REGISTRO_GASTOS_COLUMNS]
                    sheet_rows.append(row_vals)
                ws.append_rows(sheet_rows)
                mark_viaje_as_synced(id_viaje)
                logger.info(f"Salida de viaje {id_viaje} registrada exitosamente en Google Sheets.")
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
        """
        Registra el retorno de viaje, calcula costos con prorrateo porcentual y
        actualiza SQLite y Google Sheets mediante batch_update.
        """
        if not fecha_r:
            fecha_r = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        now_iso = datetime.now().isoformat()

        # Diccionario de porcentajes por id_proyecto: { "proj1": 0.50, "proj2": 0.50 }
        prorrateo_map = {}
        for p in prorrateos:
            p_id = str(p.get("id_proyecto", ""))
            pct = float(p.get("porcentaje", 0.0)) / 100.0
            prorrateo_map[p_id] = pct

        # Mapa de lecturas de retorno por elemento / id_gasto
        unidades_r_map = {}
        for it in items_retorno:
            if it.get("id_gasto"):
                unidades_r_map[str(it.get("id_gasto"))] = float(it.get("unidad_r", 0.0))
            if it.get("elemento"):
                unidades_r_map[str(it.get("elemento"))] = float(it.get("unidad_r", 0.0))

        # 1. Obtener filas existentes en Google Sheets o en SQLite local
        ws = self._get_or_create_registro_gastos_ws()
        filas_actualizadas = []

        if ws:
            try:
                records = ws.get_all_records()
                # Encontrar índices de filas en la hoja (1-indexed, más fila de encabezado = row_index + 2)
                updates_to_batch = []
                
                # Columnas a actualizar:
                # 8: fecha_r, 10: unidad_r, 12: costo_t, 15: user_r, 16: firma_r, 17: fecha_hora
                col_fecha_r_idx = REGISTRO_GASTOS_COLUMNS.index("fecha_r") + 1
                col_unidad_r_idx = REGISTRO_GASTOS_COLUMNS.index("unidad_r") + 1
                col_costo_t_idx = REGISTRO_GASTOS_COLUMNS.index("costo_t") + 1
                col_user_r_idx = REGISTRO_GASTOS_COLUMNS.index("user_r") + 1
                col_firma_r_idx = REGISTRO_GASTOS_COLUMNS.index("firma_r") + 1
                col_fecha_hora_idx = REGISTRO_GASTOS_COLUMNS.index("fecha_hora") + 1

                for idx, r in enumerate(records):
                    if str(r.get("id_viaje", "")).strip() == id_viaje:
                        row_num = idx + 2
                        id_gasto = str(r.get("id_gasto", ""))
                        elem = str(r.get("elemento", ""))
                        id_proj = str(r.get("id_proyecto", ""))

                        unidad_s = float(r.get("unidad_s", 0.0) or 0.0)
                        costo_u = float(r.get("costo_u", 0.0) or 0.0)

                        # Buscar unidad de retorno ingresada
                        unidad_r = unidades_r_map.get(id_gasto, unidades_r_map.get(elem, unidad_s))
                        pct = prorrateo_map.get(id_proj, 1.0 / max(1, len(prorrateo_map)))

                        # Fórmula de negocio: (unidad_r - unidad_s) * costo_u * porcentaje
                        diff = max(0.0, unidad_r - unidad_s)
                        costo_t = round(diff * costo_u * pct, 2)

                        filas_actualizadas.append({
                            "id_gasto": id_gasto,
                            "id_viaje": id_viaje,
                            "id_proyecto": id_proj,
                            "unidad_r": unidad_r,
                            "costo_t": costo_t,
                            "user_r": user_r,
                            "firma_r": firma_r,
                            "fecha_r": fecha_r,
                            "fecha_hora": now_iso
                        })

                        # Celdas para batch update
                        updates_to_batch.extend([
                            {"range": gspread.utils.rowcol_to_a1(row_num, col_fecha_r_idx), "values": [[fecha_r]]},
                            {"range": gspread.utils.rowcol_to_a1(row_num, col_unidad_r_idx), "values": [[unidad_r]]},
                            {"range": gspread.utils.rowcol_to_a1(row_num, col_costo_t_idx), "values": [[costo_t]]},
                            {"range": gspread.utils.rowcol_to_a1(row_num, col_user_r_idx), "values": [[user_r]]},
                            {"range": gspread.utils.rowcol_to_a1(row_num, col_firma_r_idx), "values": [[firma_r]]},
                            {"range": gspread.utils.rowcol_to_a1(row_num, col_fecha_hora_idx), "values": [[now_iso]]}
                        ])

                if updates_to_batch:
                    ws.batch_update(updates_to_batch)
                    logger.info(f"Retorno de viaje {id_viaje} actualizado exitosamente en Google Sheets con batch_update.")
            except Exception as e:
                logger.error(f"Error realizando batch_update en Sheets para retorno: {e}")

        # Si no había filas en Sheets o falló, calcular y actualizar desde base local
        if not filas_actualizadas:
            from backend.database import get_viaje_by_id_local
            v_local = get_viaje_by_id_local(id_viaje)
            if v_local and "items" in v_local:
                for item in v_local["items"]:
                    id_gasto = item.get("id_gasto")
                    elem = item.get("elemento")
                    id_proj = item.get("id_proyecto")
                    unidad_s = float(item.get("unidad_s", 0.0) or 0.0)
                    costo_u = float(item.get("costo_u", 0.0) or 0.0)
                    unidad_r = unidades_r_map.get(id_gasto, unidades_r_map.get(elem, unidad_s))
                    pct = prorrateo_map.get(id_proj, 1.0 / max(1, len(prorrateo_map)))
                    diff = max(0.0, unidad_r - unidad_s)
                    costo_t = round(diff * costo_u * pct, 2)

                    filas_actualizadas.append({
                        "id_gasto": id_gasto,
                        "unidad_r": unidad_r,
                        "costo_t": costo_t,
                        "user_r": user_r,
                        "firma_r": firma_r,
                        "fecha_r": fecha_r,
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

        return filas_actualizadas

    def get_viajes_activos(self) -> List[Dict[str, Any]]:
        """
        Retorna la lista de viajes actualmente activos (sin retorno registrado).
        Combina datos de Google Sheets o base SQLite local.
        """
        ws = self._get_or_create_registro_gastos_ws()
        if not ws:
            return get_viajes_activos_local()

        try:
            records = ws.get_all_records(expected_headers=REGISTRO_GASTOS_COLUMNS)
            viajes_map = {}

            for r in records:
                id_viaje = str(r.get("id_viaje", "")).strip()
                if not id_viaje:
                    continue

                fecha_r = str(r.get("fecha_r", "")).strip()
                # Si algún ítem de este viaje no tiene fecha_r, se considera activo
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

# Instancia singleton para el servicio
google_service = GoogleService()
