import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { SalidaForm } from './components/SalidaForm';
import { RetornoModal } from './components/RetornoModal';
import { CatalogViewer } from './components/CatalogViewer';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api';

export function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState(null);
  const [catalogos, setCatalogos] = useState({ proyectos: [], usuarios: [], inventario: [], categorias: [] });
  const [viajesActivos, setViajesActivos] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedViajeRetorno, setSelectedViajeRetorno] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async (forceRecargar = false) => {
    try {
      setIsRefreshing(true);
      // Cargar en paralelo
      const [estadoRes, catRes, viajesRes] = await Promise.allSettled([
        api.getEstado(),
        api.getCatalogos(forceRecargar),
        api.getViajesActivos(),
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
          />
        )}
      </main>

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
