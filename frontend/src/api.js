/**
 * Ingeap API Client
 * Admite configuración dinámica de la IP del backend (especialmente útil para la app móvil en Android)
 */

export const getApiBaseUrl = () => {
  const savedUrl = localStorage.getItem('ingeap_backend_ip');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:8000/api';
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

const handleResponse = async (response) => {
  if (!response.ok) {
    let errorDetail = 'Error en el servidor';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = response.statusText || `Código de estado: ${response.status}`;
    }
    throw new Error(errorDetail);
  }
  return await response.json();
};

export const api = {
  // Estado del servidor y Google Sheets
  getEstado: async () => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/estado`, { cache: 'no-store' });
    return handleResponse(res);
  },

  // Catálogos completos
  getCatalogos: async (recargar = false) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/catalogos?recargar=${recargar}`);
    return handleResponse(res);
  },

  // CRUD Catálogo
  crearElemento: async (data) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/catalogos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  editarElemento: async (categoria, idElemento, data) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(idElemento)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  eliminarElemento: async (categoria, idElemento) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(idElemento)}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Tablero de Control y Alertas
  getAlertas: async () => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/alertas`, { cache: 'no-store' });
    return handleResponse(res);
  },

  setStockMinimo: async (idElemento, stockMinimo) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/stock-minimo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_elemento: idElemento, stock_minimo: stockMinimo }),
    });
    return handleResponse(res);
  },

  // Solicitudes de compra
  getSolicitudes: async (estado = null) => {
    const base = getApiBaseUrl();
    const url = estado ? `${base}/solicitudes?estado=${encodeURIComponent(estado)}` : `${base}/solicitudes`;
    const res = await fetch(url, { cache: 'no-store' });
    return handleResponse(res);
  },

  crearSolicitud: async (data) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/solicitudes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  actualizarSolicitud: async (idSolicitud, estado, observaciones = null) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/solicitudes/${encodeURIComponent(idSolicitud)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, observaciones }),
    });
    return handleResponse(res);
  },

  // Movimientos de Stock (Kardex)
  getMovimientos: async (limit = 100, filtro = null) => {
    const base = getApiBaseUrl();
    let url = `${base}/movimientos?limit=${limit}`;
    if (filtro) url += `&filtro=${encodeURIComponent(filtro)}`;
    const res = await fetch(url, { cache: 'no-store' });
    return handleResponse(res);
  },

  registrarMovimiento: async (data) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Lista de viajes en curso
  getViajesActivos: async () => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/activos`, { cache: 'no-store' });
    return handleResponse(res);
  },

  // Historial completo de viajes
  getTodosLosViajes: async () => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/todos`, { cache: 'no-store' });
    return handleResponse(res);
  },

  // Detalle de un viaje
  getViajeDetalle: async (idViaje) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/${idViaje}/detalle`);
    return handleResponse(res);
  },

  // Registro de salida multiproyecto
  registrarSalida: async (data) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/salida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Registro de retorno con prorrateo
  registrarRetorno: async (data) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/retorno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // URL para descarga o visualización de PDF
  getPdfUrl: (idViaje) => {
    const base = getApiBaseUrl();
    return `${base}/viajes/${idViaje}/pdf`;
  },
};
