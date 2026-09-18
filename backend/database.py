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
                synced_sheets INTEGER DEFAULT 0,
                FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje)
            )
        """)

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
            cursor.execute("""
                INSERT OR REPLACE INTO gastos_detalle (
                    id_gasto, id_viaje, id_proyecto, proyecto, tipo, elemento,
                    fecha_s, fecha_r, unidad_s, unidad_r, costo_u, costo_t,
                    user_s, firma_s, user_r, firma_r, fecha_hora, synced_sheets
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
                fila.get("fecha_hora") or now_iso
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
            cursor.execute("""
                UPDATE gastos_detalle 
                SET fecha_r = ?, unidad_r = ?, costo_t = ?, user_r = ?, firma_r = ?, fecha_hora = ?
                WHERE id_gasto = ?
            """, (
                fecha_r,
                float(fila.get("unidad_r", 0.0) or 0.0),
                float(fila.get("costo_t", 0.0) or 0.0),
                user_r,
                firma_r,
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
                INSERT INTO proyectos_cache (id_proyecto, denominacion, area, updated_at)
                VALUES (?, ?, ?, ?)
            """, (str(p.get("id_proyecto")), str(p.get("denominacion") or ""), str(p.get("area") or ""), now_iso))

        cursor.execute("DELETE FROM usuarios_cache")
        for u in usuarios:
            cursor.execute("""
                INSERT INTO usuarios_cache (id_usuario, nombre, email, area, dni, updated_at)
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
