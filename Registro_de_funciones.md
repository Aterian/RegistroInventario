# Registro de Funciones - Sistema de Gestión de Inventario y Viajes Multiproyecto (Ingeap)

Este documento detalla todas las funciones, métodos y utilidades implementadas en el backend y frontend del sistema, describiendo su propósito, parámetros y valores de retorno.

---

## 1. Backend (`/backend`)

### 1.1. Base de Datos SQLite Local (`backend/database.py`)
Capa de persistencia local para contingencia offline y sincronización con Google Sheets.

- **`get_db_connection() -> sqlite3.Connection`**
  - *Propósito:* Crea y retorna una conexión a la base de datos SQLite local (`data/inventario_local.db`), configurando `row_factory = sqlite3.Row`.
  - *Retorno:* Objeto de conexión `sqlite3.Connection`.

- **`init_db() -> None`**
  - *Propósito:* Inicializa el esquema relacional en SQLite creando las tablas maestras `viajes`, `gastos_detalle`, `catalogo_cache`, `proyectos_cache` y `usuarios_cache` si no existen.
  - *Retorno:* `None`.

- **`save_viaje_salida_local(id_viaje, proyectos, filas_gastos, user_s, firma_s, fecha_s) -> None`**
  - *Propósito:* Almacena el registro maestro de salida en la tabla `viajes` y las filas individuales ($1 \text{ fila} \times \text{ítem} \times \text{proyecto}$) en `gastos_detalle`.
  - *Parámetros:*
    - `id_viaje` (str): UUID compartido del viaje.
    - `proyectos` (list[dict]): Lista de proyectos involucrados `{ id_proyecto, denominacion }`.
    - `filas_gastos` (list[dict]): Filas generadas con unidades iniciales y costos unitarios.
    - `user_s` (str): Responsable que retira el inventario.
    - `firma_s` (str): Enlace o ruta de la firma digital de salida.
    - `fecha_s` (str): Marca temporal de salida.

- **`save_viaje_retorno_local(id_viaje, filas_actualizadas, user_r, firma_r, fecha_r) -> None`**
  - *Propósito:* Actualiza el estado del viaje a `RETORNADO`, registrando la fecha de retorno, responsable, firma y el costo total liquidado por ítem y proyecto.
  - *Parámetros:*
    - `id_viaje` (str): UUID del viaje.
    - `filas_actualizadas` (list[dict]): Lista con `unidad_r`, `costo_t`, `user_r`, etc.
    - `user_r` (str): Empleado receptor.
    - `firma_r` (str): Enlace de la firma de retorno.
    - `fecha_r` (str): Marca temporal de devolución.

- **`mark_viaje_as_synced(id_viaje: str) -> None`**
  - *Propósito:* Marca el indicador `synced_sheets = 1` en SQLite cuando la operación fue volcada con éxito en Google Sheets.

- **`get_viajes_activos_local() -> List[Dict[str, Any]]`**
  - *Propósito:* Retorna los viajes activos (donde `fecha_r` está vacía o null) con sus ítems asociados.
  - *Retorno:* Lista de diccionarios con la información de los viajes en terreno.

- **`get_viaje_by_id_local(id_viaje: str) -> Optional[Dict[str, Any]]`**
  - *Propósito:* Recupera el registro completo de un viaje específico por su UUID.

- **`save_catalogo_cache_local(items: List[Dict[str, Any]]) -> None`**
  - *Propósito:* Sobrescribe la tabla `catalogo_cache` con los ítems consolidados de las 8 pestañas de inventario.

- **`get_catalogo_cache_local() -> List[Dict[str, Any]]`**
  - *Propósito:* Obtiene el catálogo de inventario en caché local cuando no hay conexión a Google Sheets.

- **`save_proyectos_usuarios_cache_local(proyectos, usuarios) -> None`**
  - *Propósito:* Respalda en SQLite local las listas de proyectos y usuarios obtenidas de `BBDD_asist_roster`.

- **`get_proyectos_usuarios_cache_local() -> Dict[str, List[Dict[str, Any]]]`**
  - *Propósito:* Obtiene los proyectos y usuarios desde la caché local.

---

### 1.2. Servicio de Google Sheets y Google Drive (`backend/google_service.py`)
Módulo encargado de la integración con las APIs de Google Cloud y gestión de caché.

- **`GoogleService.__init__()`**
  - *Propósito:* Constructor del servicio singleton. Inicializa credenciales, clientes y la estructura de caché en memoria con TTL de 5 minutos.

- **`init_clients() -> bool`**
  - *Propósito:* Autentica contra Google Sheets y Google Drive API v3 utilizando la cuenta de servicio (`credentials.json`). Activa el modo contingencia si el archivo no existe.

- **`check_connection() -> Dict[str, Any]`**
  - *Propósito:* Verifica el estado en tiempo real de la conectividad con los libros "Inventario v1.5", "BBDD_asist_roster" y Google Drive.

- **`upload_signature(base64_str: str, filename_prefix: str) -> Tuple[str, str]`**
  - *Propósito:* Decodifica una firma Base64 PNG proveniente del frontend, la guarda en `data/firmas/` y la sube a Google Drive con permisos públicos de lectura (`reader/anyone`).
  - *Retorno:* Tupla `(enlace_publico_drive_o_local, ruta_archivo_local)`.

- **`get_catalogos(recargar: bool = False) -> Dict[str, Any]`**
  - *Propósito:* Provee los catálogos unificados. Si `recargar=False` y el caché no expiró (< 300 segundos), entrega desde memoria; caso contrario consulta Google Sheets o SQLite local.

- **`_read_proyectos() -> List[Dict[str, Any]]`**
  - *Propósito:* Lee la pestaña `0_proyectos` del libro `BBDD_asist_roster`.

- **`_read_usuarios() -> List[Dict[str, Any]]`**
  - *Propósito:* Lee la pestaña `0_usuarios` del libro `BBDD_asist_roster`.

- **`_is_baja(row: Dict[str, Any]) -> bool`**
  - *Propósito:* Determina si un registro está dado de baja analizando las columnas `Activo_baja`, `Ativo_baja` y `Estado`.

- **`_read_inventario_unified() -> List[Dict[str, Any]]`**
  - *Propósito:* Itera sobre las 8 pestañas de catálogo (`1_0_Indumentaria`, `2_0_Instrumental`, `2_1_Accesorios`, `2_1_Adicional`, `3_0_Movilidad`, `4_0_Informatica`, `5_0_Herramientas`, `6_0_Materiales`), filtra las bajas y unifica los campos en `{ id, categoria, codigo_interno, nombre, numero_serie, imagen }`.

- **`_get_or_create_registro_gastos_ws() -> Optional[gspread.Worksheet]`**
  - *Propósito:* Obtiene la pestaña de destino `registro_gastos` en el documento o la crea automáticamente con sus 17 columnas si no existe.

- **`registrar_salida(id_viaje, proyectos, items, user_s, firma_s, fecha_s) -> List[Dict[str, Any]]`**
  - *Propósito:* Multiplica ítems por proyectos para generar las filas de salida, las guarda en SQLite y hace `append_rows` en Google Sheets.

- **`registrar_retorno(id_viaje, items_retorno, prorrateos, user_r, firma_r, fecha_r) -> List[Dict[str, Any]]`**
  - *Propósito:* Calcula el costo liquidado según la fórmula `costo_t = (unidad_r - unidad_s) * costo_u * porcentaje`, actualiza SQLite y ejecuta un `batch_update` atómico en Google Sheets.

- **`get_viajes_activos() -> List[Dict[str, Any]]`**
  - *Propósito:* Obtiene todos los viajes que poseen ítems sin fecha de devolución registrada.

---

### 1.3. Generador de Remitos PDF (`backend/pdf_service.py`)
Módulo ReportLab para documentación legal y operativa con sellos de firma.

- **`_resolve_signature_path(signature_ref: str) -> Optional[str]`**
  - *Propósito:* Resuelve la ruta física local de la imagen PNG de la firma a partir de una referencia URL o nombre de archivo.

- **`generate_remito_pdf(viaje_data: Dict[str, Any]) -> str`**
  - *Propósito:* Compila el documento formal en PDF (`remito_{id_viaje}.pdf`) incluyendo:
    - Encabezado institucional Ingeap con estado (`EN CURSO` / `RETORNADO`).
    - Metadatos de viaje (ID UUID, proyectos asignados, fechas, responsables).
    - Tabla detallada de elementos con unidades de salida/retorno, costo unitario y total liquidado.
    - Cuadros inferiores con las firmas digitales estampadas para Salida y Retorno.
  - *Retorno:* Ruta absoluta del archivo PDF generado.

---

### 1.4. Endpoints FastAPI (`backend/routes.py`)
Rutas HTTP expuestas a la red local (`0.0.0.0:8000`):

- **`GET /api/estado`**: Comprueba la disponibilidad del backend y de Google Cloud.
- **`GET /api/catalogos?recargar={bool}`**: Entrega proyectos, usuarios, inventario unificado y categorías.
- **`GET /api/viajes/activos`**: Lista de viajes en curso para el Dashboard.
- **`GET /api/viajes/{id_viaje}`**: Detalle de un viaje específico.
- **`POST /api/viajes/salida`**: Registra la salida multiproyecto y sube la firma.
- **`POST /api/viajes/retorno`**: Cierra el viaje, prorratea costos y actualiza Sheets.
- **`GET /api/viajes/{id_viaje}/pdf`**: Entrega el archivo binario del remito para visualización o impresión.

---

### 1.5. Lanzador de Escritorio (`main.py`)

- **`is_port_in_use(port: int, host: str) -> bool`**: Verifica si el puerto 5173 o 8000 está ocupado.
- **`create_tray_image() -> PIL.Image`**: Dibuja dinámicamente un icono corporativo en color `#cc3333` para la bandeja del sistema.
- **`run_uvicorn()`**: Inicia el servidor ASGI Uvicorn en un hilo en segundo plano.
- **`setup_tray(window)`**: Configura el menú contextual y minimizado a la bandeja de Windows con PyStray.
- **`main()`**: Punto de entrada principal que coordina el hilo de FastAPI y la ventana de PyWebView.

---

## 2. Frontend (`/frontend/src`)

### 2.1. Cliente API (`src/api.js`)
- **`getApiBaseUrl()`**: Obtiene la URL base de la API desde `localStorage` o infiere la ruta relativa (`/api`).
- **`setApiBaseUrl(url)`**: Guarda la URL del backend personalizada por el usuario.
- **`isDesktopApp()`**: Detecta si la aplicación se ejecuta dentro del contenedor de escritorio nativo PyWebView (`window.pywebview.api`).
- **`getGasUrl()` / `setGasUrl(url)`**: Lee y guarda la URL de la Web App de Google Apps Script para conexión móvil independiente 24/7.
- **`getOfflineQueue()` / `addOfflineQueue(item)` / `syncOfflineQueue()`**: Administra la cola local de salidas y retornos realizados en terreno sin cobertura celular, sincronizándolos automáticamente al detectar conexión.
- **`api.getEstado()`**: Consulta el estado del sistema mediante `ApiBridge` en PC o Google Apps Script en móvil.
- **`api.getCatalogos(recargar)`**: Provee el catálogo completo, usando caché en memoria, caché local en teléfono o consulta remota.
- **`api.getViajesActivos()` / `api.getTodosLosViajes()` / `api.getViajeDetalle(idViaje)`**: Consulta de viajes activos e histórico.
- **`api.registrarSalida(data)`**: Registra el despacho multiproyecto de salida (vía Python nativo o Web App Google Cloud).
- **`api.registrarRetorno(data)`**: Registra la devolución con cálculo de prorrateos.
- **`api.abrirRemito(idViaje)`**: Abre el remito en el visor PDF del sistema operativo (en PC) o en pestaña nueva (en móvil/web).
- **`api.minimizar()` / `api.verificarActualizacion()` / `api.aplicarActualizacion()`**: Control nativo de ventana y auto-actualizador para escritorio.

### 2.2. Puente Nativo de Escritorio (`backend/api_bridge.py`)
Módulo que expone métodos de negocio directamente a JavaScript vía `window.pywebview.api`, prescindiendo de puertos de red:
- **`ApiBridge.get_estado()`**: Estado de Google Sheets, Drive y base de datos local SQLite.
- **`ApiBridge.get_catalogos(recargar)`**: Lectura unificada de las 8 pestañas y nóminas de proyectos/usuarios.
- **`ApiBridge.registrar_salida(data)` / `registrar_retorno(data)`**: Procesamiento de viajes y cálculo de costos.
- **`ApiBridge.generar_remito_pdf(id_viaje)` / `abrir_remito_pdf(id_viaje)`**: Generación con ReportLab y apertura con la app predeterminada de Windows.
- **`ApiBridge.probar_conexion_sheets()` / `guardar_config_sheets(config)`**: Gestión de libros y credenciales persistentes en AppData.
- **`ApiBridge.verificar_actualizacion()` / `aplicar_actualizacion(url)`**: Detección de versiones en GitHub Releases y reemplazo del ejecutable en caliente.
- **`ApiBridge.minimizar_a_bandeja()` / `redimensionar_ventana()` / `maximizar_ventana()`**: Control dinámico de ventana.

### 2.3. Servicio Web App Cloud para Celulares (`backend/google_apps_script.js`)
API serverless alojada 24/7 en Google Cloud para la app móvil Android:
- **`doGet(e)` / `doPost(e)`**: Manejo de peticiones HTTP REST con formato JSON y soporte CORS.
- **`getCatalogos()`**: Lectura directa de las 8 hojas de catálogo y listas de personal.
- **`uploadSignatureToDrive(base64, prefix)`**: Creación de archivo PNG en Google Drive con permisos públicos de lectura.
- **`registrarSalida(data)` / `registrarRetorno(data)`**: Inserción y actualización atómica en `registro_gastos` y `movimientos_stock`.

### 2.4. Componentes de Interfaz de Usuario
- **`App` (`src/App.jsx`)**: Componente raíz con control de pestañas, carga en paralelo, sondeo automático cada 30 segundos y notificaciones Toast flotantes.
- **`Navbar` (`src/components/Navbar.jsx`)**: Barra superior con isotipo Ingeap, indicador de estado de red, conmutador de tema y accesos rápidos.
- **`Dashboard` (`src/components/Dashboard.jsx`)**: Vista de métricas, buscador en tiempo real de viajes en terreno, tarjetas de viaje y enlaces directos a remitos PDF.
- **`SalidaForm` (`src/components/SalidaForm.jsx`)**: Formulario multiproyecto con selección de personal, buscador de inventario, ingreso de odómetro/unidades iniciales y captura de firma.
- **`RetornoModal` (`src/components/RetornoModal.jsx`)**: Modal de liquidación con selector de modo equitativo o por sliders porcentuales, validación matemática de suma 100% y captura de firma de retorno.
- **`CatalogViewer` (`src/components/CatalogViewer.jsx`)**: Explorador completo de las 8 categorías del inventario con previsualización de imágenes, números de serie y códigos internos.
- **`SignaturePadModal` (`src/components/SignaturePadModal.jsx`)**: Canvas interactivo compatible con pantallas táctiles móviles y mouse de PC, con funciones de limpieza y exportación a PNG Base64.
- **`SettingsModal` (`src/components/SettingsModal.jsx`)**: Diálogo inteligente con detección de entorno (Modo Escritorio Nativo vs Modo Móvil Autónomo 24/7), configuración de Google Apps Script y estado de cola offline.
- **`ThemeProvider` / `useTheme` (`src/context/ThemeContext.jsx`)**: Proveedor de contexto para alternar fluidamente entre tema claro y oscuro con persistencia en `localStorage`.

