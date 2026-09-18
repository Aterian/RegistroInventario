# Registro de Versiones - Sistema de Gestión de Inventario y Viajes Multiproyecto (Ingeap)

Historial cronológico de versiones, mejoras y correcciones implementadas en el sistema.

---

## [1.0.0] - 2026-09-17

### Arquitectura y Backend (Python 3.10+)
- **FastAPI Core:** Creación del servidor HTTP escuchando en `0.0.0.0:8000` para comunicación fluida tanto en la máquina anfitriona como desde dispositivos móviles en la red local de la oficina.
- **Escritorio Dual (PyWebView + PyStray):** Implementación del lanzador `main.py` con hilo concurrente de Uvicorn, ventana nativa moderna y minimizado a bandeja de sistema de Windows.
- **Integración Google Sheets:**
  - Conexión mediante cuenta de servicio con `gspread` y `google-api-python-client`.
  - Lectura y unificación de las 8 pestañas de `Inventario v1.5` (`1_0_Indumentaria`, `2_0_Instrumental`, `2_1_Accesorios`, `2_1_Adicional`, `3_0_Movilidad`, `4_0_Informatica`, `5_0_Herramientas`, `6_0_Materiales`).
  - Filtro automático de ítems dados de baja (`Activo_baja`, `Ativo_baja`, `Estado`).
  - Lectura de proyectos y usuarios desde `BBDD_asist_roster` (`0_proyectos`, `0_usuarios`).
  - Creación y verificación automática de la pestaña `registro_gastos` con su esquema estricto de 17 columnas.
  - Caché en memoria de 5 minutos con soporte de recarga forzada vía `?recargar=true`.
- **Google Drive para Firmas:**
  - Subida automática de firmas PNG decodificadas desde Base64.
  - Generación de enlaces públicos de visualización para almacenamiento en celda de Google Sheets.
- **Base de Datos Local (SQLite):**
  - Módulo `database.py` para registro y resiliencia offline. Los datos se conservan localmente aunque falle temporalmente la conexión a Internet o a Google Sheets.
- **Generador de Remitos PDF (ReportLab):**
  - Módulo `pdf_service.py` para emitir remitos formales de entrega y actas de retorno con identidad corporativa Ingeap (rojo `#cc3333`, gris `#999999`), desglose por proyecto y estampas de firmas digitales.

### Frontend (React 18 + Vite + Capacitor)
- **Diseño Corporativo y Estilo Tecnológico:**
  - Paleta con Rojo Corporativo `#cc3333` y Gris Plata `#999999`.
  - Conmutador de tema Claro / Oscuro con variables CSS fluidas y persistencia en `localStorage`.
  - Diseño responsive y optimizado para pantallas táctiles de teléfonos y monitores de escritorio.
- **Firma Digital Interactiva:**
  - Componente `react-signature-canvas` con soporte táctil (dedo / lápiz óptico) y cursor de mouse.
- **Formulario de Salida Multiproyecto:**
  - Selección de múltiples proyectos simultáneos.
  - Generación de filas independientes con `id_gasto` único y `id_viaje` compartido.
  - Búsqueda en vivo y filtrado de catálogo por categoría.
- **Formulario de Retorno y Prorrateo:**
  - Modalidad Equitativa ($100 / N\%$).
  - Modalidad Porcentual con controles deslizantes (sliders).
  - Validación matemática estricta que bloquea el envío hasta que la suma total dé exactamente **100%**.
  - Operación `batch_update` para actualizar Sheets de forma instantánea.
- **Configuración Móvil / LAN:**
  - Modal de configuración de IP para permitir que teléfonos Android con Capacitor se conecten a la IP local del servidor de la oficina.
- **Preparación Capacitor Android:**
  - Archivo `capacitor.config.json` configurado para empaquetado nativo en Android.

### Documentación
- Creación de `Registro_de_funciones.md` con descripción exhaustiva de todas las funciones del backend y componentes del frontend.
- Creación de `Registro_de_versiones.md` para seguimiento de versiones.
- Creación de `README.md` con instrucciones de puesta en marcha.
