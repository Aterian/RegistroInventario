/**
 * Ingeap Unified Multi-Platform Bridge (Desktop & Mobile)
 * 
 * 1. MODO ESCRITORIO (PyWebView):
 *    Se comunica nativamente con Python mediante `window.pywebview.api` (ApiBridge),
 *    con latencia cero, sin necesidad de servidores HTTP en localhost ni puertos ocupados.
 * 
 * 2. MODO MÓVIL / NUBE INDEPENDIENTE (Android / Capacitor / Navegador):
 *    Se comunica de forma 100% directa y continua con Google Cloud mediante
 *    la Web App de Google Apps Script o endpoint Cloud, SIN necesidad de encender
 *    la computadora de escritorio de la oficina.
 *    Incluye soporte OFFLINE completo para operaciones en zonas sin cobertura celular.
 */

export const isDesktopApp = () => {
  return typeof window !== 'undefined' && Boolean(window.pywebview && window.pywebview.api);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.get_estado();
    }
    if (getGasUrl()) {
      return await callGas('getEstado', {}, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/estado`, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  // Catálogos completos
  getCatalogos: async (recargar = false) => {
    if (isDesktopApp()) {
      return await window.pywebview.api.get_catalogos(recargar);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.crear_elemento(data);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.editar_elemento(categoria, idElemento, data);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.eliminar_elemento(categoria, idElemento);
    }
    if (getGasUrl()) {
      return await callGas('eliminarElemento', { categoria, id_elemento: idElemento }, 'POST');
    }
    const res = await fetch(`${getApiBaseUrl()}/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(idElemento)}`, {
      method: 'DELETE',
    });
    return handleFetchResponse(res);
  },

  // Tablero de Alertas
  getAlertas: async () => {
    if (isDesktopApp()) {
      return await window.pywebview.api.get_alertas();
    }
    if (getGasUrl()) {
      return await callGas('getAlertas', {}, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/alertas`, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  setStockMinimo: async (idElemento, stockMinimo) => {
    if (isDesktopApp()) {
      return await window.pywebview.api.set_stock_minimo(idElemento, stockMinimo);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.get_solicitudes(estado);
    }
    if (getGasUrl()) {
      return await callGas('getSolicitudes', { estado }, 'GET');
    }
    const url = estado ? `${getApiBaseUrl()}/solicitudes?estado=${encodeURIComponent(estado)}` : `${getApiBaseUrl()}/solicitudes`;
    const res = await fetch(url, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  crearSolicitud: async (data) => {
    if (isDesktopApp()) {
      return await window.pywebview.api.crear_solicitud(data);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.actualizar_solicitud(idSolicitud, estado, observaciones);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.get_movimientos(limit, filtro);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.registrar_movimiento(data);
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
    if (isDesktopApp()) {
      return await window.pywebview.api.get_viajes_activos();
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
    if (isDesktopApp()) {
      return await window.pywebview.api.get_todos_los_viajes();
    }
    if (getGasUrl()) {
      return await callGas('getTodosLosViajes', {}, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/viajes/todos`, { cache: 'no-store' });
    return handleFetchResponse(res);
  },

  // Detalle de viaje
  getViajeDetalle: async (idViaje) => {
    if (isDesktopApp()) {
      return await window.pywebview.api.get_viaje_detalle(idViaje);
    }
    if (getGasUrl()) {
      return await callGas('getViajeDetalle', { id_viaje: idViaje }, 'GET');
    }
    const res = await fetch(`${getApiBaseUrl()}/viajes/${idViaje}/detalle`);
    return handleFetchResponse(res);
  },

  // Salida multiproyecto
  registrarSalida: async (data) => {
    if (isDesktopApp()) {
      return await window.pywebview.api.registrar_salida(data);
    }
    if (getGasUrl()) {
      try {
        return await callGas('registrarSalida', data, 'POST');
      } catch (err) {
        // Si no hay red, guardar en cola offline
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

  // Retorno de viaje
  registrarRetorno: async (data) => {
    if (isDesktopApp()) {
      return await window.pywebview.api.registrar_retorno(data);
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
    if (isDesktopApp() && window.pywebview.api.abrir_remito_pdf) {
      return await window.pywebview.api.abrir_remito_pdf(idViaje);
    }
    window.open(`${getApiBaseUrl()}/viajes/${idViaje}/pdf`, '_blank');
    return { success: true };
  },

  getPdfUrl: (idViaje) => {
    return `${getApiBaseUrl()}/viajes/${idViaje}/pdf`;
  },

  // Funciones exclusivas de escritorio (Bandeja, actualización)
  minimizar: async () => {
    if (isDesktopApp() && window.pywebview.api.minimizar_a_bandeja) {
      return await window.pywebview.api.minimizar_a_bandeja();
    }
    return { exito: true };
  },

  verificarActualizacion: async () => {
    if (isDesktopApp() && window.pywebview.api.verificar_actualizacion) {
      return await window.pywebview.api.verificar_actualizacion();
    }
    return { actualizacion_disponible: false };
  },

  aplicarActualizacion: async (urlDescarga) => {
    if (isDesktopApp() && window.pywebview.api.aplicar_actualizacion) {
      return await window.pywebview.api.aplicar_actualizacion(urlDescarga);
    }
    return { exito: false };
  },

  obtenerConfigSheets: async () => {
    if (isDesktopApp() && window.pywebview.api.obtener_config_sheets) {
      return await window.pywebview.api.obtener_config_sheets();
    }
    return {};
  },

  guardarConfigSheets: async (config) => {
    if (isDesktopApp() && window.pywebview.api.guardar_config_sheets) {
      return await window.pywebview.api.guardar_config_sheets(config);
    }
    return { exito: true };
  },

  probarConexionSheets: async () => {
    if (isDesktopApp() && window.pywebview.api.probar_conexion_sheets) {
      return await window.pywebview.api.probar_conexion_sheets();
    }
    return { connected: false };
  }
};
