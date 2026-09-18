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

### Modo Aplicación de Escritorio (PyWebView + Bandeja Windows)
Inicia el servidor FastAPI en segundo plano y abre la ventana nativa de escritorio:
```powershell
.\.venv\Scripts\python main.py
```

### Modo Servidor (Headless / API pura)
Inicia únicamente el servidor FastAPI escuchando en `0.0.0.0:8000`:
```powershell
.\.venv\Scripts\python main.py --server-only
```
- Documentación interactiva Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- Estado del sistema: [http://localhost:8000/api/estado](http://localhost:8000/api/estado)

### Modo Desarrollo Frontend (Vite HMR)
```powershell
cd frontend
npm run dev
```

---

## 📱 Empaquetado para Android (Capacitor)

El frontend está configurado para compilar como aplicación móvil nativa para teléfonos Android utilizados por el personal en terreno:

1. Compilar los archivos estáticos de React:
   ```powershell
   cd frontend
   npm run build
   ```
2. Inicializar y sincronizar el proyecto Android:
   ```powershell
   npx cap add android
   npx cap sync
   ```
3. Abrir en Android Studio para generar el APK:
   ```powershell
   npx cap open android
   ```
4. **Conexión en Terreno/Oficina:** En la app Android, presione el botón de engranaje (⚙️) en la barra superior y configure la IP de la computadora de la oficina (por ejemplo `http://192.168.1.50:8000/api`).

---

## 📄 Estructura de Documentación

- **[`Registro_de_funciones.md`](./Registro_de_funciones.md):** Especificación técnica de todas las funciones y componentes implementados.
- **[`Registro_de_versiones.md`](./Registro_de_versiones.md):** Historial de versiones y cambios del proyecto.
- **[`backend/`](./backend):** Código fuente del servidor, modelos de datos, servicios de Google y generador de remitos PDF.
- **[`frontend/`](./frontend):** Código fuente de la interfaz de usuario en React.
