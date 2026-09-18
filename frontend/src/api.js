/**
 * Ingeap API Client
 * Admite configuración dinámica de la IP del backend (especialmente útil para la app móvil en Android)
 */

export const getApiBaseUrl = () => {
  const savedUrl = localStorage.getItem('ingeap_backend_ip');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }
  // Si estamos en PyWebView (archivo local o localhost) o Vite dev:
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

  // Lista de viajes en curso
  getViajesActivos: async () => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/activos`, { cache: 'no-store' });
    return handleResponse(res);
  },

  // Detalle de un viaje
  getViajeDetalle: async (idViaje) => {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/viajes/${idViaje}`);
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
