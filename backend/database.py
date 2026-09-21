import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.config import SQLITE_DB_PATH

logger = logging.getLogger("ingeap.database")

def get_db_connection() -> sqlite3.Connection:
    """Crea y retorna una conexión a la base de datos SQLite local."""
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Inicializa las tablas necesarias en la base de datos SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Tabla de viajes maestros
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS viajes (
                id_viaje TEXT PRIMARY KEY,
                fecha_s TEXT,
                fecha_r TEXT,
                user_s TEXT,
                firma_s TEXT,
                user_r TEXT,
                firma_r TEXT,
                proyectos_json TEXT,
                estado TEXT DEFAULT 'ACTIVO',
                synced_sheets INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        # Tabla de filas de gastos y desglose de items
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gastos_detalle (
                id_gasto TEXT PRIMARY KEY,
                id_viaje TEXT,
                id_proyecto TEXT,
                proyecto TEXT,
                tipo TEXT,
                elemento TEXT,
                fecha_s TEXT,
                fecha_r TEXT,
                unidad_s REAL,
                unidad_r REAL,
                costo_u REAL,
                costo_t REAL,
                user_s TEXT,
                firma_s TEXT,
                user_r TEXT,
                firma_r TEXT,
                fecha_hora TEXT,
                fecha_hora_s TEXT,
                fecha_hora_r TEXT,
                unidad_medida TEXT,
                synced_sheets INTEGER DEFAULT 0,
                FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje)
            )
        """)

        # Migraciones seguras para gastos_detalle
        for col_name in ["fecha_hora_s", "fecha_hora_r", "unidad_medida"]:
            try:
                cursor.execute(f"ALTER TABLE gastos_detalle ADD COLUMN {col_name} TEXT")
            except Exception:
                pass


        # Caché local de catálogo de inventario unificado
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS catalogo_cache (
                id TEXT PRIMARY KEY,
                categoria TEXT,
                codigo_interno TEXT,
                nombre TEXT,
                numero_serie TEXT,
                imagen TEXT,
                raw_data_json TEXT,
                updated_at TEXT
            )
        """)

        # Tabla de solicitudes de compra
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS solicitudes_compras (
                id_solicitud TEXT PRIMARY KEY,
                fecha TEXT,
                solicitante TEXT,
                elemento TEXT,
                categoria TEXT,
                cantidad REAL,
                prioridad TEXT,
                id_proyecto TEXT,
                proyecto TEXT,
                estado TEXT DEFAULT 'Pendiente',
                observaciones TEXT,
                synced_sheets INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        # Tabla de movimientos de stock (Kardex)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS movimientos_stock (
                id_movimiento TEXT PRIMARY KEY,
                fecha_hora TEXT,
                tipo_movimiento TEXT,
                id_elemento TEXT,
                categoria TEXT,
                elemento TEXT,
                codigo_interno TEXT,
                cantidad REAL,
                id_viaje TEXT,
                proyecto TEXT,
                usuario TEXT,
                observaciones TEXT,
                synced_sheets INTEGER DEFAULT 0,
                created_at TEXT
            )
        """)

        # Tabla de configuración de stock mínimo por elemento
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_minimos (
                id_elemento TEXT PRIMARY KEY,
                stock_minimo REAL DEFAULT 0,
                updated_at TEXT
            )
        """)

        # Caché local de proyectos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proyectos_cache (
                id_proyecto TEXT PRIMARY KEY,
                denominacion TEXT,
                area TEXT,
                updated_at TEXT
            )
        """)

        # Caché local de usuarios
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usuarios_cache (
                id_usuario TEXT PRIMARY KEY,
                nombre TEXT,
                email TEXT,
                area TEXT,
                dni TEXT,
                updated_at TEXT
            )
        """)

        # Tabla de sesión activa persistente (ID=1 siempre)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sesion (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                nombre TEXT,
                dni TEXT,
                mail TEXT,
                avatar TEXT,
                area TEXT,
                fecha_login TEXT
            )
        """)

        # Perfiles de empleados con avatar persistente
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS perfiles_empleados (
                dni TEXT PRIMARY KEY,
                nombre TEXT,
                mail TEXT,
                area TEXT,
                avatar TEXT,
                actualizado_en TEXT
            )
        """)

        conn.commit()
        logger.info("Base de datos SQLite local inicializada exitosamente.")
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos SQLite: {e}")
        raise
    finally:
        conn.close()

def save_viaje_salida_local(
    id_viaje: str,
    proyectos: List[Dict[str, Any]],
    filas_gastos: List[Dict[str, Any]],
    user_s: str,
    firma_s: str,
    fecha_s: str
) -> None:
    """Guarda un registro de salida de viaje en SQLite local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO viajes 
            (id_viaje, fecha_s, user_s, firma_s, proyectos_json, estado, synced_sheets, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'ACTIVO', 0, ?, ?)
        """, (
            id_viaje,
            fecha_s,
            user_s,
            firma_s,
            json.dumps(proyectos, ensure_ascii=False),
            now_iso,
            now_iso
        ))

        for fila in filas_gastos:
            f_h_s = fila.get("fecha_hora_s") or fila.get("fecha_hora") or now_iso
            f_h_r = fila.get("fecha_hora_r") or ""
            u_m = fila.get("unidad_medida") or ""
            cursor.execute("""
                INSERT OR REPLACE INTO gastos_detalle (
                    id_gasto, id_viaje, id_proyecto, proyecto, tipo, elemento,
                    fecha_s, fecha_r, unidad_s, unidad_r, costo_u, costo_t,
                    user_s, firma_s, user_r, firma_r, fecha_hora, fecha_hora_s, fecha_hora_r, unidad_medida, synced_sheets
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """, (
                fila.get("id_gasto"),
                id_viaje,
                fila.get("id_proyecto"),
                fila.get("proyecto"),
                fila.get("tipo"),
                fila.get("elemento"),
                fila.get("fecha_s"),
                fila.get("fecha_r") or "",
                float(fila.get("unidad_s", 0.0) or 0.0),
                float(fila.get("unidad_r", 0.0) or 0.0),
                float(fila.get("costo_u", 0.0) or 0.0),
                float(fila.get("costo_t", 0.0) or 0.0),
                fila.get("user_s") or "",
                fila.get("firma_s") or "",
                fila.get("user_r") or "",
                fila.get("firma_r") or "",
                f_h_s,
                f_h_s,
                f_h_r,
                u_m
            ))

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al guardar salida local en SQLite: {e}")
        raise
    finally:
        conn.close()

def save_viaje_retorno_local(
    id_viaje: str,
    filas_actualizadas: List[Dict[str, Any]],
    user_r: str,
    firma_r: str,
    fecha_r: str
) -> None:
    """Actualiza los datos de retorno de un viaje en SQLite local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            UPDATE viajes 
            SET fecha_r = ?, user_r = ?, firma_r = ?, estado = 'RETORNADO', updated_at = ?
            WHERE id_viaje = ?
        """, (fecha_r, user_r, firma_r, now_iso, id_viaje))

        for fila in filas_actualizadas:
            f_h_r = fila.get("fecha_hora_r") or now_iso
            cursor.execute("""
                UPDATE gastos_detalle 
                SET fecha_r = ?, unidad_r = ?, costo_t = ?, user_r = ?, firma_r = ?, fecha_hora_r = ?, fecha_hora = ?
                WHERE id_gasto = ?
            """, (
                fecha_r,
                float(fila.get("unidad_r", 0.0) or 0.0),
                float(fila.get("costo_t", 0.0) or 0.0),
                user_r,
                firma_r,
                f_h_r,
                now_iso,
                fila.get("id_gasto")
            ))

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al actualizar retorno local en SQLite: {e}")
        raise
    finally:
        conn.close()

def update_viaje_items_local(
    id_viaje: str,
    items: List[Dict[str, Any]],
    user_s: Optional[str] = None
) -> Dict[str, Any]:
    """
    Actualiza la lista de elementos asignados a una salida activa en SQLite.
    Elimina los registros no devueltos anteriores de este viaje y regenera las filas
    distribuidas entre los proyectos asignados.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        # 1. Obtener datos del viaje existente
        cursor.execute("SELECT * FROM viajes WHERE id_viaje = ?", (id_viaje,))
        viaje_row = cursor.fetchone()
        if not viaje_row:
            raise ValueError(f"Viaje {id_viaje} no encontrado")
        
        viaje = dict(viaje_row)
        if viaje.get("fecha_r"):
            raise ValueError("No se puede editar un viaje que ya ha sido liquidado/retornado")

        proyectos = []
        if viaje.get("proyectos_json"):
            try:
                proyectos = json.loads(viaje["proyectos_json"])
            except Exception:
                proyectos = []
        
        if not proyectos:
            cursor.execute("SELECT DISTINCT id_proyecto, proyecto FROM gastos_detalle WHERE id_viaje = ?", (id_viaje,))
            p_rows = cursor.fetchall()
            for pr in p_rows:
                proyectos.append({"id_proyecto": pr["id_proyecto"], "denominacion": pr["proyecto"]})

        fecha_s = viaje.get("fecha_s") or now_iso
        firma_s = viaje.get("firma_s") or ""
        resp_s = user_s or viaje.get("user_s") or ""

        # 2. Eliminar filas no retornadas anteriores
        cursor.execute("DELETE FROM gastos_detalle WHERE id_viaje = ? AND (fecha_r IS NULL OR fecha_r = '')", (id_viaje,))

        # 3. Insertar nuevas filas
        filas_generadas = []
        import uuid
        for it in items:
            tipo = it.get("tipo") or it.get("categoria") or ""
            elemento = it.get("elemento") or it.get("nombre") or ""
            cod = it.get("codigo_interno") or ""
            if cod and cod not in elemento:
                elemento = f"[{cod}] {elemento}"
            unidad_s = float(it.get("unidad_s", 0.0) or 0.0)
            costo_u = float(it.get("costo_u", 0.0) or 0.0)
            u_m = it.get("unidad_medida") or ""

            proys_iter = proyectos if proyectos else [{"id_proyecto": "", "denominacion": "General"}]
            for proj in proys_iter:
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
                    "user_s": resp_s,
                    "firma_s": firma_s,
                    "user_r": "",
                    "firma_r": "",
                    "fecha_hora": now_iso,
                    "fecha_hora_s": now_iso,
                    "fecha_hora_r": "",
                    "unidad_medida": u_m,
                    "synced_sheets": 0
                }
                cursor.execute("""
                    INSERT INTO gastos_detalle (
                        id_gasto, id_viaje, id_proyecto, proyecto, tipo, elemento,
                        fecha_s, fecha_r, unidad_s, unidad_r, costo_u, costo_t,
                        user_s, firma_s, user_r, firma_r, fecha_hora, fecha_hora_s, fecha_hora_r, unidad_medida, synced_sheets
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    fila["id_gasto"], fila["id_viaje"], fila["id_proyecto"], fila["proyecto"],
                    fila["tipo"], fila["elemento"], fila["fecha_s"], fila["fecha_r"],
                    fila["unidad_s"], fila["unidad_r"], fila["costo_u"], fila["costo_t"],
                    fila["user_s"], fila["firma_s"], fila["user_r"], fila["firma_r"],
                    fila["fecha_hora"], fila["fecha_hora_s"], fila["fecha_hora_r"], fila["unidad_medida"]
                ))
                filas_generadas.append(fila)

        # 4. Actualizar cabecera del viaje
        cursor.execute("UPDATE viajes SET user_s = ?, updated_at = ?, synced_sheets = 0 WHERE id_viaje = ?", (resp_s, now_iso, id_viaje))
        conn.commit()
        return {
            "success": True,
            "id_viaje": id_viaje,
            "filas": filas_generadas,
            "items_count": len(items)
        }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al actualizar items de viaje {id_viaje} en SQLite: {e}")
        raise
    finally:
        conn.close()

def mark_viaje_as_synced(id_viaje: str) -> None:
    """Marca un viaje y sus detalles como sincronizados con Google Sheets."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE viajes SET synced_sheets = 1 WHERE id_viaje = ?", (id_viaje,))
        cursor.execute("UPDATE gastos_detalle SET synced_sheets = 1 WHERE id_viaje = ?", (id_viaje,))
        conn.commit()
    except Exception as e:
        logger.error(f"Error al marcar viaje {id_viaje} como sincronizado: {e}")
    finally:
        conn.close()

def get_viajes_activos_local() -> List[Dict[str, Any]]:
    """Retorna los viajes que aún no tienen fecha de retorno registrada."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT * FROM viajes WHERE estado = 'ACTIVO' OR fecha_r IS NULL OR fecha_r = ''
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        result = []
        for r in rows:
            v_dict = dict(r)
            if v_dict.get("proyectos_json"):
                try:
                    v_dict["proyectos"] = json.loads(v_dict["proyectos_json"])
                except Exception:
                    v_dict["proyectos"] = []
            
            # Obtener elementos asociados
            cursor.execute("SELECT * FROM gastos_detalle WHERE id_viaje = ?", (v_dict["id_viaje"],))
            item_rows = cursor.fetchall()
            v_dict["items"] = [dict(ir) for ir in item_rows]
            result.append(v_dict)
        return result
    finally:
        conn.close()

def get_viaje_by_id_local(id_viaje: str) -> Optional[Dict[str, Any]]:
    """Obtiene los datos completos de un viaje desde SQLite local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM viajes WHERE id_viaje = ?", (id_viaje,))
        row = cursor.fetchone()
        if not row:
            return None
        v_dict = dict(row)
        if v_dict.get("proyectos_json"):
            try:
                v_dict["proyectos"] = json.loads(v_dict["proyectos_json"])
            except Exception:
                v_dict["proyectos"] = []
        
        cursor.execute("SELECT * FROM gastos_detalle WHERE id_viaje = ?", (id_viaje,))
        item_rows = cursor.fetchall()
        v_dict["items"] = [dict(ir) for ir in item_rows]
        return v_dict
    finally:
        conn.close()

def save_catalogo_cache_local(items: List[Dict[str, Any]]) -> None:
    """Guarda en caché local de SQLite el inventario consolidado."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("DELETE FROM catalogo_cache")
        for item in items:
            cursor.execute("""
                INSERT INTO catalogo_cache (id, categoria, codigo_interno, nombre, numero_serie, imagen, raw_data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(item.get("id")),
                str(item.get("categoria") or ""),
                str(item.get("codigo_interno") or ""),
                str(item.get("nombre") or ""),
                str(item.get("numero_serie") or ""),
                str(item.get("imagen") or ""),
                json.dumps(item, ensure_ascii=False),
                now_iso
            ))
        conn.commit()
    except Exception as e:
        logger.error(f"Error al guardar catálogo en SQLite: {e}")
    finally:
        conn.close()

def get_catalogo_cache_local() -> List[Dict[str, Any]]:
    """Obtiene el catálogo de inventario guardado en SQLite local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT raw_data_json FROM catalogo_cache ORDER BY categoria, nombre")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            try:
                result.append(json.loads(r["raw_data_json"]))
            except Exception:
                pass
        return result
    finally:
        conn.close()

def save_proyectos_usuarios_cache_local(proyectos: List[Dict[str, Any]], usuarios: List[Dict[str, Any]]) -> None:
    """Guarda en SQLite local los proyectos y usuarios."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("DELETE FROM proyectos_cache")
        for p in proyectos:
            cursor.execute("""
                INSERT OR REPLACE INTO proyectos_cache (id_proyecto, denominacion, area, updated_at)
                VALUES (?, ?, ?, ?)
            """, (str(p.get("id_proyecto")), str(p.get("denominacion") or ""), str(p.get("area") or ""), now_iso))

        cursor.execute("DELETE FROM usuarios_cache")
        for u in usuarios:
            cursor.execute("""
                INSERT OR REPLACE INTO usuarios_cache (id_usuario, nombre, email, area, dni, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (str(u.get("id_usuario")), str(u.get("nombre") or ""), str(u.get("email") or ""), str(u.get("area") or ""), str(u.get("dni") or ""), now_iso))
        conn.commit()
    except Exception as e:
        logger.error(f"Error al guardar proyectos/usuarios en SQLite: {e}")
    finally:
        conn.close()

def get_proyectos_usuarios_cache_local() -> Dict[str, List[Dict[str, Any]]]:
    """Obtiene proyectos y usuarios guardados en SQLite local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id_proyecto, denominacion, area FROM proyectos_cache ORDER BY denominacion")
        p_rows = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT id_usuario, nombre, email, area, dni FROM usuarios_cache ORDER BY nombre")
        u_rows = [dict(r) for r in cursor.fetchall()]

        return {"proyectos": p_rows, "usuarios": u_rows}
    finally:
        conn.close()

def get_todos_los_viajes_local() -> List[Dict[str, Any]]:
    """Retorna el historial completo de viajes (activos y finalizados) con sus ítems."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM viajes ORDER BY created_at DESC")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            v_dict = dict(r)
            if v_dict.get("proyectos_json"):
                try:
                    v_dict["proyectos"] = json.loads(v_dict["proyectos_json"])
                except Exception:
                    v_dict["proyectos"] = []
            
            cursor.execute("SELECT * FROM gastos_detalle WHERE id_viaje = ?", (v_dict["id_viaje"],))
            item_rows = cursor.fetchall()
            v_dict["items"] = [dict(ir) for ir in item_rows]
            result.append(v_dict)
        return result
    finally:
        conn.close()

# ----------------------------------------------------------------------
# SOLICITUDES DE COMPRA
# ----------------------------------------------------------------------
def save_solicitud_local(sol: Dict[str, Any]) -> None:
    """Guarda o actualiza una solicitud de compra en SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO solicitudes_compras (
                id_solicitud, fecha, solicitante, elemento, categoria,
                cantidad, prioridad, id_proyecto, proyecto, estado, observaciones,
                synced_sheets, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(sol.get("id_solicitud")),
            str(sol.get("fecha") or now_iso[:10]),
            str(sol.get("solicitante") or ""),
            str(sol.get("elemento") or ""),
            str(sol.get("categoria") or ""),
            float(sol.get("cantidad", 1.0) or 1.0),
            str(sol.get("prioridad") or "Media"),
            str(sol.get("id_proyecto") or ""),
            str(sol.get("proyecto") or ""),
            str(sol.get("estado") or "Pendiente"),
            str(sol.get("observaciones") or ""),
            int(sol.get("synced_sheets", 0)),
            sol.get("created_at") or now_iso,
            now_iso
        ))
        conn.commit()
    finally:
        conn.close()

def get_solicitudes_local(filtro_estado: Optional[str] = None) -> List[Dict[str, Any]]:
    """Obtiene el listado de solicitudes de compras registradas."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if filtro_estado and filtro_estado.lower() != "todas":
            cursor.execute("SELECT * FROM solicitudes_compras WHERE LOWER(estado) = LOWER(?) ORDER BY created_at DESC", (filtro_estado,))
        else:
            cursor.execute("SELECT * FROM solicitudes_compras ORDER BY created_at DESC")
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()

def update_solicitud_local(id_solicitud: str, estado: str, observaciones: Optional[str] = None) -> bool:
    """Actualiza el estado y notas de una solicitud de compra."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        if observaciones is not None:
            cursor.execute("""
                UPDATE solicitudes_compras 
                SET estado = ?, observaciones = ?, updated_at = ?
                WHERE id_solicitud = ?
            """, (estado, observaciones, now_iso, id_solicitud))
        else:
            cursor.execute("""
                UPDATE solicitudes_compras 
                SET estado = ?, updated_at = ?
                WHERE id_solicitud = ?
            """, (estado, now_iso, id_solicitud))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

# ----------------------------------------------------------------------
# MOVIMIENTOS DE STOCK (KARDEX)
# ----------------------------------------------------------------------
def save_movimiento_local(mov: Dict[str, Any]) -> None:
    """Registra un movimiento en el kardex de stock."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO movimientos_stock (
                id_movimiento, fecha_hora, tipo_movimiento, id_elemento, categoria,
                elemento, codigo_interno, cantidad, id_viaje, proyecto, usuario,
                observaciones, synced_sheets, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(mov.get("id_movimiento")),
            mov.get("fecha_hora") or now_iso,
            str(mov.get("tipo_movimiento") or "Ingreso"),
            str(mov.get("id_elemento") or ""),
            str(mov.get("categoria") or ""),
            str(mov.get("elemento") or ""),
            str(mov.get("codigo_interno") or ""),
            float(mov.get("cantidad", 0.0) or 0.0),
            str(mov.get("id_viaje") or ""),
            str(mov.get("proyecto") or ""),
            str(mov.get("usuario") or ""),
            str(mov.get("observaciones") or ""),
            int(mov.get("synced_sheets", 0)),
            now_iso
        ))
        conn.commit()
    finally:
        conn.close()

def get_movimientos_local(limit: int = 200, filtro_elemento: Optional[str] = None) -> List[Dict[str, Any]]:
    """Obtiene los últimos movimientos de stock registrados."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if filtro_elemento:
            cursor.execute("""
                SELECT * FROM movimientos_stock 
                WHERE id_elemento = ? OR elemento LIKE ?
                ORDER BY fecha_hora DESC LIMIT ?
            """, (filtro_elemento, f"%{filtro_elemento}%", limit))
        else:
            cursor.execute("SELECT * FROM movimientos_stock ORDER BY fecha_hora DESC LIMIT ?", (limit,))
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()

# ----------------------------------------------------------------------
# STOCK MÍNIMO POR ELEMENTO
# ----------------------------------------------------------------------
def save_stock_minimo_local(id_elemento: str, stock_minimo: float) -> None:
    """Configura el stock mínimo deseado para un elemento."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO stock_minimos (id_elemento, stock_minimo, updated_at)
            VALUES (?, ?, ?)
        """, (str(id_elemento), float(stock_minimo), now_iso))
        conn.commit()
    finally:
        conn.close()

def get_stock_minimos_local() -> Dict[str, float]:
    """Retorna un diccionario { id_elemento: stock_minimo }."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id_elemento, stock_minimo FROM stock_minimos")
        return {r["id_elemento"]: float(r["stock_minimo"]) for r in cursor.fetchall()}
    finally:
        conn.close()

# ----------------------------------------------------------------------
# CRUD ELEMENTOS EN CACHE LOCAL
# ----------------------------------------------------------------------
def save_elemento_catalogo_local(item: Dict[str, Any]) -> None:
    """Agrega o actualiza un elemento individual en la caché local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO catalogo_cache (id, categoria, codigo_interno, nombre, numero_serie, imagen, raw_data_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(item.get("id")),
            str(item.get("categoria") or ""),
            str(item.get("codigo_interno") or ""),
            str(item.get("nombre") or ""),
            str(item.get("numero_serie") or ""),
            str(item.get("imagen") or ""),
            json.dumps(item, ensure_ascii=False),
            now_iso
        ))
        conn.commit()
    finally:
        conn.close()

def delete_elemento_catalogo_local(id_elemento: str) -> None:
    """Elimina o da de baja un elemento de la caché local."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM catalogo_cache WHERE id = ?", (str(id_elemento),))
        conn.commit()
    finally:
        conn.close()

def update_elemento_mantenimiento_local(
    id_elemento: str,
    en_mantenimiento: bool,
    tipo_mantenimiento: str = "",
    fecha_inicio: str = "",
    fecha_fin: str = "",
    observaciones: str = ""
) -> Optional[Dict[str, Any]]:
    """Actualiza los datos de mantenimiento de un elemento en catalogo_cache."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("SELECT raw_data_json FROM catalogo_cache WHERE id = ?", (str(id_elemento),))
        row = cursor.fetchone()
        if not row:
            return None
        data = json.loads(row["raw_data_json"])
        data["en_mantenimiento"] = bool(en_mantenimiento)
        data["tipo_mantenimiento"] = tipo_mantenimiento
        data["fecha_inicio_mantenimiento"] = fecha_inicio
        data["fecha_fin_mantenimiento"] = fecha_fin
        if observaciones:
            data["observaciones_mantenimiento"] = observaciones
        
        cursor.execute("""
            UPDATE catalogo_cache 
            SET raw_data_json = ?, updated_at = ?
            WHERE id = ?
        """, (json.dumps(data, ensure_ascii=False), now_iso, str(id_elemento)))
        conn.commit()
        return data
    finally:
        conn.close()

def update_elemento_stock_local(
    id_elemento: str,
    nuevo_stock: float
) -> Optional[Dict[str, Any]]:
    """Actualiza el stock actual de un elemento en catalogo_cache."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("SELECT raw_data_json FROM catalogo_cache WHERE id = ?", (str(id_elemento),))
        row = cursor.fetchone()
        if not row:
            return None
        data = json.loads(row["raw_data_json"])
        data["stock_actual"] = float(nuevo_stock)
        cursor.execute("""
            UPDATE catalogo_cache 
            SET raw_data_json = ?, updated_at = ?
            WHERE id = ?
        """, (json.dumps(data, ensure_ascii=False), now_iso, str(id_elemento)))
        conn.commit()
        return data
    finally:
        conn.close()


# ----------------------------------------------------------------------
# SESION Y PERFILES DE USUARIO (Persistencia offline estilo ReporteDiario)
# ----------------------------------------------------------------------
def obtener_sesion_activa() -> Optional[Dict[str, Any]]:
    """Recupera la sesión guardada en SQLite (ID=1)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM sesion WHERE id = 1")
        row = cursor.fetchone()
        if row:
            sesion = dict(row)
            dni = sesion.get("dni")
            if dni:
                cursor.execute("SELECT avatar FROM perfiles_empleados WHERE dni = ?", (dni,))
                p_row = cursor.fetchone()
                if p_row and p_row["avatar"]:
                    sesion["avatar"] = p_row["avatar"]
            return sesion
        return None
    finally:
        conn.close()

def guardar_sesion_activa(nombre: str, dni: str, mail: str = "", avatar: str = "", area: str = "") -> None:
    """Persiste la sesión activa del usuario."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO sesion (id, nombre, dni, mail, avatar, area, fecha_login)
            VALUES (1, ?, ?, ?, ?, ?, ?)
        """, (nombre, dni, mail, avatar, area, now_iso))

        cursor.execute("""
            INSERT INTO perfiles_empleados (dni, nombre, mail, area, avatar, actualizado_en)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(dni) DO UPDATE SET
                nombre = excluded.nombre,
                mail = excluded.mail,
                area = excluded.area,
                avatar = CASE WHEN excluded.avatar != '' THEN excluded.avatar ELSE perfiles_empleados.avatar END,
                actualizado_en = excluded.actualizado_en
        """, (dni, nombre, mail, area, avatar, now_iso))
        conn.commit()
    finally:
        conn.close()

def borrar_sesion() -> None:
    """Elimina la sesión activa actual."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM sesion WHERE id = 1")
        conn.commit()
    finally:
        conn.close()

def obtener_avatar_por_dni(dni: str) -> str:
    """Recupera el avatar en Base64 asociado al DNI."""
    if not dni:
        return ""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT avatar FROM perfiles_empleados WHERE dni = ?", (dni.strip(),))
        row = cursor.fetchone()
        return row["avatar"] if row and row["avatar"] else ""
    finally:
        conn.close()

