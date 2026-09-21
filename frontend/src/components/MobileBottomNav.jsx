import React, { useState } from 'react';
import { 
  Home, 
  Truck, 
  Plus, 
  Layers, 
  MoreHorizontal, 
  ShieldAlert, 
  ArrowLeftRight, 
  ShoppingCart, 
  Settings, 
  Sun, 
  Moon, 
  X 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const MobileBottomNav = ({ 
  currentTab, 
  setCurrentTab, 
  viajesActivosCount = 0, 
  alertasCount = 0,
  onOpenSettings
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleSelectTab = (tab) => {
    setCurrentTab(tab);
    setIsMoreMenuOpen(false);
  };

  return (
    <>
      {/* Menú Sheet "Más Opciones" */}
      {isMoreMenuOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsMoreMenuOpen(false)}
          style={{ zIndex: 1050, alignItems: 'flex-end', padding: 0 }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '100%',
              borderRadius: '20px 20px 0 0',
              padding: '1.25rem 1.25rem 2rem 1.25rem',
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border-strong)',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
              animation: 'slideUp 0.25s ease-out'
            }}
          >
            {/* Header del menú Más */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '0.75rem'
            }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                Módulos y Configuración
              </div>
              <button 
                onClick={() => setIsMoreMenuOpen(false)} 
                className="btn btn-sm btn-outline"
                style={{ padding: '0.3rem 0.5rem' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Grid de Accesos Rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {/* Alertas */}
              <button
                onClick={() => handleSelectTab('alertas')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: currentTab === 'alertas' ? 'rgba(204,51,51,0.15)' : 'var(--bg-surface-elevated)',
                  border: `1px solid ${currentTab === 'alertas' ? 'var(--primary-red)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--accent-red)',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  display: 'flex'
                }}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Control / Alertas</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--corporate-gray)' }}>
                    {alertasCount > 0 ? `${alertasCount} pendientes` : 'Al día'}
                  </div>
                </div>
              </button>

              {/* Kardex Movimientos */}
              <button
                onClick={() => handleSelectTab('movimientos')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: currentTab === 'movimientos' ? 'rgba(204,51,51,0.15)' : 'var(--bg-surface-elevated)',
                  border: `1px solid ${currentTab === 'movimientos' ? 'var(--primary-red)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  display: 'flex'
                }}>
                  <ArrowLeftRight size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Movimientos</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--corporate-gray)' }}>Kardex y auditoría</div>
                </div>
              </button>

              {/* Solicitudes de compra */}
              <button
                onClick={() => handleSelectTab('solicitudes')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: currentTab === 'solicitudes' ? 'rgba(204,51,51,0.15)' : 'var(--bg-surface-elevated)',
                  border: `1px solid ${currentTab === 'solicitudes' ? 'var(--primary-red)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: 'var(--accent-amber)',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  display: 'flex'
                }}>
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Compras</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--corporate-gray)' }}>Solicitudes operativas</div>
                </div>
              </button>

              {/* Ajustes de Red / Servidor */}
              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  if (onOpenSettings) onOpenSettings();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  background: 'rgba(153, 153, 153, 0.15)',
                  color: 'var(--corporate-gray)',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  display: 'flex'
                }}>
                  <Settings size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Ajustes</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--corporate-gray)' }}>Conexión y Cloud</div>
                </div>
              </button>
            </div>

            {/* Selector de tema en el menú Más */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Tema visual ({theme === 'dark' ? 'Oscuro' : 'Claro'})
              </span>
              <button 
                onClick={toggleTheme}
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem' }}
              >
                {theme === 'dark' ? <Sun size={15} color="#eab308" /> : <Moon size={15} color="#6366f1" />}
                <span style={{ fontSize: '0.75rem' }}>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra Inferior Fija (Bottom Navigation Bar) */}
      <nav 
        className="mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          backgroundColor: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 1000,
          padding: '0 0.5rem',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.25)'
        }}
      >
        {/* 1. Inicio */}
        <button
          onClick={() => handleSelectTab('inicio')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            color: currentTab === 'inicio' ? 'var(--primary-red)' : 'var(--text-dim)',
            padding: '4px 0',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Home size={19} strokeWidth={currentTab === 'inicio' ? 2.5 : 1.8} />
          <span style={{ fontSize: '0.68rem', fontWeight: currentTab === 'inicio' ? 700 : 500 }}>
            Inicio
          </span>
        </button>

        {/* 2. Viajes */}
        <button
          onClick={() => handleSelectTab('dashboard')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            color: (currentTab === 'dashboard' || currentTab === 'viajes') ? 'var(--primary-red)' : 'var(--text-dim)',
            padding: '4px 0',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ position: 'relative' }}>
            <Truck size={19} strokeWidth={(currentTab === 'dashboard' || currentTab === 'viajes') ? 2.5 : 1.8} />
            {viajesActivosCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-8px',
                background: 'var(--primary-red)',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 800,
                padding: '0.05rem 0.3rem',
                borderRadius: '8px',
                minWidth: '14px',
                textAlign: 'center'
              }}>
                {viajesActivosCount}
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: (currentTab === 'dashboard' || currentTab === 'viajes') ? 700 : 500 }}>
            Viajes
          </span>
        </button>

        {/* 3. Botón Central Destacado: Salida */}
        <button
          onClick={() => handleSelectTab('salida')}
          style={{
            flex: 1.1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginTop: '-14px'
          }}
        >
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(200, 30, 43, 0.45)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            transform: currentTab === 'salida' ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 0.15s ease'
          }}>
            <Plus size={24} strokeWidth={2.6} />
          </div>
          <span style={{ 
            fontSize: '0.68rem', 
            fontWeight: 800, 
            color: currentTab === 'salida' ? 'var(--primary-red)' : 'var(--text-main)', 
            marginTop: '2px' 
          }}>
            Salida
          </span>
        </button>

        {/* 4. Catálogo */}
        <button
          onClick={() => handleSelectTab('catalogo')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            color: currentTab === 'catalogo' ? 'var(--primary-red)' : 'var(--text-dim)',
            padding: '4px 0',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={19} strokeWidth={currentTab === 'catalogo' ? 2.5 : 1.8} />
          <span style={{ fontSize: '0.68rem', fontWeight: currentTab === 'catalogo' ? 700 : 500 }}>
            Catálogo
          </span>
        </button>

        {/* 5. Más */}
        <button
          onClick={() => setIsMoreMenuOpen(true)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            color: isMoreMenuOpen ? 'var(--primary-red)' : 'var(--text-dim)',
            padding: '4px 0',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ position: 'relative' }}>
            <MoreHorizontal size={19} strokeWidth={1.8} />
            {alertasCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-6px',
                background: 'var(--accent-red)',
                width: '7px',
                height: '7px',
                borderRadius: '50%'
              }} />
            )}
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: isMoreMenuOpen ? 700 : 500 }}>
            Más
          </span>
        </button>
      </nav>
    </>
  );
};
