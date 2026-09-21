import os
import sys
import json
import re
import shutil
from pathlib import Path
from typing import Dict, Any

# 1. Detección de entorno empaquetado (PyInstaller)
IS_FROZEN = getattr(sys, 'frozen', False)

def recurso_path(ruta_relativa: str) -> Path:
    """Obtiene la ruta absoluta para un recurso, compatible con PyInstaller y desarrollo."""
    if IS_FROZEN:
        base_path = Path(sys._MEIPASS)
    else:
        base_path = Path(__file__).resolve().parent.parent
    return base_path / ruta_relativa

def obtener_directorio_datos() -> Path:
    """
    Retorna el directorio seguro y permanente de datos en Windows (%LOCALAPPDATA%\\Ingeap\\Inventario).
    Es inmune a limpiezas de carpetas temporales y restricciones de permisos.
    """
    appdata = os.environ.get("LOCALAPPDATA")
    if not appdata:
        appdata = os.environ.get("APPDATA")
    if not appdata:
        appdata = os.path.expanduser("~")
    
    dir_datos = Path(appdata) / "Ingeap" / "Inventario"
    dir_datos.mkdir(parents=True, exist_ok=True)
    return dir_datos

# Directorio base de datos permanente en AppData
DATA_DIR = obtener_directorio_datos()
UPLOADS_DIR = DATA_DIR / "firmas"
PDFS_DIR = DATA_DIR / "remitos_pdf"
DOCS_DIR = DATA_DIR / "documentos"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
PDFS_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Rutas de frontend dist
if IS_FROZEN:
    STATIC_DIR = Path(sys._MEIPASS) / "frontend" / "dist"
    if not STATIC_DIR.exists():
        STATIC_DIR = Path(sys._MEIPASS) / "dist"
    PROJECT_ROOT = Path(sys.executable).parent
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent
    STATIC_DIR = PROJECT_ROOT / "frontend" / "dist"

# Base de datos SQLite permanente en AppData
SQLITE_DB_PATH = str(DATA_DIR / "inventario_local.db")

# Migración defensiva si existía base de datos en carpetas previas
ruta_db_appdata = Path(SQLITE_DB_PATH)
if not ruta_db_appdata.exists():
    posibles_previos = [
        PROJECT_ROOT / "data" / "inventario_local.db",
        Path(__file__).resolve().parent.parent / "data" / "inventario_local.db"
    ]
    for previo in posibles_previos:
        if previo.exists():
            try:
                shutil.copy2(str(previo), str(ruta_db_appdata))
                print(f"[Config] BD previa migrada exitosamente desde {previo} a {ruta_db_appdata}")
                break
            except Exception as e:
                print(f"[Config] Aviso al migrar BD previa: {e}")

# Gestión de Archivo de Configuración config.json
RUTA_CONFIG_USER = DATA_DIR / "config.json"
RUTA_CONFIG_BUNDLE = recurso_path("backend/config.json")
if not RUTA_CONFIG_BUNDLE.exists():
    RUTA_CONFIG_BUNDLE = recurso_path("config.json")

def cargar_configuracion() -> Dict[str, Any]:
    """Lee config.json desde AppData con fallback a los recursos empaquetados."""
    if RUTA_CONFIG_USER.exists():
        try:
            with open(RUTA_CONFIG_USER, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    if RUTA_CONFIG_BUNDLE.exists():
        try:
            with open(RUTA_CONFIG_BUNDLE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    return {
        "spreadsheet_inventario": "Inventario v1.5 - Dev",
        "spreadsheet_roster": "BBDD_asist_roster",
        "credentials_file": "credentials.json",
        "drive_signatures_folder_id": "",
        "github_repo": "Aterian/RegistroInventario"
    }

def guardar_configuracion(config: Dict[str, Any]) -> None:
    """Guarda la configuración modificada por el usuario en AppData."""
    try:
        with open(RUTA_CONFIG_USER, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Config] Error guardando config en AppData: {e}")

def extraer_spreadsheet_id(texto_o_url: str) -> str:
    """Extrae el ID único del Google Sheet a partir de una URL completa o una clave directa."""
    if not texto_o_url:
        return ""
    texto = str(texto_o_url).strip()
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", texto)
    if match:
        return match.group(1)
    return texto

def buscar_archivo_credenciales(nombre_sugerido: str = "") -> str:
    """
    Busca el archivo JSON de clave privada de la cuenta de servicio de Google Cloud
    en AppData, junto al ejecutable, en backend o en los recursos empaquetados.
    """
    candidatos = []
    if nombre_sugerido:
        candidatos.extend([
            DATA_DIR / nombre_sugerido,
            PROJECT_ROOT / nombre_sugerido,
            PROJECT_ROOT / "backend" / nombre_sugerido,
            recurso_path(nombre_sugerido),
            recurso_path(f"backend/{nombre_sugerido}")
        ])

    # Nombres típicos
    for nom in ["credentials.json", "google_credentials.json"]:
        candidatos.extend([
            DATA_DIR / nom,
            PROJECT_ROOT / nom,
            PROJECT_ROOT / "backend" / nom,
            recurso_path(nom),
            recurso_path(f"backend/{nom}")
        ])

    for cand in candidatos:
        if cand.exists() and cand.is_file():
            try:
                with open(cand, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("type") == "service_account":
                        return str(cand.resolve())
            except Exception:
                continue

    # Búsqueda exhaustiva en directorios conocidos
    directorios_busqueda = [DATA_DIR, PROJECT_ROOT, PROJECT_ROOT / "backend"]
    if IS_FROZEN:
        directorios_busqueda.append(Path(sys._MEIPASS))
        directorios_busqueda.append(Path(sys._MEIPASS) / "backend")

    for d in directorios_busqueda:
        if d.exists() and d.is_dir():
            for arch in d.glob("*.json"):
                if arch.name.startswith("config") or arch.name.startswith("package"):
                    continue
                try:
                    with open(arch, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data.get("type") == "service_account":
                            return str(arch.resolve())
                except Exception:
                    continue

    return ""

_cfg = cargar_configuracion()
CREDENTIALS_FILE = buscar_archivo_credenciales(_cfg.get("credentials_file", "credentials.json"))
SHEET_INVENTARIO_NAME = _cfg.get("spreadsheet_inventario", "Inventario v1.5 - Dev")
SHEET_ROSTER_NAME = _cfg.get("spreadsheet_roster", "BBDD_asist_roster")
DRIVE_SIGNATURES_FOLDER_ID = _cfg.get("drive_signatures_folder_id", "")
GITHUB_REPO = _cfg.get("github_repo", "Aterian/RegistroInventario")

# Pestañas y constantes del negocio
SHEET_REGISTRO_GASTOS_TAB = "registro_gastos"
SHEET_SOLICITUDES_TAB = "solicitudes_compras"
SHEET_MOVIMIENTOS_TAB = "movimientos_stock"
SHEET_CONTROL_M_TAB = "3_1_Control_M"
SHEET_CONTROL_I_TAB = "2_1_Control_I"

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


CATALOG_TABS = [
    "1_0_Indumentaria",
    "2_0_Instrumental",
    "2_1_Accesorios",
    "2_1_Adicional",
    "2_1_Instrumental_repuestos",
    "3_0_Movilidad",
    "4_0_Informatica",
    "5_0_Herramientas",
    "6_0_Materiales"
]

ALERT_DAYS_WARNING = 60
ALERT_DAYS_CRITICAL = 30
CACHE_TTL_SECONDS = 300

SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))

COLOR_PRIMARY_RED = "#cc3333"
COLOR_CORPORATE_GRAY = "#999999"
COLOR_ACCENT_CYAN = "#06b6d4"
COLOR_DARK_NAVY = "#0f172a"
