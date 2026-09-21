import React from 'react';
import { 
  PlusCircle, 
  RotateCcw, 
  Layers, 
  ShoppingCart, 
  FileText, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Package,
  Clock,
  Sparkles
} from 'lucide-react';
import logoIngeap from '../assets/logo_ingeap.png';

export const HomeMenuView = ({ 
  setCurrentTab, 
  onOpenSalida, 
  viajesActivosCount = 0,
  alertasCount = 0,
  totalItemsCount = 0,
  solicitudesPendientesCount = 0
}) => {
  const menuCards = [
    {
      id: 'salida',
      title: 'Nueva Salida de Viaje',
      desc: 'Despacho multiproyecto de movilidad, instrumental, accesorios y materiales.',
      icon: <PlusCircle size={28} color="#ffffff" />,
      bgGradient: 'linear-gradient(135deg, #cc3333 0%, #991b1b 100%)',
      action: () => {
        if (onOpenSalida) onOpenSalida();
        else setCurrentTab('viajes');
      },
      badge: 'Acción rápida',
      badgeColor: 'rgba(255, 255, 255, 0.2)'
    },
    {
      id: 'viajes',
      title: 'Viajes y Retornos',
      desc: 'Control de viajes en curso, registro de devolución, lecturas de odómetro y liquidación.',
      icon: <RotateCcw size={28} color="#06b6d4" />,
      bgGradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
      action: () => setCurrentTab('viajes'),
      badge: `${viajesActivosCount} en curso`,
      badgeColor: viajesActivosCount > 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(148, 163, 184, 0.15)'
    },
    {
      id: 'catalogo',
      title: 'Catálogo de Inventario',
      desc: 'Instrumental, movilidad, repuestos y materiales. Generación de QR y etiquetas PDF.',
      icon: <Layers size={28} color="#38bdf8" />,
      bgGradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
      action: () => setCurrentTab('catalogo'),
      badge: `${totalItemsCount || 'Items'} registrados`,
      badgeColor: 'rgba(56, 189, 248, 0.15)'
    },
    {
      id: 'solicitudes',
      title: 'Solicitudes de Compra',
      desc: 'Gestión de requerimientos y reposición de insumos por empleado o área operativa.',
      icon: <ShoppingCart size={28} color="#10b981" />,
      bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
      action: () => setCurrentTab('solicitudes'),
      badge: solicitudesPendientesCount > 0 ? `${solicitudesPendientesCount} pendientes` : 'Al día',
      badgeColor: solicitudesPendientesCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)'
    },
    {
      id: 'alertas',
      title: 'Alertas y Mantenimiento',
      desc: 'Control preventivo de vencimiento de seguros, calibraciones e insumos con stock bajo.',
      icon: <AlertTriangle size={28} color="#f59e0b" />,
      bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
      action: () => setCurrentTab('alertas'),
      badge: alertasCount > 0 ? `${alertasCount} alertas` : 'Sin alertas',
      badgeColor: alertasCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)'
    },
    {
      id: 'movimientos',
      title: 'Movimientos de Stock',
      desc: 'Trazabilidad completa de ingresos, egresos y control de repuestos en el Kardex.',
      icon: <FileText size={28} color="#a855f7" />,
      bgGradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
      action: () => setCurrentTab('movimientos'),
      badge: 'Kardex histórico',
      badgeColor: 'rgba(168, 85, 247, 0.15)'
    }
  ];

  return (
    <div style={{ padding: '1rem 0', maxWidth: '1180px', margin: '0 auto' }}>
      {/* Banner de Bienvenida Institucional */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <img 
            src={logoIngeap} 
            alt="Logo Ingeap" 
            style={{ 
              height: '52px', 
              objectFit: 'contain',
              background: 'rgba(255,255,255,0.06)',
              padding: '6px 12px',
              borderRadius: '8px'
            }} 
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                Sistema de Inventario y Viajes
              </h2>
              <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                v1.6
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ingeap Geoaplicaciones e Ingeniería • Control patrimonial, remitos digitales y logística
            </p>
          </div>
        </div>

        {/* Botón destacado Nueva Salida */}
        <button
          type="button"
          onClick={() => {
            if (onOpenSalida) onOpenSalida();
            else setCurrentTab('viajes');
          }}
          className="btn btn-primary"
          style={{
            padding: '0.75rem 1.4rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 14px rgba(204, 51, 51, 0.4)'
          }}
        >
          <PlusCircle size={20} /> Cargar Nueva Salida
        </button>
      </div>

      {/* Grilla de Módulos del Menú Principal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {menuCards.map(card => (
          <div
            key={card.id}
            onClick={card.action}
            style={{
              background: card.bgGradient,
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '155px',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.borderColor = 'rgba(204, 51, 51, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {card.icon}
                </div>
                {card.badge && (
                  <span style={{
                    background: card.badgeColor,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    color: '#f8fafc'
                  }}>
                    {card.badge}
                  </span>
                )}
              </div>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {card.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                {card.desc}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#38bdf8',
              marginTop: '1rem'
            }}>
              Ingresar al módulo <ArrowRight size={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
