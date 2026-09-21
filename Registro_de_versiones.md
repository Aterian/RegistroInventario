# Registro de Versiones - Sistema de Gestión de Inventario y Viajes Multiproyecto (Ingeap)

Historial cronológico de versiones, mejoras y correcciones implementadas en el sistema.

---

## [1.2.0] - 2026-09-20

### ✨ Nuevas Funcionalidades y Experiencia de Usuario (14 Mejoras)
- 🏠 **Menú Inicial Principal:** Pantalla de bienvenida (`HomeMenuView`) con tarjetas de acceso directo por módulo, resumen de estado del sistema e identidad de marca.
- 🏢 **Identidad Visual Corporativa:** Incorporación del logo oficial de Ingeap en cabecera, inicio, modales, etiquetas QR y remitos PDF generados.
- 🏷️ **Generador de Etiquetas QR e Impresión PDF:**
  - Códigos QR automáticos por código interno o ID de ítem.
  - Modal para previsualización, ajuste de tamaño e impresión de tarjetas/stickers PDF en alta resolución con el logo de Ingeap.
- 📷 **Lector de Códigos QR Integrado:**
  - Escaneo directo mediante cámara en dispositivos móviles y web con soporte de linterna (torch).
  - Reconocimiento automático de códigos internos o etiquetas impresas para agilizar la carga de instrumental, accesorios y herramientas en salidas.
- ⚠️ **Gestión de Mantenimiento y Calibración:**
  - Registro de puesta en mantenimiento con tipo de servicio y fechas de inicio/retorno estimado.
  - Alertas visuales destacadas (`⚠️ En Mantenimiento`) en catálogo y salidas para prevención, sin bloqueo forzado de instrumental.
  - Cierre automático del mantenimiento al reintegrar el equipo al inventario.
- ⏱️ **Modo de Costeo Dinámico por Categoría:**
  - Soporte de costeo por **días de uso** (adicionales como bastones, trípodes, GPS), **km** (movilidad), **ciclos de batería** (drones) y **cantidad** (materiales).
  - Configuración y edición directa desde el Catálogo.
- 📦 **Ajuste Físico de Stock en Catálogo:**
  - Posibilidad de editar el stock actual de indumentaria, EPP, materiales y herramientas con registro de auditoría.
- 🛒 **Solicitudes de Compra con Solicitante Clasificado:**
  - Selector organizado por Áreas Operativas de Ingeap y Listado de Empleados.
- 🔧 **Kardex y Asignación de Repuestos a Equipos:**
  - Selector de repuestos vinculado a ítems de catálogo y campo de selección del instrumental o vehículo de destino.
- ☁️ **Sincronización Cloud y Google Apps Script Reforzado:**
  - Búsqueda dinámica de encabezados en hojas de cálculo para resiliencia ante columnas desordenadas o renombradas.
  - Soporte de campos extendidos en la API Google Apps Script.

---

## [1.1.0] - 2026-09-20

### 🚀 Modernización de Arquitectura Desktop (Adaptación ReporteDiario)
- **Eliminación de Dependencia HTTP Local en Escritorio:**
  - Sustitución del servidor Uvicorn en bucle por el puente nativo `ApiBridge` en PyWebView (`window.pywebview.api`). La aplicación de escritorio ya no ocupa puertos locales (`localhost:8000`), evitando bloqueos de firewall o puertos ocupados.
- **Persistencia Segura en `%LOCALAPPDATA%`:**
  - Migración automática de la base de datos SQLite y archivos generados (PDFs, firmas) a `%LOCALAPPDATA%\Ingeap\Inventario\inventario_local.db`.
  - Inmune a limpiezas de carpetas temporales de Windows o problemas de permisos en carpetas de instalación.
- **Configuración Dinámica (`config.json`):**
  - Archivo `config.json` editable en AppData con fallback empaquetado para cambiar IDs de Google Sheets, nombre de credenciales y repositorio GitHub.
- **Integración Nativa con Windows 11:**
  - Mutex de instancia única (`Local\IngeapInventario_App_SingleInstance_Mutex`): si la app ya está abierta, restaura la ventana activa y descarta el proceso duplicado.
  - Bandeja del sistema (`pystray`) con menú contextual para Abrir, Ocultar, Sincronizar Catálogo y Salir. El botón X de cerrar minimiza a la bandeja.
  - Registro de inicio automático con Windows (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
  - Auto-actualizador silencioso desde GitHub Releases con reemplazo en caliente del ejecutable.
- **Instalador Autónomo de 1 Archivo (.exe):**
  - Script `compilar_instalador.bat` y especificación `Instalador_Ingeap_Inventario.spec` para generar un instalador único que copia la app a AppData, crea accesos directos en Escritorio y Menú Inicio, desbloquea SmartScreen y la ejecuta.

### 📱 Independencia Móvil Total (Cloud 24/7 sin PC Encendida)
- **Backend Cloud Serverless con Google Apps Script:**
  - Creación de [`backend/google_apps_script.js`](./backend/google_apps_script.js): una API Web App que corre de forma continua en Google Cloud sin costo de servidores ni mantenimiento.
  - La aplicación móvil en Android (Capacitor) se conecta directamente a Google Cloud las 24 horas del día. **Ya no es necesario tener encendida la PC de la oficina**.
- **Capa Híbrida Inteligente en Frontend (`frontend/src/api.js`):**
  - Detección automática de entorno: en escritorio usa el puente nativo de PyWebView; en celular usa la Web App de Google Apps Script.
- **Caché y Resiliencia Offline en Terreno:**
  - Los catálogos y viajes activos se almacenan localmente en el celular (`localStorage`).
  - Si el personal está en zonas rurales o de campaña sin señal 4G/5G, puede registrar salidas y retornos con firma; la operación queda guardada en la cola local (`ingeap_offline_queue`) y se sincroniza automáticamente al recuperar conexión.

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
