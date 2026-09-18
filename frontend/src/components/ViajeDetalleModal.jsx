import React from 'react';
import { 
  X, 
  Truck, 
  Calendar, 
  User, 
  Building2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  FileCheck, 
  Download 
} from 'lucide-react';
import { api } from '../api';

export const ViajeDetalleModal = ({ isOpen, onClose, viaje, onOpenRetorno }) => {
  if (!isOpen || !viaje) return null;

  const isActivo = !viaje.fecha_r;
  const proyectos = viaje.proyectos || [];
  const items = viaje.items || [];

  const pdfUrl = api.getPdfUrl(viaje.id_viaje);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '880px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem 2.25rem' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Detalle de Viaje
              </span>
              <span style={{ 
                fontSize: '0.8rem', 
                fontFamily: 'monospace', 
                background: 'var(--bg-card-hover)', 
                padding: '0.2rem 0.5rem', 
                borderRadius: '4px',
                color: 'var(--text-muted)' 
              }}>
                #{viaje.id_viaje}
              </span>
              <span className={`badge ${isActivo ? 'badge-active' : 'badge-success'}`}>
                {isActivo ? '🟢 ACTIVO' : '✔️ FINALIZADO'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Registro completo de elementos, proyectos asignados y remitos oficiales
            </div>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline">
            <X size={16} />
          </button>
        </div>

        {/* Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Datos de Salida */}
          <div style={{
            background: 'var(--bg-card-hover)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-red)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Información de Salida
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Calendar size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                {viaje.fecha_s || 'No especificada'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <User size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                {viaje.user_s || 'No especificado'}
              </span>
            </div>
            {viaje.firma_s && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Firma Salida:</div>
                <img 
                  src={viaje.firma_s} 
                  alt="Firma Salida" 
                  style={{ maxHeight: '45px', border: '1px dashed var(--border-subtle)', borderRadius: '4px', background: '#fff', padding: '2px' }} 
                />
              </div>
            )}
          </div>

          {/* Datos de Retorno */}
          <div style={{
            background: 'var(--bg-card-hover)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isActivo ? 'var(--corporate-gray)' : 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Información de Retorno
            </div>
            {isActivo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '1rem' }}>
                <Clock size={16} /> Pendiente de devolución
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Calendar size={14} color="var(--text-dim)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                    {viaje.fecha_r}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <User size={14} color="var(--text-dim)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    {viaje.user_r || 'No especificado'}
                  </span>
                </div>
                {viaje.firma_r && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Firma Retorno:</div>
                    <img 
                      src={viaje.firma_r} 
                      alt="Firma Retorno" 
                      style={{ maxHeight: '45px', border: '1px dashed var(--border-subtle)', borderRadius: '4px', background: '#fff', padding: '2px' }} 
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Proyectos Asignados */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={15} /> PROYECTOS ASIGNADOS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {proyectos.map((p, idx) => (
              <span 
                key={idx} 
                style={{
                  background: 'rgba(6, 182, 212, 0.12)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  color: 'var(--accent-cyan)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {typeof p === 'object' ? (p.denominacion || p.nombre || p.id_proyecto) : String(p)}
              </span>
            ))}
          </div>
        </div>

        {/* Tabla Completa de Ítems */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Truck size={15} /> ELEMENTOS REGISTRADOS ({items.length})
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Tipo / Cat.</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Elemento</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Salida</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Retorno</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Costo Unit.</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const tipo = (it.tipo || it.categoria || '').toLowerCase();
                  const isMov = tipo.includes('movilidad');
                  const isIns = tipo.includes('instrumental') && !tipo.includes('dron');
                  
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--corporate-gray)' }}>
                        {it.tipo || it.categoria || 'Ítem'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {it.elemento || it.nombre}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-main)' }}>
                        {it.unidad_s} {isMov ? 'km' : (isIns ? '(Días al ret.)' : 'u')}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: isActivo ? 'var(--text-dim)' : 'var(--accent-cyan)', fontWeight: isActivo ? 'normal' : 'bold' }}>
                        {isActivo ? 'Pendiente' : `${it.unidad_r} ${isMov ? 'km' : (isIns ? 'días' : 'u')}`}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>
                        ${Number(it.costo_u || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--primary-red)', fontWeight: 700 }}>
                        ${Number(it.costo_t || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1rem'
        }}>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
          >
            <Download size={16} /> Descargar Remito Oficial PDF
          </a>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isActivo && onOpenRetorno && (
              <button 
                onClick={() => { onClose(); onOpenRetorno(viaje); }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <CheckCircle2 size={16} /> Registrar Devolución
              </button>
            )}
            <button onClick={onClose} className="btn btn-secondary">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
