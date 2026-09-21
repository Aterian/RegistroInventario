import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HomeMenuView } from './components/HomeMenuView';
import { Dashboard } from './components/Dashboard';
import { SalidaForm } from './components/SalidaForm';
import { RetornoModal } from './components/RetornoModal';
import { CatalogViewer } from './components/CatalogViewer';
import { CatalogEditorModal } from './components/CatalogEditorModal';
import { DashboardAlertas } from './components/DashboardAlertas';
import { MovimientosViewer } from './components/MovimientosViewer';
import { SolicitudesViewer } from './components/SolicitudesViewer';
import { ViajeDetalleModal } from './components/ViajeDetalleModal';
import { EditarSalidaModal } from './components/EditarSalidaModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api';

export function App() {
  const [currentTab, setCurrentTab] = useState('inicio');
  const [serverStatus, setServerStatus] = useState(null);
  const [catalogos, setCatalogos] = useState(() => {
    try {
      const cached = localStorage.getItem('ingeap_cached_catalog');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.proyectos?.length || parsed.usuarios?.length || parsed.inventario?.length)) {
          return parsed;
        }
      }
    } catch(e) {}
    return { proyectos: [], usuarios: [], inventario: [], categorias: [] };
  });
  const [viajesActivos, setViajesActivos] = useState([]);
  const [alertasCount, setAlertasCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modales
  const [selectedViajeRetorno, setSelectedViajeRetorno] = useState(null);
  const [selectedViajeDetalle, setSelectedViajeDetalle] = useState(null);
  const [selectedViajeEditar, setSelectedViajeEditar] = useState(null);
  const [isCatalogEditorOpen, setIsCatalogEditorOpen] = useState(false);
  const [elementoParaEditar, setElementoParaEditar] = useState(null);
  const [solicitudPreload, setSolicitudPreload] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async (forceRecargar = false) => {
    try {
      setIsRefreshing(true);

      // 1. Cargar estado de conexión
      try {
        const estado = await api.getEstado();
        setServerStatus(estado);
      } catch (e) {
        console.warn('Aviso al consultar estado:', e);
        setServerStatus(null);
      }

      // 2. Cargar catálogos completos (proyectos, usuarios, inventario)
      try {
        const cat = await api.getCatalogos(forceRecargar);
        if (cat && (cat.proyectos || cat.usuarios || cat.inventario)) {
          setCatalogos(cat);
        }
      } catch (e) {
        console.error('Error al cargar catálogos:', e);
        // Si falló el catálogo completo pero estamos en móvil, intentar traer al menos proyectos y usuarios
        try {
          const pyu = await api.getProyectosYUsuarios();
          if (pyu.proyectos?.length || pyu.usuarios?.length) {
            setCatalogos(prev => ({
              ...prev,
              proyectos: pyu.proyectos || prev.proyectos,
              usuarios: pyu.usuarios || prev.usuarios
            }));
          }
        } catch (ePyu) {
          console.warn('Fallback getProyectosYUsuarios falló:', ePyu);
        }
      }

      // 3. Cargar viajes activos y alertas
      try {
        const [viajes, alertasRes] = await Promise.all([
          api.getViajesActivos().catch(() => []),
          api.getAlertas().catch(() => ({ alertas: [] }))
        ]);
        if (viajes) setViajesActivos(viajes);
        const resAlertas = alertasRes?.resumen;
        if (resAlertas) {
          const totalAlertas = (resAlertas.vencidos || 0) + (resAlertas.por_vencer || 0) + (resAlertas.stock_bajo || 0);
          setAlertasCount(totalAlertas);
        }
      } catch (e) {
        console.warn('Aviso al cargar viajes/alertas:', e);
      }
    } catch (err) {
      console.error('Error general cargando datos:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
    // Sondeo suave cada 30 segundos
    const interval = setInterval(() => {
      api.getViajesActivos().then(res => setViajesActivos(res)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSalidaSuccess = () => {
    showToast('¡Salida multiproyecto registrada con éxito!', 'success');
    setCurrentTab('dashboard');
    loadData(false);
  };

  const handleRetornoSuccess = () => {
    showToast('¡Devolución y liquidación registrada con éxito!', 'success');
    setSelectedViajeRetorno(null);
    loadData(false);
  };

  return (
    <div className="app-container">
      {/* Toast Notification Banner */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999,
          padding: '0.75rem 1.25rem',
          borderRadius: '0.5rem',
          background: toast.type === 'success' ? '#10b981' : 'var(--primary-red)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '0.875rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.2s ease-out'
        }}>
          {toast.message}
        </div>
      )}

      {/* Navbar Superior */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        serverStatus={serverStatus}
        alertasCount={alertasCount}
        onRefresh={() => {
          loadData(true);
          showToast('Datos sincronizados con éxito', 'success');
        }}
        isRefreshing={isRefreshing}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Contenido Principal según Pestaña */}
      <main className="main-content">
        {currentTab === 'inicio' && (
          <HomeMenuView
            setCurrentTab={setCurrentTab}
            onOpenSalida={() => setCurrentTab('salida')}
            viajesActivosCount={viajesActivos.length}
            alertasCount={alertasCount}
            totalItemsCount={catalogos.inventario?.length || 0}
            solicitudesPendientesCount={0}
          />
        )}

        {(currentTab === 'dashboard' || currentTab === 'viajes') && (
          <Dashboard
            viajesActivos={viajesActivos}
            loading={loading}
            onNewSalida={() => setCurrentTab('salida')}
            onOpenRetorno={(v) => setSelectedViajeRetorno(v)}
            onOpenDetalle={(v) => setSelectedViajeDetalle(v)}
            onOpenEditarSalida={(v) => setSelectedViajeEditar(v)}
          />
        )}

        {currentTab === 'salida' && (
          <SalidaForm
            catalogos={catalogos}
            onSuccess={handleSalidaSuccess}
            onCancel={() => setCurrentTab('inicio')}
          />
        )}

        {currentTab === 'catalogo' && (
          <CatalogViewer
            catalogos={catalogos}
            onOpenCreateItem={() => {
              setElementoParaEditar(null);
              setIsCatalogEditorOpen(true);
            }}
            onOpenEditItem={(item) => {
              setElementoParaEditar(item);
              setIsCatalogEditorOpen(true);
            }}
            onReloadCatalog={() => loadData(true)}
          />
        )}

        {currentTab === 'alertas' && (
          <DashboardAlertas
            onCrearSolicitudParaItem={(elem) => {
              setSolicitudPreload(elem);
              setCurrentTab('solicitudes');
            }}
          />
        )}

        {currentTab === 'movimientos' && (
          <MovimientosViewer 
            inventario={catalogos.inventario}
          />
        )}

        {currentTab === 'solicitudes' && (
          <SolicitudesViewer
            proyectos={catalogos.proyectos}
            usuarios={catalogos.usuarios}
            prefilledItem={solicitudPreload}
            onClearPrefilled={() => setSolicitudPreload(null)}
          />
        )}
      </main>

      {/* Modal de Detalle Completo de Viaje */}
      {selectedViajeDetalle && (
        <ViajeDetalleModal
          isOpen={Boolean(selectedViajeDetalle)}
          onClose={() => setSelectedViajeDetalle(null)}
          viaje={selectedViajeDetalle}
          onOpenRetorno={(v) => {
            setSelectedViajeDetalle(null);
            setSelectedViajeRetorno(v);
          }}
          onOpenEditarSalida={(v) => {
            setSelectedViajeDetalle(null);
            setSelectedViajeEditar(v);
          }}
        />
      )}

      {/* Modal para Editar Ítems de Salida Registrada */}
      {selectedViajeEditar && (
        <EditarSalidaModal
          isOpen={Boolean(selectedViajeEditar)}
          onClose={() => setSelectedViajeEditar(null)}
          viaje={selectedViajeEditar}
          catalogos={catalogos}
          onSuccess={() => {
            setSelectedViajeEditar(null);
            loadData(false);
            showToast('Ítems de la salida actualizados correctamente', 'success');
          }}
        />
      )}

      {/* Modal de Retorno de Inventario */}
      {selectedViajeRetorno && (
        <RetornoModal
          isOpen={Boolean(selectedViajeRetorno)}
          onClose={() => setSelectedViajeRetorno(null)}
          viaje={selectedViajeRetorno}
          usuarios={catalogos.usuarios}
          onSuccess={handleRetornoSuccess}
        />
      )}

      {/* Modal de Editor de Catálogo (Creación y Edición) */}
      {isCatalogEditorOpen && (
        <CatalogEditorModal
          isOpen={isCatalogEditorOpen}
          onClose={() => {
            setIsCatalogEditorOpen(false);
            setElementoParaEditar(null);
          }}
          itemToEdit={elementoParaEditar}
          categorias={catalogos.categorias}
          inventarioCompleto={catalogos.inventario}
          onSuccess={() => {
            setIsCatalogEditorOpen(false);
            setElementoParaEditar(null);
            loadData(true);
            showToast('Catálogo actualizado con éxito', 'success');
          }}
        />
      )}

      {/* Modal de Configuración de IP / Servidor */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          loadData(false);
          showToast('Servidor actualizado', 'success');
        }}
      />

      {/* Barra de Navegación Inferior Móvil (intuitiva y nativa) */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenSalida={() => setCurrentTab('salida')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        viajesActivosCount={viajesActivos.length}
        alertasCount={alertasCount}
      />
    </div>
  );
}

export default App;
