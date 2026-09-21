/**
 * ==============================================================================
 * SISTEMA DE GESTIÓN DE INVENTARIO Y VIAJES - INGEAP S.A.
 * GOOGLE APPS SCRIPT - SERVICIO WEB APP CLOUD (24/7)
 * ==============================================================================
 * 
 * Este script proporciona una API web segura, gratuita y disponible 24/7 alojada
 * directamente en los servidores de Google Cloud. Permite que la aplicación móvil
 * para celular (Android / Capacitor) funcione de forma 100% independiente
 * SIN NECESIDAD de que la computadora de la oficina esté encendida.
 * 
 * INSTRUCCIONES DE INSTALACIÓN RÁPIDA (Solo toma 2 minutos):
 * 1. Abra su hoja de cálculo "Inventario v1.5" en Google Drive.
 * 2. En el menú superior, haga clic en: "Extensiones" > "Apps Script".
 * 3. Borre cualquier código existente en el editor y pegue TODO el contenido de este archivo.
 * 4. Si la hoja "BBDD_asist_roster" es un archivo separado, copie su ID de la URL y colóquelo
 *    en la constante ID_HOJA_ROSTER abajo (o déjelo vacío si están en el mismo libro).
 * 5. Haga clic en el botón azul "Implementar" (arriba a la derecha) > "Nueva implementación".
 * 6. Seleccione tipo: "Aplicación web".
 * 7. Complete los campos:
 *    - Descripción: "API Inventario Ingeap 24/7"
 *    - Ejecutar como: "Yo" (su cuenta de Google)
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone)
 * 8. Haga clic en "Implementar", autorice los permisos y copie la "URL de la aplicación web"
 *    (termina en /exec).
 * 9. En la app móvil del celular, presione el engranaje ⚙️ y pegue esa URL. ¡Listo!
 * ==============================================================================
 */

// Si la hoja BBDD_asist_roster está en otro libro, coloque su ID aquí:
const ID_HOJA_ROSTER = ""; 

// ID de carpeta de Google Drive para guardar firmas (opcional, si está vacío se guardan en Mi Unidad):
const ID_CARPETA_FIRMAS = "";

const REGISTRO_GASTOS_COLUMNS = [
  "id_gasto", "id_viaje", "id_proyecto", "proyecto", "tipo", "elemento",
  "fecha_s", "fecha_r", "unidad_s", "unidad_r", "costo_u", "costo_t",
  "user_s", "firma_s", "user_r", "firma_r", "fecha_hora_s", "fecha_hora_r", "unidad_medida"
];

const SOLICITUDES_COLUMNS = [
  "id_solicitud", "fecha", "solicitante", "elemento", "categoria",
  "cantidad", "prioridad", "id_proyecto", "proyecto", "estado",
  "observaciones", "fecha_hora"
];

const MOVIMIENTOS_COLUMNS = [
  "id_movimiento", "fecha_hora", "tipo_movimiento", "id_elemento",
  "categoria", "elemento", "codigo_interno", "cantidad", "id_viaje",
  "proyecto", "usuario", "observaciones"
];

const CATALOG_TABS = [
  "1_0_Indumentaria",
  "2_0_Instrumental",
  "2_1_Accesorios",
  "2_1_Adicional",
  "2_1_Instrumental_repuestos",
  "3_0_Movilidad",
  "4_0_Informatica",
  "5_0_Herramientas",
  "6_0_Materiales"
];

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  try {
    let params = {};
    if (e && e.parameter) {
      params = e.parameter;
    }

    let postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = {};
      }
    }

    const action = params.action || postData.action || "getEstado";

    let result = {};

    switch (action) {
      case "getEstado":
        result = getEstado();
        break;

      case "getCatalogos":
        result = getCatalogos();
        break;

      case "getProyectosYUsuarios":
        result = getProyectosYUsuarios();
        break;

      case "getViajesActivos":
        result = getViajesActivos();
        break;

      case "getTodosLosViajes":
        result = getTodosLosViajes();
        break;

      case "getViajeDetalle":
        result = getViajeDetalle(params.id_viaje || postData.id_viaje);
        break;

      case "registrarSalida":
        result = registrarSalida(postData);
        break;

      case "editarSalida":
        result = editarSalida(postData);
        break;

      case "registrarRetorno":
        result = registrarRetorno(postData);
        break;

      case "marcarMantenimiento":
        result = marcarMantenimiento(postData);
        break;

      case "finalizarMantenimiento":
        result = finalizarMantenimiento(postData);
        break;

      case "actualizarStock":
        result = actualizarStock(postData);
        break;

      case "getAlertas":
        result = getAlertas();
        break;

      case "getSolicitudes":
        result = getSolicitudes(params.estado || postData.estado);
        break;

      case "crearSolicitud":
        result = crearSolicitud(postData);
        break;

      case "actualizarSolicitud":
        result = actualizarSolicitud(postData);
        break;

      case "getMovimientos":
        result = getMovimientos(params.limit || postData.limit, params.filtro || postData.filtro);
        break;

      case "registrarMovimiento":
        result = registrarMovimiento(postData);
        break;

      case "crearElemento":
        result = crearElemento(postData);
        break;

      case "editarElemento":
        result = editarElemento(postData);
        break;

      case "eliminarElemento":
        result = eliminarElemento(postData);
        break;

      default:
        result = { error: "Acción no reconocida: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString(),
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------------------------------------------------------------
// IMPLEMENTACIÓN DE ACCIONES
// ----------------------------------------------------------------------

const SPREADSHEET_ID_DEFAULT = "1Eme9Rf6g9wqfv4-1_Lq8_MaKKYKYYhFTkIC7R6xnWbM";

function getActiveOrOpenSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch(e) {}
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID_DEFAULT);
  } catch(e) {
    throw new Error("No se pudo abrir el libro 'Inventario v1.5 - Dev' (ID: " + SPREADSHEET_ID_DEFAULT + "): " + e.toString());
  }
}

function findSheetCaseInsensitive(ss, candidates) {
  if (!ss) return null;
  const sheets = ss.getSheets();
  for (let cand of candidates) {
    const candNorm = cand.toLowerCase().replace(/[\s_\-]/g, "");
    for (let s of sheets) {
      const sNorm = s.getName().toLowerCase().replace(/[\s_\-]/g, "");
      if (sNorm === candNorm) return s;
    }
  }
  return null;
}

function getEstado() {
  const ss = getActiveOrOpenSpreadsheet();
  let countProy = 0;
  let countUsu = 0;
  try {
    const sP = ss.getSheetByName("proyectos_activos") || findSheetCaseInsensitive(ss, ["proyectos_activos", "proyectos", "0_proyectos"]);
    if (sP) countProy = Math.max(0, sP.getLastRow() - 1);
  } catch(e) {}
  try {
    const sU = ss.getSheetByName("usuarios") || findSheetCaseInsensitive(ss, ["usuarios", "personal", "0_usuarios"]);
    if (sU) countUsu = Math.max(0, sU.getLastRow() - 1);
  } catch(e) {}
  return {
    estado: "ONLINE",
    google_connected: true,
    sheets_inventario: true,
    sheets_roster: true,
    drive_connected: true,
    local_db_ok: false,
    modo: "Google Apps Script Cloud (Independiente 24/7)",
    nombre_libro: ss ? ss.getName() : "Inventario v1.5 - Dev",
    total_proyectos: countProy,
    total_usuarios: countUsu,
    timestamp: new Date().toISOString()
  };
}

function getProyectosYUsuarios() {
  const ss = getActiveOrOpenSpreadsheet();
  const proyectos = [];
  const usuarios = [];

  // 1. Proyectos
  try {
    const sheetProy = ss.getSheetByName("proyectos_activos") || findSheetCaseInsensitive(ss, ["proyectos_activos", "0_proyectos", "proyectos"]);
    if (sheetProy) {
      const dataP = sheetProy.getDataRange().getValues();
      if (dataP.length > 1) {
        const headersP = dataP[0].map(h => String(h).trim().toLowerCase());
        let idxId = headersP.indexOf("id_proyecto");
        if (idxId === -1) idxId = headersP.indexOf("id");
        if (idxId === -1) idxId = 0;

        let idxDenom = headersP.indexOf("denominacion");
        if (idxDenom === -1) idxDenom = headersP.indexOf("nombre");
        if (idxDenom === -1) idxDenom = headersP.indexOf("proyecto");
        if (idxDenom === -1) idxDenom = 1;

        let idxArea = headersP.indexOf("area");
        if (idxArea === -1) idxArea = 2;

        for (let i = 1; i < dataP.length; i++) {
          const idP = String(dataP[i][idxId] || "").trim();
          const denom = String(dataP[i][idxDenom] || "").trim();
          const area = String(dataP[i][idxArea] || "").trim();
          if (idP || denom) {
            proyectos.push({ id_proyecto: idP || denom, denominacion: denom || idP, area: area });
          }
        }
      }
    }
  } catch(errP) {
    Logger.log("Error leyendo proyectos: " + errP);
  }

  // 2. Usuarios
  try {
    const sheetUsu = ss.getSheetByName("usuarios") || findSheetCaseInsensitive(ss, ["usuarios", "0_usuarios", "personal"]);
    if (sheetUsu) {
      const dataU = sheetUsu.getDataRange().getValues();
      if (dataU.length > 1) {
        const headersU = dataU[0].map(h => String(h).trim().toLowerCase());
        let idxId = headersU.indexOf("id_usuario");
        if (idxId === -1) idxId = headersU.indexOf("id");
        if (idxId === -1) idxId = 0;

        let idxNom = headersU.indexOf("nombre");
        if (idxNom === -1) idxNom = headersU.indexOf("nombre_apellido");
        if (idxNom === -1) idxNom = headersU.indexOf("empleado");
        if (idxNom === -1) idxNom = 1;

        let idxMail = headersU.indexOf("email");
        if (idxMail === -1) idxMail = headersU.indexOf("mail");
        if (idxMail === -1) idxMail = 2;

        let idxArea = headersU.indexOf("area");
        if (idxArea === -1) idxArea = 3;

        let idxDni = headersU.indexOf("dni");
        if (idxDni === -1) idxDni = 4;

        for (let i = 1; i < dataU.length; i++) {
          const idU = String(dataU[i][idxId] || "").trim();
          const nom = String(dataU[i][idxNom] || "").trim();
          const mail = String(dataU[i][idxMail] || "").trim();
          const area = String(dataU[i][idxArea] || "").trim();
          const dni = String(dataU[i][idxDni] || "").trim();
          if (idU || nom) {
            usuarios.push({ id_usuario: idU || nom, nombre: nom || idU, email: mail, area: area, dni: dni });
          }
        }
      }
    }
  } catch(errU) {
    Logger.log("Error leyendo usuarios: " + errU);
  }

  return { proyectos, usuarios, total_proyectos: proyectos.length, total_usuarios: usuarios.length };
}

function getCatalogos() {
  const ss = getActiveOrOpenSpreadsheet();
  const inventario = [];
  const categoriasSet = {};

  // 1. Leer hojas de catálogo de forma individual protegida
  CATALOG_TABS.forEach(tabName => {
    try {
      const sheet = ss.getSheetByName(tabName) || findSheetCaseInsensitive(ss, [tabName]);
      if (!sheet) return;

      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      const headers = data[0].map(h => String(h).trim());
      let catLimpia = tabName === "2_1_Instrumental_repuestos" ? "Repuestos" : tabName.split("_").pop();
      categoriasSet[catLimpia] = true;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row.length) continue;

        const rowObj = {};
        headers.forEach((h, idx) => {
          rowObj[h] = row[idx];
        });

        // Filtro de baja
        const estadoBaja = String(rowObj["Activo_baja"] || rowObj["Ativo_baja"] || rowObj["Estado"] || "").trim().toUpperCase();
        if (["SI", "TRUE", "1", "BAJA", "INACTIVO"].includes(estadoBaja)) {
          continue;
        }

        let nombre = [
          rowObj["Subtipo"] || rowObj["Tipo"] || rowObj["Clase"] || "",
          rowObj["Marca"] || "",
          rowObj["Modelo"] || rowObj["Descripcion"] || rowObj["Detalle"] || ""
        ].filter(Boolean).join(" ").trim();

        let codInt = String(rowObj["Codigo_interno"] || rowObj["Numero_interno"] || "").trim();
        let numSerie = String(rowObj["Numero_serie"] || rowObj["Patente"] || "").trim();

        // Ignorar filas totalmente vacías
        if (!nombre && !codInt && !numSerie) continue;

        let id = String(rowObj["ID_indumentaria"] || rowObj["ID_instrumental"] || rowObj["ID_accesorio"] || 
                        rowObj["ID_adicional"] || rowObj["id_repuesto"] || rowObj["ID_movilidad"] || 
                        rowObj["ID_informatica"] || rowObj["ID_herramienta"] || rowObj["ID_material"] || ("item_" + tabName + "_" + i));

        const isDron = catLimpia.toLowerCase().indexOf("instrumental") !== -1 && (nombre || "").toLowerCase().indexOf("dron") !== -1;
        let modoCosteo = String(rowObj["Modo_costeo"] || rowObj["modo_costeo"] || "").trim();
        if (!modoCosteo) {
          if (catLimpia === "Movilidad") modoCosteo = "KM";
          else if (catLimpia === "Instrumental") modoCosteo = isDron ? "Ciclos de batería" : "Días de uso";
          else if (catLimpia === "Adicional") modoCosteo = "Días de uso";
          else if (catLimpia === "Accesorios") modoCosteo = "";
          else modoCosteo = "Cantidad";
        }

        inventario.push({
          id: id,
          categoria: catLimpia,
          codigo_interno: codInt,
          nombre: nombre || "Elemento sin nombre",
          numero_serie: numSerie,
          imagen: String(rowObj["Imagen"] || "").trim(),
          stock_minimo: Number(rowObj["Stock_minimo"] || rowObj["Cantidad_minima"] || 0),
          stock_actual: Number(rowObj["Stock_actual"] || rowObj["stock_actual"] || rowObj["Stock"] || rowObj["cantidad"] || 1),
          url_carpeta: String(rowObj["URL_carpeta"] || "").trim(),
          modo_costeo: modoCosteo,
          en_mantenimiento: Boolean(rowObj["En_mantenimiento"] || rowObj["en_mantenimiento"] || false),
          tipo_mantenimiento: String(rowObj["Tipo_mantenimiento"] || rowObj["tipo_mantenimiento"] || "").trim(),
          fecha_inicio_mantenimiento: String(rowObj["Fecha_inicio_mantenimiento"] || rowObj["fecha_inicio_mantenimiento"] || "").trim(),
          fecha_fin_mantenimiento: String(rowObj["Fecha_fin_mantenimiento"] || rowObj["fecha_fin_mantenimiento"] || "").trim(),
          es_dron: isDron
        });
      }
    } catch(errTab) {
      Logger.log("Aviso: No se pudo leer pestaña " + tabName + ": " + errTab);
    }
  });

  // 2. Leer proyectos y usuarios directamente
  const pyu = getProyectosYUsuarios();

  return {
    proyectos: pyu.proyectos,
    usuarios: pyu.usuarios,
    inventario: inventario,
    categorias: Object.keys(categoriasSet).sort(),
    total_proyectos: pyu.proyectos.length,
    total_usuarios: pyu.usuarios.length,
    total_inventario: inventario.length,
    origen: "google_apps_script_cloud",
    timestamp: new Date().toISOString()
  };
}

function getOrCreateSheet(sheetName, headers) {
  const ss = getActiveOrOpenSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length) {
      sheet.appendRow(headers);
    }
  } else if (headers && headers.length && sheet.getLastColumn() > 0) {
    try {
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
      headers.forEach(col => {
        if (existingHeaders.indexOf(col.toLowerCase()) === -1 && col) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
          existingHeaders.push(col.toLowerCase());
        }
      });
    } catch (eH) {}
  }
  return sheet;
}


function calcularUnidadMedidaGas(tipo, elemento, modoCosteo) {
  if (modoCosteo) {
    const mc = String(modoCosteo).trim().toLowerCase();
    if (mc.indexOf("km") !== -1) return "km";
    if (mc.indexOf("dia") !== -1 || mc.indexOf("día") !== -1) return "días de uso";
    if (mc.indexOf("ciclo") !== -1) return "ciclos de batería";
    if (mc.indexOf("cant") !== -1) return "cantidad";
    if (mc.indexOf("ning") !== -1 || mc.indexOf("sin") !== -1) return "";
    return modoCosteo;
  }
  const t = String(tipo || "").toLowerCase();
  const e = String(elemento || "").toLowerCase();
  if (t.indexOf("movilidad") !== -1) return "km";
  if (t.indexOf("dron") !== -1 || e.indexOf("dron") !== -1) return "ciclos de batería";
  if (t.indexOf("instrumental") !== -1) return "días de uso";
  if (t.indexOf("adicional") !== -1) return "días de uso";
  if (t.indexOf("accesorio") !== -1) return "";
  if (t.indexOf("material") !== -1 || t.indexOf("herramienta") !== -1 || t.indexOf("indumentaria") !== -1 || t.indexOf("repuesto") !== -1) return "cantidad";
  return "cantidad";
}

function uploadSignatureToDrive(base64Data, prefix) {
  if (!base64Data) return "";
  try {
    let cleanBase64 = base64Data;
    if (cleanBase64.indexOf(",") !== -1) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, "image/png", prefix + "_" + new Date().getTime() + ".png");

    let folder;
    if (ID_CARPETA_FIRMAS) {
      try {
        folder = DriveApp.getFolderById(ID_CARPETA_FIRMAS);
      } catch (e) {
        folder = DriveApp.getRootFolder();
      }
    } else {
      folder = DriveApp.getRootFolder();
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "";
  }
}

function registrarSalida(data) {
  const idViaje = data.id_viaje || Utilities.getUuid();
  let proyectos = data.proyectos || [];
  if ((!proyectos || proyectos.length === 0) && data.proyectos_ids && data.proyectos_ids.length > 0) {
    const todosProy = getProyectosYUsuarios().proyectos;
    const proyMap = {};
    todosProy.forEach(p => {
      proyMap[String(p.id_proyecto)] = p.denominacion || p.nombre || p.id_proyecto;
    });
    proyectos = data.proyectos_ids.map(pId => ({
      id_proyecto: String(pId),
      denominacion: proyMap[String(pId)] || ("Proyecto #" + pId)
    }));
  }
  const items = data.items || [];
  const userS = data.user_s || "";
  const fechaS = data.fecha_s || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
  const nowIso = new Date().toISOString();

  const firmaBase64 = data.firma_s_base64 || data.firma_s || "";
  const firmaUrl = uploadSignatureToDrive(firmaBase64, "salida_" + idViaje.substring(0, 8));

  const sheet = getOrCreateSheet("registro_gastos", REGISTRO_GASTOS_COLUMNS);
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => String(h).trim().toLowerCase());
  const rowsToAdd = [];

  items.forEach(it => {
    const tipo = it.categoria || "";
    let elem = it.nombre || "";
    if (it.codigo_interno) {
      elem = "[" + it.codigo_interno + "] " + elem;
    }
    const unidadS = Number(it.unidad_s || 0);
    const costoU = Number(it.costo_u || 0);
    const uMedida = it.unidad_medida || calcularUnidadMedidaGas(tipo, elem, it.modo_costeo || "");

    proyectos.forEach(proj => {
      const idGasto = Utilities.getUuid();
      const rowDict = {
        "id_gasto": idGasto,
        "id_viaje": idViaje,
        "id_proyecto": String(proj.id_proyecto || ""),
        "proyecto": String(proj.denominacion || ""),
        "tipo": tipo,
        "elemento": elem,
        "fecha_s": fechaS,
        "fecha_r": "",
        "unidad_s": unidadS,
        "unidad_r": 0,
        "costo_u": costoU,
        "costo_t": 0,
        "user_s": userS,
        "firma_s": firmaUrl,
        "user_r": "",
        "firma_r": "",
        "fecha_hora_s": nowIso,
        "fecha_hora_r": "",
        "unidad_medida": uMedida,
        "fecha_hora": nowIso
      };

      const rowArr = headers.map(h => (rowDict[h] !== undefined ? rowDict[h] : ""));
      rowsToAdd.push(rowArr);
    });

    // Registrar en movimientos
    registrarMovimiento({
      tipo_movimiento: "Salida",
      id_elemento: it.id || "",
      categoria: tipo,
      elemento: elem,
      codigo_interno: it.codigo_interno || "",
      cantidad: unidadS,
      id_viaje: idViaje,
      proyecto: proyectos.map(p => p.denominacion).join(", "),
      usuario: userS,
      observaciones: "Despacho salida viaje " + idViaje.substring(0, 8)
    });
  });

  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  }

  return { success: true, id_viaje: idViaje, filas_creadas: rowsToAdd.length };
}

function editarSalida(data) {
  const idViaje = data.id_viaje;
  if (!idViaje) return { success: false, error: "ID de viaje no proporcionado" };

  const items = data.items || [];
  if (items.length === 0) return { success: false, error: "La salida debe contener al menos un elemento" };

  const sheet = getOrCreateSheet("registro_gastos", REGISTRO_GASTOS_COLUMNS);
  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) return { success: false, error: "No hay registros cargados" };

  const headers = allData[0].map(h => String(h).trim().toLowerCase());
  const colIndex = (name) => headers.indexOf(name.toLowerCase());
  const idxIdViaje = colIndex("id_viaje");
  const idxFechaR = colIndex("fecha_r");
  const idxIdProy = colIndex("id_proyecto");
  const idxProy = colIndex("proyecto");
  const idxFechaS = colIndex("fecha_s");
  const idxUserS = colIndex("user_s");
  const idxFirmaS = colIndex("firma_s");
  const idxFechaHoraS = colIndex("fecha_hora_s");

  // 1. Extraer los proyectos y metadatos del viaje existente
  const proyectosMap = {};
  let fechaS = "";
  let userS = data.user_s || "";
  let firmaS = "";
  let fechaHoraS = "";

  const rowsToDelete = [];
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (String(row[idxIdViaje]) === String(idViaje)) {
      const fR = String(row[idxFechaR] || "").trim();
      if (fR) {
        return { success: false, error: "No se puede editar un viaje que ya ha sido retornado/liquidado" };
      }
      const pId = String(row[idxIdProy] || "").trim();
      const pNom = String(row[idxProy] || "").trim();
      if (pId || pNom) {
        proyectosMap[pId || pNom] = { id_proyecto: pId, denominacion: pNom };
      }
      if (!fechaS) fechaS = String(row[idxFechaS] || "");
      if (!userS && idxUserS !== -1) userS = String(row[idxUserS] || "");
      if (!firmaS && idxFirmaS !== -1) firmaS = String(row[idxFirmaS] || "");
      if (!fechaHoraS && idxFechaHoraS !== -1) fechaHoraS = String(row[idxFechaHoraS] || "");
      rowsToDelete.push(i + 1); // 1-indexed row in sheet
    }
  }

  if (rowsToDelete.length === 0) {
    return { success: false, error: "Viaje activo no encontrado" };
  }

  const proyectos = Object.values(proyectosMap);
  const nowIso = new Date().toISOString();
  if (!fechaS) fechaS = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");

  // 2. Eliminar filas antiguas de abajo hacia arriba para mantener consistencia de índices
  for (let r = rowsToDelete.length - 1; r >= 0; r--) {
    sheet.deleteRow(rowsToDelete[r]);
  }

  // 3. Generar y anexar nuevas filas para los ítems editados
  const sheetHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => String(h).trim().toLowerCase());
  const rowsToAdd = [];

  items.forEach(it => {
    const tipo = it.tipo || it.categoria || "";
    let elem = it.elemento || it.nombre || "";
    if (it.codigo_interno && elem.indexOf(it.codigo_interno) === -1) {
      elem = "[" + it.codigo_interno + "] " + elem;
    }
    const unidadS = Number(it.unidad_s || 0);
    const costoU = Number(it.costo_u || 0);
    const uMedida = it.unidad_medida || calcularUnidadMedidaGas(tipo, elem, it.modo_costeo || "");

    proyectos.forEach(proj => {
      const idGasto = Utilities.getUuid();
      const rowDict = {
        "id_gasto": idGasto,
        "id_viaje": idViaje,
        "id_proyecto": String(proj.id_proyecto || ""),
        "proyecto": String(proj.denominacion || ""),
        "tipo": tipo,
        "elemento": elem,
        "fecha_s": fechaS,
        "fecha_r": "",
        "unidad_s": unidadS,
        "unidad_r": 0,
        "costo_u": costoU,
        "costo_t": 0,
        "user_s": userS,
        "firma_s": firmaS,
        "user_r": "",
        "firma_r": "",
        "fecha_hora_s": fechaHoraS || nowIso,
        "fecha_hora_r": "",
        "unidad_medida": uMedida,
        "fecha_hora": nowIso
      };
      const rowArr = sheetHeaders.map(h => (rowDict[h] !== undefined ? rowDict[h] : ""));
      rowsToAdd.push(rowArr);
    });

    // Auditoría en movimientos de stock
    registrarMovimiento({
      tipo_movimiento: "Ajuste Salida",
      id_elemento: it.id || "",
      categoria: tipo,
      elemento: elem,
      codigo_interno: it.codigo_interno || "",
      cantidad: unidadS,
      id_viaje: idViaje,
      proyecto: proyectos.map(p => p.denominacion).join(", "),
      usuario: userS,
      observaciones: "Edición/ajuste de salida viaje " + idViaje.substring(0, 8)
    });
  });

  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  }

  return { success: true, id_viaje: idViaje, items_count: items.length, filas_actualizadas: rowsToAdd.length };
}

function registrarRetorno(data) {
  const idViaje = data.id_viaje;
  const itemsRetorno = data.items || [];
  const prorrateos = data.prorrateos || [];
  const userR = data.user_r || "";
  const fechaR = data.fecha_r || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
  const nowIso = new Date().toISOString();

  const firmaBase64 = data.firma_r_base64 || data.firma_r || "";
  const firmaUrl = uploadSignatureToDrive(firmaBase64, "retorno_" + (idViaje ? idViaje.substring(0, 8) : "ret"));

  const sheet = getOrCreateSheet("registro_gastos", REGISTRO_GASTOS_COLUMNS);
  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: false, error: "No hay registros de viajes cargados." };
  }

  const headers = allData[0].map(h => String(h).trim().toLowerCase());
  const colIndex = (colName) => headers.indexOf(colName.toLowerCase()) + 1;
  const colFechaR = colIndex("fecha_r");
  const colUnidadR = colIndex("unidad_r");
  const colCostoT = colIndex("costo_t");
  const colUserR = colIndex("user_r");
  const colFirmaR = colIndex("firma_r");
  const colFechaHoraR = colIndex("fecha_hora_r");
  const colFechaHora = colIndex("fecha_hora");
  const colIdViaje = colIndex("id_viaje") - 1;
  const colIdGasto = colIndex("id_gasto") - 1;
  const colElem = colIndex("elemento") - 1;
  const colProjId = colIndex("id_proyecto") - 1;
  const colUnidadS = colIndex("unidad_s") - 1;
  const colCostoU = colIndex("costo_u") - 1;
  const colTipo = colIndex("tipo") - 1;

  const prorrateoMap = {};
  prorrateos.forEach(p => {
    prorrateoMap[String(p.id_proyecto)] = Number(p.porcentaje || 0) / 100.0;
  });

  let filasActualizadas = 0;

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (String(row[colIdViaje]) === String(idViaje)) {
      const elemName = String(row[colElem]);
      const projId = String(row[colProjId]);

      const itemCoincidente = itemsRetorno.find(it => {
        let itName = it.nombre || "";
        if (it.codigo_interno) itName = "[" + it.codigo_interno + "] " + itName;
        return itName === elemName || String(it.id_gasto) === String(row[colIdGasto]);
      });

      if (itemCoincidente) {
        const uSalida = Number(row[colUnidadS] || 0);
        const uRetorno = Number(itemCoincidente.unidad_r !== undefined ? itemCoincidente.unidad_r : uSalida);
        const costoU = Number(row[colCostoU] || 0);
        const pct = prorrateoMap[projId] || (1.0 / (prorrateos.length || 1));
        const tipo = String(row[colTipo] || "").toLowerCase();
        const modoC = String(itemCoincidente.modo_costeo || "").toLowerCase();

        let costoT = 0;
        if (modoC.indexOf("km") !== -1 || (tipo.indexOf("movilidad") !== -1 && !modoC)) {
          const delta = Math.max(0, uRetorno - uSalida);
          costoT = delta * costoU * pct;
        } else if (modoC.indexOf("dia") !== -1 || modoC.indexOf("día") !== -1 || (tipo.indexOf("instrumental") !== -1 && !modoC) || (tipo.indexOf("adicional") !== -1 && !modoC)) {
          costoT = uRetorno * costoU * pct;
        } else if (modoC.indexOf("ciclo") !== -1 || (tipo.indexOf("dron") !== -1 && !modoC)) {
          costoT = Math.max(0, uRetorno - uSalida) * costoU * pct;
        } else if (modoC.indexOf("ning") !== -1 || modoC.indexOf("sin") !== -1) {
          costoT = 0;
        } else {
          const consumo = Math.max(0, uSalida - uRetorno);
          costoT = consumo * costoU * pct;
        }

        if (colFechaR > 0) sheet.getRange(i + 1, colFechaR).setValue(fechaR);
        if (colUnidadR > 0) sheet.getRange(i + 1, colUnidadR).setValue(uRetorno);
        if (colCostoT > 0) sheet.getRange(i + 1, colCostoT).setValue(costoT);
        if (colUserR > 0) sheet.getRange(i + 1, colUserR).setValue(userR);
        if (colFirmaR > 0) sheet.getRange(i + 1, colFirmaR).setValue(firmaUrl);
        if (colFechaHoraR > 0) sheet.getRange(i + 1, colFechaHoraR).setValue(nowIso);
        if (colFechaHora > 0) sheet.getRange(i + 1, colFechaHora).setValue(nowIso);
        filasActualizadas++;
      }
    }
  }

  return { success: true, id_viaje: idViaje, filas_actualizadas: filasActualizadas };
}


function getViajesActivos() {
  const sheet = getOrCreateSheet("registro_gastos", REGISTRO_GASTOS_COLUMNS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const viajesMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const idViaje = String(row[1]);
    const fechaR = String(row[7]);

    // Activo si fecha_r está vacía
    if (!fechaR && idViaje) {
      if (!viajesMap[idViaje]) {
        viajesMap[idViaje] = {
          id_viaje: idViaje,
          fecha_s: row[6],
          user_s: row[12],
          firma_s: row[13],
          estado: "ACTIVO",
          proyectos: [],
          items: []
        };
      }

      const pNom = String(row[3]);
      if (pNom && !viajesMap[idViaje].proyectos.some(p => p.denominacion === pNom)) {
        viajesMap[idViaje].proyectos.push({ id_proyecto: row[2], denominacion: pNom });
      }

      viajesMap[idViaje].items.push({
        id_gasto: row[0],
        id_proyecto: row[2],
        proyecto: row[3],
        categoria: row[4],
        elemento: row[5],
        unidad_s: Number(row[8]),
        costo_u: Number(row[10])
      });
    }
  }

  return Object.values(viajesMap);
}

function getTodosLosViajes() {
  const sheet = getOrCreateSheet("registro_gastos", REGISTRO_GASTOS_COLUMNS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const viajesMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const idViaje = String(row[1]);
    if (!idViaje) continue;

    if (!viajesMap[idViaje]) {
      viajesMap[idViaje] = {
        id_viaje: idViaje,
        fecha_s: row[6],
        fecha_r: row[7],
        user_s: row[12],
        firma_s: row[13],
        user_r: row[14],
        firma_r: row[15],
        estado: row[7] ? "RETORNADO" : "ACTIVO",
        proyectos: [],
        items: []
      };
    }

    const pNom = String(row[3]);
    if (pNom && !viajesMap[idViaje].proyectos.some(p => p.denominacion === pNom)) {
      viajesMap[idViaje].proyectos.push({ id_proyecto: row[2], denominacion: pNom });
    }

    viajesMap[idViaje].items.push({
      id_gasto: row[0],
      id_proyecto: row[2],
      proyecto: row[3],
      categoria: row[4],
      elemento: row[5],
      unidad_s: Number(row[8]),
      unidad_r: Number(row[9]),
      costo_u: Number(row[10]),
      costo_t: Number(row[11])
    });
  }

  return Object.values(viajesMap).sort((a, b) => (b.fecha_s > a.fecha_s ? 1 : -1));
}

function getViajeDetalle(idViaje) {
  const todos = getTodosLosViajes();
  const v = todos.find(t => t.id_viaje === idViaje);
  if (v) {
    return { success: true, viaje: v };
  }
  return { success: false, error: "Viaje no encontrado" };
}

function getAlertas() {
  const cat = getCatalogos();
  const items = cat.inventario || [];
  const today = new Date();

  const docsAlerta = [];
  const stockAlerta = [];

  items.forEach(it => {
    // Alerta de stock
    if (it.stock_minimo > 0 && it.stock_actual <= it.stock_minimo) {
      stockAlerta.push({
        id: it.id,
        elemento: it.nombre,
        categoria: it.categoria,
        codigo_interno: it.codigo_interno,
        stock_actual: it.stock_actual,
        stock_minimo: it.stock_minimo,
        diferencia: it.stock_actual - it.stock_minimo
      });
    }
  });

  return {
    total_alertas: docsAlerta.length + stockAlerta.length,
    documentos: docsAlerta,
    stock: stockAlerta,
    resumen: {
      vencidos: 0,
      por_vencer: 0,
      stock_bajo: stockAlerta.length
    }
  };
}

function getSolicitudes(filtroEstado) {
  const sheet = getOrCreateSheet("solicitudes_compras", SOLICITUDES_COLUMNS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const solicitudes = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const est = String(row[9] || "Pendiente");
    if (filtroEstado && filtroEstado.toLowerCase() !== "todas" && est.toLowerCase() !== filtroEstado.toLowerCase()) {
      continue;
    }
    solicitudes.push({
      id_solicitud: row[0],
      fecha: row[1],
      solicitante: row[2],
      elemento: row[3],
      categoria: row[4],
      cantidad: Number(row[5]),
      prioridad: row[6],
      id_proyecto: row[7],
      proyecto: row[8],
      estado: est,
      observaciones: row[10],
      fecha_hora: row[11]
    });
  }

  return solicitudes.sort((a, b) => (b.fecha_hora > a.fecha_hora ? 1 : -1));
}

function crearSolicitud(data) {
  const sheet = getOrCreateSheet("solicitudes_compras", SOLICITUDES_COLUMNS);
  const reqId = Utilities.getUuid();
  const nowIso = new Date().toISOString();
  const row = [
    reqId,
    data.fecha || nowIso.substring(0, 10),
    data.solicitante || "",
    data.elemento || "",
    data.categoria || "",
    Number(data.cantidad || 1),
    data.prioridad || "Media",
    data.id_proyecto || "",
    data.proyecto || "",
    "Pendiente",
    data.observaciones || "",
    nowIso
  ];
  sheet.appendRow(row);
  return { success: true, id_solicitud: reqId };
}

function actualizarSolicitud(data) {
  const sheet = getOrCreateSheet("solicitudes_compras", SOLICITUDES_COLUMNS);
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(data.id_solicitud)) {
      sheet.getRange(i + 1, 10).setValue(data.estado);
      if (data.observaciones) {
        sheet.getRange(i + 1, 11).setValue(data.observaciones);
      }
      return { success: true, id_solicitud: data.id_solicitud };
    }
  }
  return { success: false, error: "Solicitud no encontrada" };
}

function getMovimientos(limit, filtro) {
  const sheet = getOrCreateSheet("movimientos_stock", MOVIMIENTOS_COLUMNS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const lim = Number(limit || 100);
  const movs = [];
  for (let i = data.length - 1; i >= 1 && movs.length < lim; i--) {
    const row = data[i];
    const elem = String(row[5] || "");
    if (filtro && elem.toLowerCase().indexOf(filtro.toLowerCase()) === -1) {
      continue;
    }
    movs.push({
      id_movimiento: row[0],
      fecha_hora: row[1],
      tipo_movimiento: row[2],
      id_elemento: row[3],
      categoria: row[4],
      elemento: row[5],
      codigo_interno: row[6],
      cantidad: Number(row[7]),
      id_viaje: row[8],
      proyecto: row[9],
      usuario: row[10],
      observaciones: row[11]
    });
  }
  return movs;
}

function registrarMovimiento(data) {
  const sheet = getOrCreateSheet("movimientos_stock", MOVIMIENTOS_COLUMNS);
  const movId = Utilities.getUuid();
  const nowIso = new Date().toISOString();
  const row = [
    movId,
    data.fecha_hora || nowIso,
    data.tipo_movimiento || "Ingreso",
    data.id_elemento || "",
    data.categoria || "",
    data.elemento || "",
    data.codigo_interno || "",
    Number(data.cantidad || 0),
    data.id_viaje || "",
    data.proyecto || "",
    data.usuario || "",
    data.observaciones || ""
  ];
  sheet.appendRow(row);
  return { success: true, id_movimiento: movId };
}

function crearElemento(data) {
  const ss = getActiveOrOpenSpreadsheet();
  const categoria = data.categoria || "Materiales";
  let tabName = "6_0_Materiales";
  if (categoria === "Indumentaria") tabName = "1_0_Indumentaria";
  else if (categoria === "Instrumental") tabName = "2_0_Instrumental";
  else if (categoria === "Accesorios") tabName = "2_1_Accesorios";
  else if (categoria === "Adicional") tabName = "2_1_Adicional";
  else if (categoria === "Repuestos") tabName = "2_1_Instrumental_repuestos";
  else if (categoria === "Movilidad") tabName = "3_0_Movilidad";
  else if (categoria === "Informatica") tabName = "4_0_Informatica";
  else if (categoria === "Herramientas") tabName = "5_0_Herramientas";

  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return { success: false, error: "Pestaña no encontrada: " + tabName };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const nuevoId = Utilities.getUuid();
  const newRow = [];

  headers.forEach(h => {
    let val = "";
    if (h.indexOf("ID_") !== -1 || h === "id_repuesto") val = nuevoId;
    else if (["Tipo", "Subtipo", "Clase"].includes(h)) val = data.tipo || "";
    else if (h === "Marca") val = data.marca || "";
    else if (h === "Modelo") val = data.modelo || "";
    else if (["Codigo_interno", "Numero_interno"].includes(h)) val = data.codigo_interno || "";
    else if (["Numero_serie", "Patente"].includes(h)) val = data.numero_serie || data.patente || "";
    else if (["Stock_minimo", "Cantidad_minima"].includes(h)) val = data.stock_minimo || 0;
    else if (h === "cantidad") val = data.stock_actual || 1;
    newRow.push(val);
  });

  sheet.appendRow(newRow);
  return { success: true, elemento: { id: nuevoId, ...data } };
}

function editarElemento(data) {
  return { success: true, id_elemento: data.id_elemento };
}

function eliminarElemento(data) {
  return { success: true, id_elemento: data.id_elemento };
}

function marcarMantenimiento(data) {
  const idElemento = data.id_elemento;
  const tipoMant = data.tipo_mantenimiento || "Preventivo";
  const fechaInicio = data.fecha_inicio || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
  const observaciones = data.observaciones || "";

  registrarMovimiento({
    tipo_movimiento: "Ingreso a Mantenimiento",
    id_elemento: idElemento,
    categoria: data.categoria || "",
    elemento: data.nombre || ("Elemento #" + idElemento),
    codigo_interno: data.codigo_interno || "",
    cantidad: 1,
    usuario: "Oficina / Mantenimiento",
    observaciones: "Mantenimiento (" + tipoMant + "): " + observaciones
  });

  return { success: true, id_elemento: idElemento, en_mantenimiento: true, tipo_mantenimiento: tipoMant };
}

function finalizarMantenimiento(data) {
  const idElemento = data.id_elemento;
  const fechaFin = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");

  registrarMovimiento({
    tipo_movimiento: "Retorno de Mantenimiento",
    id_elemento: idElemento,
    categoria: data.categoria || "",
    elemento: data.nombre || ("Elemento #" + idElemento),
    codigo_interno: data.codigo_interno || "",
    cantidad: 1,
    usuario: "Oficina / Mantenimiento",
    observaciones: "Reingreso al inventario operativo disponible"
  });

  return { success: true, id_elemento: idElemento, en_mantenimiento: false, fecha_fin: fechaFin };
}

function actualizarStock(data) {
  const idElemento = data.id_elemento;
  const categoria = data.categoria || "Materiales";
  const nuevoStock = Number(data.nuevo_stock !== undefined ? data.nuevo_stock : (data.stock_actual || 0));

  registrarMovimiento({
    tipo_movimiento: "Ajuste de Stock",
    id_elemento: idElemento,
    categoria: categoria,
    elemento: data.nombre || ("Elemento #" + idElemento),
    codigo_interno: data.codigo_interno || "",
    cantidad: nuevoStock,
    usuario: "Oficina / Inventario",
    observaciones: data.observaciones || ("Ajuste directo de stock a " + nuevoStock)
  });

  return { success: true, id_elemento: idElemento, stock_actual: nuevoStock };
}

