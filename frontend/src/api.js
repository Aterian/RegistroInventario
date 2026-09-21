/**
 * Ingeap Unified Multi-Platform Bridge (Desktop & Mobile)
 * 
 * 1. MODO ESCRITORIO (PyWebView):
 *    Se comunica nativamente con Python mediante `window.pywebview.api` (ApiBridge),
 *    con latencia cero, sin necesidad de servidores HTTP en localhost ni puertos ocupados.
 *    Espera de forma segura el evento `pywebviewready` para inicializar sin errores.
 * 
 * 2. MODO MÓVIL / NUBE INDEPENDIENTE (Android / Capacitor / Navegador):
 *    Se comunica de forma 100% directa y continua con Google Cloud mediante
 *    la Web App de Google Apps Script o endpoint Cloud, SIN necesidad de encender
 *    la computadora de escritorio de la oficina.
 *    Incluye soporte OFFLINE completo para operaciones en zonas sin cobertura celular.
 */

let cachedBridge = null;
let bridgePromise = null;

if (typeof window !== 'undefined') {
  window.addEventListener('pywebviewready', () => {
    if (window.pywebview && window.pywebview.api) {
      cachedBridge = window.pywebview.api;
    }
  }, { once: true });
}

export const getDesktopBridge = async () => {
  if (cachedBridge) return cachedBridge;
  if (typeof window === 'undefined') return null;
  if (window.pywebview && window.pywebview.api) {
    cachedBridge = window.pywebview.api;
    return cachedBridge;
  }

  if (!bridgePromise) {
    bridgePromise = new Promise((resolve) => {
      let settled = false;
      const onReady = () => {
        if (!settled && window.pywebview && window.pywebview.api) {
          settled = true;
          cachedBridge = window.pywebview.api;
          resolve(cachedBridge);
        }
      };

      window.addEventListener('pywebviewready', onReady, { once: true });

      // Si después de 400ms no hay PyWebView, es móvil o navegador web
      setTimeout(() => {
        if (!settled) {
          settled = true;
          if (window.pywebview && window.pywebview.api) {
            cachedBridge = window.pywebview.api;
          } else {
            cachedBridge = null;
          }
          resolve(cachedBridge);
        }
      }, 400);
    });
  }

  return await bridgePromise;
};

export const isDesktopApp = () => {
  return typeof window !== 'undefined' && Boolean(cachedBridge || (window.pywebview && window.pywebview.api));
};

export const getGasUrl = () => {
  return localStorage.getItem('ingeap_gas_url') || '';
};

export const setGasUrl = (url) => {
  if (!url) {
    localStorage.removeItem('ingeap_gas_url');
  } else {
    localStorage.setItem('ingeap_gas_url', url.trim());
  }
};

export const getApiBaseUrl = () => {
  const savedUrl = localStorage.getItem('ingeap_backend_ip');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }
  return '/api';
};

export const setApiBaseUrl = (url) => {
  if (!url) {
    localStorage.removeItem('ingeap_backend_ip');
  } else {
    localStorage.setItem('ingeap_backend_ip', url.trim());
  }
};

// ----------------------------------------------------------------------
// GESTOR DE LLAMADAS A GOOGLE APPS SCRIPT (Cloud 24/7)
// ----------------------------------------------------------------------
async function callGas(action, payload = {}, method = 'POST') {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    throw new Error('No se configuró la URL de Google Apps Script. Ingrésela en Ajustes (⚙️).');
  }

  let finalUrl = gasUrl;
  let options = {};

  if (method === 'GET') {
    const query = new URLSearchParams({ action, ...payload }).toString();
    finalUrl = gasUrl.includes('?') ? `${gasUrl}&${query}` : `${gasUrl}?${query}`;
    options = {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };
  } else {
    options = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Evita preflight CORS restrictivo en Apps Script
      },
      body: JSON.stringify({ action, ...payload })
    };
  }

  const res = await fetch(finalUrl, options);
  if (!res.ok) {
    throw new Error(`Error en Google Apps Script (HTTP ${res.status}): ${res.statusText}`);
  }
  return await res.json();
}

// ----------------------------------------------------------------------
// COLA DE SINCRONIZACIÓN OFFLINE (Modo Terreno / Sin Cobertura)
// ----------------------------------------------------------------------
export const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem('ingeap_offline_queue') || '[]');
  } catch {
    return [];
  }
};

export const addOfflineQueue = (item) => {
  const queue = getOfflineQueue();
  queue.push({
    ...item,
    queued_at: new Date().toISOString()
  });
  localStorage.setItem('ingeap_offline_queue', JSON.stringify(queue));
};

export const syncOfflineQueue = async () => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, errors: 0 };

  const remaining = [];
  let synced = 0;
  let errors = 0;

  for (const item of queue) {
    try {
      if (item.action === 'registrarSalida') {
        await api.registrarSalida(item.data);
      } else if (item.action === 'registrarRetorno') {
        await api.registrarRetorno(item.data);
      }
      synced++;
    } catch (err) {
      console.warn('[OfflineSync] No se pudo sincronizar item pendiente:', err);
      remaining.push(item);
      errors++;
    }
  }

  localStorage.setItem('ingeap_offline_queue', JSON.stringify(remaining));
  return { synced, errors, remaining: remaining.length };
};

// ----------------------------------------------------------------------
// CLIENTE API UNIFICADO
// ----------------------------------------------------------------------
const handleFetchResponse = async (response) => {
  if (!response.ok) {
    let errorDetail = 'Error en el servidor';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = response.statusText || `Código: ${response.status}`;
    }
    throw new Error(errorDetail);
  }
  return await response.json();
};

export const api = {
  // Estado del sistema
  getEstado: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_estado) {
      return await bridge.get_estado();
    }
    if (getGasUrl()) {
      return await callGas('getEstado', {}, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/estado`, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  // Catálogos completos
  getCatalogos: async (recargar = false) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_catalogos) {
      return await bridge.get_catalogos(recargar);
    }

    // Móvil / Web
    if (getGasUrl()) {
      try {
        const data = await callGas('getCatalogos', { recargar }, 'GET');
        if (data && data.inventario) {
          localStorage.setItem('ingeap_cached_catalog', JSON.stringify(data));
        }
        return data;
      } catch (err) {
        // Fallback a caché local si estamos sin conexión en terreno
        const cached = localStorage.getItem('ingeap_cached_catalog');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.origen = 'offline_local_cache';
          parsed.offline = true;
          return parsed;
        }
        throw err;
      }
    }

    // Servidor REST tradicional
    try {
      const res = await fetch(`${getApiBaseUrl()}/catalogos?recargar=${recargar}`);
      const data = await handleFetchResponse(res);
      if (data && data.inventario) {
        localStorage.setItem('ingeap_cached_catalog', JSON.stringify(data));
      }
      return data;
    } catch (err) {
      const cached = localStorage.getItem('ingeap_cached_catalog');
      if (cached) return JSON.parse(cached);
      throw err;
    }
  },

  // CRUD Catálogo
  crearElemento: async (data) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.crear_elemento) {
      return await bridge.crear_elemento(data);
    }
    if (getGasUrl()) {
      return await callGas('crearElemento', data, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleFetchResponse(res);
  },

  editarElemento: async (categoria, idElemento, data) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.editar_elemento) {
      return await bridge.editar_elemento(categoria, idElemento, data);
    }
    if (getGasUrl()) {
      return await callGas('editarElemento', { categoria, id_elemento: idElemento, ...data }, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(idElemento)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleFetchResponse(res);
  },

  eliminarElemento: async (categoria, idElemento) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.eliminar_elemento) {
      return await bridge.eliminar_elemento(categoria, idElemento);
    }
    if (getGasUrl()) {
      return await callGas('eliminarElemento', { categoria, id_elemento: idElemento }, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(idElemento)}`, {
      method: 'DELETE',
    });
    return handleFetchResponse(res);
  },

  marcarMantenimiento: async (idElemento, tipoMantenimiento = 'Preventivo', fechaInicio = '', observaciones = '') => {
    const payload = { id_elemento: idElemento, tipo_mantenimiento: tipoMantenimiento, fecha_inicio: fechaInicio, observaciones: observaciones };
    const bridge = await getDesktopBridge();
    if (bridge && bridge.marcar_mantenimiento) {
      return await bridge.marcar_mantenimiento(payload);
    }
    if (getGasUrl()) {
      return await callGas('marcarMantenimiento', payload, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos/mantenimiento/${encodeURIComponent(idElemento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleFetchResponse(res);
  },

  finalizarMantenimiento: async (idElemento) => {
    const payload = { id_elemento: idElemento };
    const bridge = await getDesktopBridge();
    if (bridge && bridge.finalizar_mantenimiento) {
      return await bridge.finalizar_mantenimiento(payload);
    }
    if (getGasUrl()) {
      return await callGas('finalizarMantenimiento', payload, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos/mantenimiento-fin/${encodeURIComponent(idElemento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleFetchResponse(res);
  },

  actualizarStock: async (categoria, idElemento, nuevoStock, observaciones = '') => {
    const payload = { categoria, id_elemento: idElemento, nuevo_stock: nuevoStock, stock_actual: nuevoStock, observaciones };
    const bridge = await getDesktopBridge();
    if (bridge && bridge.actualizar_stock) {
      return await bridge.actualizar_stock(payload);
    }
    if (getGasUrl()) {
      return await callGas('actualizarStock', payload, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos/stock/${encodeURIComponent(categoria)}/${encodeURIComponent(idElemento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleFetchResponse(res);
  },


  // Tablero de Alertas
  getAlertas: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_alertas) {
      return await bridge.get_alertas();
    }
    if (getGasUrl()) {
      return await callGas('getAlertas', {}, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/alertas`, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  setStockMinimo: async (idElemento, stockMinimo) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.set_stock_minimo) {
      return await bridge.set_stock_minimo(idElemento, stockMinimo);
    }
    if (getGasUrl()) {
      return await callGas('setStockMinimo', { id_elemento: idElemento, stock_minimo: stockMinimo }, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/stock-minimo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_elemento: idElemento, stock_minimo: stockMinimo }),
    });
    return handleFetchResponse(res);
  },

  // Solicitudes de compra
  getSolicitudes: async (estado = null) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_solicitudes) {
      return await bridge.get_solicitudes(estado);
    }
    if (getGasUrl()) {
      return await callGas('getSolicitudes', { estado }, 'GET');
    }
    const url = estado ? `${getApiBaseUrl()}/solicitudes?estado=${encodeURIComponent(estado)}` : `${getApiBaseUrl()}/solicitudes`;
    const res = await fetch(url, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  crearSolicitud: async (data) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.crear_solicitud) {
      return await bridge.crear_solicitud(data);
    }
    if (getGasUrl()) {
      return await callGas('crearSolicitud', data, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/solicitudes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleFetchResponse(res);
  },

  actualizarSolicitud: async (idSolicitud, estado, observaciones = null) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.actualizar_solicitud) {
      return await bridge.actualizar_solicitud(idSolicitud, estado, observaciones);
    }
    if (getGasUrl()) {
      return await callGas('actualizarSolicitud', { id_solicitud: idSolicitud, estado, observaciones }, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/solicitudes/${encodeURIComponent(idSolicitud)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, observaciones }),
    });
    return handleFetchResponse(res);
  },

  // Movimientos de Stock (Kardex)
  getMovimientos: async (limit = 100, filtro = null) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_movimientos) {
      return await bridge.get_movimientos(limit, filtro);
    }
    if (getGasUrl()) {
      return await callGas('getMovimientos', { limit, filtro }, 'GET');
    }
    let url = `${getApiBaseUrl()}/movimientos?limit=${limit}`;
    if (filtro) url += `&filtro=${encodeURIComponent(filtro)}`;
    const res = await fetch(url, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  registrarMovimiento: async (data) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.registrar_movimiento) {
      return await bridge.registrar_movimiento(data);
    }
    if (getGasUrl()) {
      return await callGas('registrarMovimiento', data, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleFetchResponse(res);
  },

  // Viajes en curso
  getViajesActivos: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_viajes_activos) {
      return await bridge.get_viajes_activos();
    }
    if (getGasUrl()) {
      try {
        const data = await callGas('getViajesActivos', {}, 'GET');
        localStorage.setItem('ingeap_cached_viajes', JSON.stringify(data));
        return data;
      } catch (err) {
        const cached = localStorage.getItem('ingeap_cached_viajes');
        if (cached) return JSON.parse(cached);
        throw err;
      }
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/viajes/activos`, { cache: 'no-store' });
      const data = await handleFetchResponse(res);
      localStorage.setItem('ingeap_cached_viajes', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('ingeap_cached_viajes');
      if (cached) return JSON.parse(cached);
      throw err;
    }
  },

  // Historial completo
  getTodosLosViajes: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_todos_los_viajes) {
      return await bridge.get_todos_los_viajes();
    }
    if (getGasUrl()) {
      return await callGas('getTodosLosViajes', {}, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/viajes/todos`, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  // Detalle de viaje
  getViajeDetalle: async (idViaje) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.get_viaje_detalle) {
      return await bridge.get_viaje_detalle(idViaje);
    }
    if (getGasUrl()) {
      return await callGas('getViajeDetalle', { id_viaje: idViaje }, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/viajes/${idViaje}/detalle`);
    return handleFetchResponse(res);
  },

  // Salida multiproyecto
  registrarSalida: async (data) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.registrar_salida) {
      return await bridge.registrar_salida(data);
    }
    if (getGasUrl()) {
      try {
        return await callGas('registrarSalida', data, 'POST');
      } catch (err) {
        addOfflineQueue({ action: 'registrarSalida', data });
        return {
          success: true,
          offline: true,
          mensaje: 'Guardado localmente en el teléfono. Se sincronizará al detectar conexión.'
        };
      }
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/viajes/salida`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleFetchResponse(res);
    } catch (err) {
      addOfflineQueue({ action: 'registrarSalida', data });
      return {
        success: true,
        offline: true,
        mensaje: 'Guardado localmente. Se sincronizará con Google Sheets al recuperar conexión.'
      };
    }
  },

  // Editar elementos de salida activa
  editarSalida: async (idViaje, data) => {
    const payload = { id_viaje: idViaje, ...data };
    const bridge = await getDesktopBridge();
    if (bridge && bridge.editar_salida) {
      return await bridge.editar_salida(payload);
    }
    if (getGasUrl()) {
      return await callGas('editarSalida', payload, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/viajes/${encodeURIComponent(idViaje)}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleFetchResponse(res);
  },

  // Retorno de viaje
  registrarRetorno: async (data) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.registrar_retorno) {
      return await bridge.registrar_retorno(data);
    }
    if (getGasUrl()) {
      try {
        return await callGas('registrarRetorno', data, 'POST');
      } catch (err) {
        addOfflineQueue({ action: 'registrarRetorno', data });
        return {
          success: true,
          offline: true,
          mensaje: 'Retorno guardado en el teléfono. Se sincronizará al detectar conexión.'
        };
      }
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/viajes/retorno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleFetchResponse(res);
    } catch (err) {
      addOfflineQueue({ action: 'registrarRetorno', data });
      return {
        success: true,
        offline: true,
        mensaje: 'Retorno guardado localmente. Pendiente de sincronización.'
      };
    }
  },

  // Remito PDF
  abrirRemito: async (idViaje) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.abrir_remito_pdf) {
      return await bridge.abrir_remito_pdf(idViaje);
    }
    window.open(`${getApiBaseUrl()}/viajes/${idViaje}/pdf`, '_blank');
    return { success: true };
  },

  getPdfUrl: (idViaje) => {
    return `${getApiBaseUrl()}/viajes/${idViaje}/pdf`;
  },

  // Funciones exclusivas de escritorio (Bandeja, actualización)
  minimizar: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.minimizar_a_bandeja) {
      return await bridge.minimizar_a_bandeja();
    }
    return { exito: true };
  },

  verificarActualizacion: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.verificar_actualizacion) {
      return await bridge.verificar_actualizacion();
    }
    return { actualizacion_disponible: false };
  },

  aplicarActualizacion: async (urlDescarga) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.aplicar_actualizacion) {
      return await bridge.aplicar_actualizacion(urlDescarga);
    }
    return { exito: false };
  },

  obtenerConfigSheets: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.obtener_config_sheets) {
      return await bridge.obtener_config_sheets();
    }
    return {};
  },

  guardarConfigSheets: async (config) => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.guardar_config_sheets) {
      return await bridge.guardar_config_sheets(config);
    }
    return { exito: true };
  },

  probarConexionSheets: async () => {
    const bridge = await getDesktopBridge();
    if (bridge && bridge.probar_conexion_sheets) {
      return await bridge.probar_conexion_sheets();
    }
    return { connected: false };
  }
};
