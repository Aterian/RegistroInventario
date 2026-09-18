import React from 'react';
import { 
  Truck, 
  Layers, 
  PlusCircle, 
  Settings, 
  Sun, 
  Moon, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  WifiOff 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const Navbar = ({ 
  currentTab, 
  setCurrentTab, 
  serverStatus, 
  onRefresh, 
  isRefreshing, 
  onOpenSettings 
}) => {
  const { theme, toggleTheme } = useTheme();

  const getStatusBadge = () => {
    if (!serverStatus) {
      return (
        <span className="badge badge-neutral" title="Conectando al backend...">
          <WifiOff size={12} /> Desconectado
        </span>
      );
    }
    if (serverStatus.google_connected && serverStatus.sheets_inventario) {
      return (
        <span className="badge badge-success" title="Conectado a Google Sheets y Drive">
          <CheckCircle2 size={12} /> Google Cloud Sincronizado
        </span>
      );
    }
    return (
      <span className="badge badge-active" title="Operando en SQLite local (Modo contingencia)">
        <AlertTriangle size={12} /> Modo Local (SQLite)
      </span>
    );
  };

  return (
    <header style={{
      backgroundColor: 'var(--bg-card)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1320px',
        margin: '0 auto',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        {/* Brand & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.25rem',
            boxShadow: '0 4px 12px var(--primary-red-glow)',
            fontFamily: 'var(--font-display)',
          }}>
            I
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ 
                fontFamily: 'var(--font-display)', 
                fontWeight: 800, 
                fontSize: '1.2rem', 
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
              }}>
                INGEAP
              </span>
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--primary-red)', 
                fontWeight: 700, 
                background: 'rgba(204,51,51,0.1)', 
                padding: '0.15rem 0.4rem', 
                borderRadius: '4px',
                border: '1px solid rgba(204,51,51,0.25)' 
              }}>
                OPERACIONES
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--corporate-gray)' }}>
              Gestión de Inventario y Viajes
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`btn btn-sm ${currentTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Truck size={15} /> Viajes Activos
          </button>
          <button
            onClick={() => setCurrentTab('salida')}
            className={`btn btn-sm ${currentTab === 'salida' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <PlusCircle size={15} /> Nueva Salida
          </button>
          <button
            onClick={() => setCurrentTab('catalogo')}
            className={`btn btn-sm ${currentTab === 'catalogo' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Layers size={15} /> Catálogo
          </button>
        </nav>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {getStatusBadge()}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-sm btn-outline"
            title="Sincronizar y recargar datos"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
          </button>

          <button
            onClick={onOpenSettings}
            className="btn btn-sm btn-outline"
            title="Configuración de Red / IP Backend"
          >
            <Settings size={14} />
          </button>

          <button
            onClick={toggleTheme}
            className="btn btn-sm btn-outline"
            title={theme === 'dark' ? 'Cambiar a Tema Claro' : 'Cambiar a Tema Oscuro'}
          >
            {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#6366f1" />}
          </button>
        </div>
      </div>
    </header>
  );
};
