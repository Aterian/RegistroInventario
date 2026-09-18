import os
from pathlib import Path

# Directorios base
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
UPLOADS_DIR = DATA_DIR / "firmas"
PDFS_DIR = DATA_DIR / "remitos_pdf"

# Crear directorios si no existen
DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
PDFS_DIR.mkdir(exist_ok=True)

# Directorio de documentación local
DOCS_DIR = DATA_DIR / "documentos"
DOCS_DIR.mkdir(exist_ok=True)

# Archivo de credenciales de Google Service Account
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", str(BASE_DIR / "credentials.json"))

# Base de datos SQLite local para resiliencia/offline
SQLITE_DB_PATH = str(DATA_DIR / "inventario_local.db")

# Google Sheets Nombres de Libros y Hojas
SHEET_INVENTARIO_NAME = os.getenv("SHEET_INVENTARIO_NAME", "Inventario v1.5 - Dev")
SHEET_ROSTER_NAME = os.getenv("SHEET_ROSTER_NAME", "BBDD_asist_roster")
SHEET_REGISTRO_GASTOS_TAB = os.getenv("SHEET_REGISTRO_GASTOS_TAB", "registro_gastos")
SHEET_SOLICITUDES_TAB = os.getenv("SHEET_SOLICITUDES_TAB", "solicitudes_compras")
SHEET_MOVIMIENTOS_TAB = os.getenv("SHEET_MOVIMIENTOS_TAB", "movimientos_stock")
SHEET_CONTROL_M_TAB = "3_1_Control_M"
SHEET_CONTROL_I_TAB = "2_1_Control_I"

# Pestañas de Catálogo en Inventario v1.5
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

# Umbrales para alertas de vencimiento (en días)
ALERT_DAYS_WARNING = 60   # 🟡 Alerta amarilla: entre 31 y 60 días
ALERT_DAYS_CRITICAL = 30  # 🔴 Alerta roja: 30 días o menos (o ya vencido)

# Google Drive ID de carpeta para firmas (opcional)
DRIVE_SIGNATURES_FOLDER_ID = os.getenv("DRIVE_SIGNATURES_FOLDER_ID", "")

# Configuración de Red Backend
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))

# Cache TTL (5 minutos)
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "300"))

# Colores corporativos para PDFs e interfaz
COLOR_PRIMARY_RED = "#cc3333"
COLOR_CORPORATE_GRAY = "#999999"
COLOR_ACCENT_CYAN = "#06b6d4"
COLOR_DARK_NAVY = "#0f172a"
