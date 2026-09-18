import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { SalidaForm } from './components/SalidaForm';
import { RetornoModal } from './components/RetornoModal';
import { CatalogViewer } from './components/CatalogViewer';
import { CatalogEditorModal } from './components/CatalogEditorModal';
import { DashboardAlertas } from './components/DashboardAlertas';
import { MovimientosViewer } from './components/MovimientosViewer';
import { SolicitudesViewer } from './components/SolicitudesViewer';
import { ViajeDetalleModal } from './components/ViajeDetalleModal';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api';

export function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState(null);
  const [catalogos, setCatalogos] = useState({ proyectos: [], usuarios: [], inventario: [], categorias: [] });
  const [viajesActivos, setViajesActivos] = useState([]);
  const [alertasCount, setAlertasCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modales
  const [selectedViajeRetorno, setSelectedViajeRetorno] = useState(null);
  const [selectedViajeDetalle, setSelectedViajeDetalle] = useState(null);
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
      // Cargar en paralelo catálogos, estado, viajes y alertas
      const [estadoRes, catRes, viajesRes, alertasRes] = await Promise.allSettled([
        api.getEstado(),
        api.getCatalogos(forceRecargar),
        api.getViajesActivos(),
        api.getAlertas(),
      ]);

      if (estadoRes.status === 'fulfilled') {
        setServerStatus(estadoRes.value);
      } else {
        setServerStatus(null);
      }

      if (catRes.status === 'fulfilled') {
        setCatalogos(catRes.value);
      }

      if (viajesRes.status === 'fulfilled') {
        setViajesActivos(viajesRes.value);
      }

      if (alertasRes.status === 'fulfilled') {
        const res = alertasRes.value?.resumen;
        if (res) {
          const totalAlertas = (res.vencidos || 0) + (res.por_vencer || 0) + (res.stock_bajo || 0);
          setAlertasCount(totalAlertas);
        }
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
        {currentTab === 'dashboard' && (
          <Dashboard
            viajesActivos={viajesActivos}
            loading={loading}
            onNewSalida={() => setCurrentTab('salida')}
            onOpenRetorno={(v) => setSelectedViajeRetorno(v)}
            onOpenDetalle={(v) => setSelectedViajeDetalle(v)}
          />
        )}

        {currentTab === 'salida' && (
          <SalidaForm
            catalogos={catalogos}
            onSuccess={handleSalidaSuccess}
            onCancel={() => setCurrentTab('dashboard')}
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
          <MovimientosViewer />
        )}

        {currentTab === 'solicitudes' && (
          <SolicitudesViewer
            proyectos={catalogos.proyectos}
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
    </div>
  );
}

export default App;
