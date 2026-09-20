# Sistema de Gestión de Inventario y Viajes Multiproyecto - Ingeap S.A.

Solución unificada y full-stack para el registro de salidas y devoluciones de inventario con asignación a múltiples proyectos, integración con Google Sheets y Google Drive, base de datos local SQLite para contingencia, firmas digitales estampadas y generación de remitos PDF oficiales.

---

## 🏛️ Arquitectura del Sistema

- **Backend:** Python 3.10+ con FastAPI, Uvicorn en subproceso concurrente, ReportLab (generación de PDFs), SQLite3 (`database.py`) y conexión a Google Cloud (`gspread`, `google-api-python-client`).
- **Escritorio:** PyWebView en el hilo principal y minimizado a la bandeja del sistema de Windows mediante PyStray.
- **Frontend:** React 18, Vite, CSS moderno con soporte para temas Claro/Oscuro dinámicos y paleta corporativa (Rojo `#cc3333` y Gris `#999999`).
- **Móvil:** Configurado con Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`).
- **Almacenamiento Cloud:** Google Sheets (`Inventario v1.5`, `BBDD_asist_roster`, pestaña `registro_gastos`) y Google Drive para imágenes de firmas.

---

## 🚀 Puesta en Marcha Rápida

### 1. Requisitos Previos
- Python 3.10 o superior instalado.
- Node.js 18+ y npm instalados.

### 2. Configuración del Entorno Python
```powershell
# En la raíz del proyecto
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configuración de Credenciales de Google
Coloque el archivo de clave privada de su cuenta de servicio de Google Cloud en:
`backend/credentials.json`

*(Puede tomar como referencia el archivo `backend/credentials.json.example`). Asegúrese de compartir las hojas de cálculo "Inventario v1.5" y "BBDD_asist_roster" con el correo de la cuenta de servicio (`client_email`).*

> **Nota de Resiliencia:** Si el archivo `credentials.json` no está presente, el sistema entrará automáticamente en **Modo Local (Contingencia)** utilizando SQLite (`data/inventario_local.db`), garantizando que la operación nunca se detenga.

### 4. Compilación del Frontend React
```powershell
cd frontend
npm install
npm run build
cd ..
```

---

## 🖥️ Modos de Ejecución

### Modo Aplicación de Escritorio (PyWebView Nativo + Bandeja Windows)
Inicia la ventana de escritorio conectada nativamente mediante `ApiBridge` (sin servidor HTTP local ni puertos ocupados, con icono en la bandeja del sistema y persistencia en `%LOCALAPPDATA%`):
```powershell
.\.venv\Scripts\python main.py
```

### Modo Desarrollo Frontend (Vite HMR)
Para desarrollar el frontend con recarga en caliente:
```powershell
# En terminal 1:
cd frontend
npm run dev

# En terminal 2:
.\.venv\Scripts\python main.py --dev
```

### Modo Servidor Opcional (Headless / API pura)
Inicia el servidor FastAPI escuchando en `0.0.0.0:8000` (pensado para contenedores Docker o Cloud Run):
```powershell
.\.venv\Scripts\python main.py --server-only
```

---

## 📱 Aplicación Móvil para Celular (Android / Capacitor - 24/7 Independiente)

La aplicación para teléfonos celulares opera de manera **100% independiente** y **no requiere que la computadora de la oficina esté encendida ni conectada**.

### 1. Despliegue de la API Cloud en Google Sheets (Cero costo, 24/7)
1. Abra su libro "Inventario v1.5" en Google Sheets.
2. Vaya a **Extensiones > Apps Script**.
3. Pegue el código de [`backend/google_apps_script.js`](./backend/google_apps_script.js).
4. Haga clic en **Implementar > Nueva implementación > Tipo: Aplicación web**.
5. Configure:
   - **Ejecutar como:** "Yo"
   - **Quién tiene acceso:** "Cualquier usuario"
6. Haga clic en **Implementar** y copie la URL resultante (`https://script.google.com/macros/s/.../exec`).

### 2. Configuración en el Celular
1. Abra la aplicación en su teléfono Android.
2. Toque el icono de engranaje (⚙️) en la barra superior.
3. Pegue la URL de Google Apps Script copiada anteriormente.
4. ¡Listo! El celular se comunicará directamente con Google Cloud las 24 horas del día.

> **Resiliencia en Terreno (Modo Offline):** Si el personal se encuentra en zonas rurales o de campaña sin señal celular, la aplicación guarda los catálogos en caché y almacena las salidas y retornos en una cola local. Al recuperar conexión, se sincronizan automáticamente con Google Sheets.

---

## 📦 Compilación del Instalador Autónomo de 1 Archivo (.exe)

Para generar el instalador distribuible para Windows (que instala en `%LOCALAPPDATA%\Ingeap\Inventario`, crea accesos directos en Escritorio y Menú Inicio y configura el inicio con Windows):

Simplemente ejecute:
```powershell
.\compilar_instalador.bat
```
El archivo final generado se encontrará en:
`instalador\Instalador_Ingeap_Inventario.exe`

---

## 📄 Estructura de Documentación

- **[`Registro_de_funciones.md`](./Registro_de_funciones.md):** Especificación técnica de todas las funciones y componentes implementados.
- **[`Registro_de_versiones.md`](./Registro_de_versiones.md):** Historial de versiones y cambios del proyecto.
- **[`backend/api_bridge.py`](./backend/api_bridge.py):** Puente nativo JavaScript-Python para PyWebView.
- **[`backend/google_apps_script.js`](./backend/google_apps_script.js):** Backend Cloud 24/7 para dispositivos móviles.
- **[`frontend/src/api.js`](./frontend/src/api.js):** Capa de conexión híbrida inteligente (Desktop nativo + Móvil autónomo).

