import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  Package, 
  CheckCircle, 
  ShoppingCart, 
  RefreshCw, 
  ShieldAlert, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';

export const DashboardAlertas = ({ onCrearSolicitudParaItem }) => {
  const [alertasData, setAlertasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargarAlertas = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAlertas();
      setAlertasData(data);
    } catch (err) {
      setError(err.message || 'Error cargando alertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, []);

  const resumen = alertasData?.resumen || { vencidos: 0, por_vencer: 0, stock_bajo: 0 };
  const docs = alertasData?.documentos_alerta || [];
  const stock = alertasData?.stock_alerta || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert color="var(--primary-red)" size={24} />
            Tablero de Control y Alertas Preventivas
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Supervisión continua de vencimientos de documentación (seguros, calibraciones, VTV) y niveles de stock
          </p>
        </div>
        <button 
          onClick={cargarAlertas} 
          disabled={loading} 
          className="btn btn-sm btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          Actualizar Alertas
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)', padding: '0.75rem', color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* Vencidos o críticos <= 30d */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-red)' }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(239, 68, 68, 0.15)',
            color: 'var(--accent-red)'
          }}>
            <AlertCircle size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              DOCS. CRÍTICOS / VENCIDOS (&le; 30d)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-red)' }}>
              {resumen.vencidos}
            </div>
          </div>
        </div>

        {/* Alerta 31 a 60 días */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--accent-amber)'
          }}>
            <Clock size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              PRÓXIMOS A VENCER (31 A 60d)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
              {resumen.por_vencer}
            </div>
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(6, 182, 212, 0.15)',
            color: 'var(--accent-cyan)'
          }}>
            <Package size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              MATERIALES BAJO STOCK MÍNIMO
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {resumen.stock_bajo}
            </div>
          </div>
        </div>
      </div>

      {/* Sección: Documentación en Alerta */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} color="var(--primary-red)" />
            Documentación y Calibraciones en Alerta ({docs.length})
          </div>
        </div>

        {docs.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            🎉 No hay documentos vencidos ni por vencer en los próximos 60 días.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Estado</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Elemento / Equipo</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Documento / Trámite</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Fecha Vencimiento</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Días Restantes</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Google Drive</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, idx) => {
                  const isVencido = d.nivel === 'VENCIDO';
                  const isCritico = d.nivel === 'CRITICO';
                  const badgeColor = isVencido || isCritico ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                  const textColor = isVencido || isCritico ? 'var(--accent-red)' : 'var(--accent-amber)';

                  let diasTexto = '';
                  if (d.dias_restantes < 0) {
                    diasTexto = `Venció hace ${Math.abs(d.dias_restantes)} días`;
                  } else if (d.dias_restantes === 0) {
                    diasTexto = 'Vence hoy';
                  } else {
                    diasTexto = `En ${d.dias_restantes} días`;
                  }

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <span style={{
                          background: badgeColor,
                          color: textColor,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          {isVencido ? '🔴 VENCIDO' : (isCritico ? '🔴 CRÍTICO' : '🟡 ALERTA')}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.elemento}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)' }}>
                          {d.categoria} {d.codigo_interno ? `• [${d.codigo_interno}]` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', color: 'var(--text-main)' }}>
                        {d.denominacion}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {d.fecha_vencimiento}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', fontWeight: 700, color: textColor }}>
                        {diasTexto}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        {d.doc_url ? (
                          <a 
                            href={d.doc_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-sm btn-outline"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                          >
                            <ExternalLink size={13} /> Ver en Drive
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Sin enlace</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección: Stock Mínimo de Materiales */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} color="var(--accent-cyan)" />
            Materiales y Herramientas Bajo Stock Mínimo ({stock.length})
          </div>
        </div>

        {stock.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            ✔️ Todos los materiales y herramientas están por encima del stock mínimo configurado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Estado</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Elemento</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Categoría</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Stock Actual</th>
                  <th style={{ padding: '0.65rem 0.8rem' }}>Stock Mínimo</th>
                  <th style={{ padding: '0.65rem 0.8rem', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s, idx) => {
                  const isAgotado = s.stock_actual <= 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <span style={{
                          background: isAgotado ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isAgotado ? 'var(--accent-red)' : 'var(--accent-amber)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          {isAgotado ? '🔴 AGOTADO' : '🟠 BAJO STOCK'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {s.elemento}
                        {s.codigo_interno && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)', marginLeft: '0.4rem' }}>
                            [{s.codigo_interno}]
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', color: 'var(--corporate-gray)' }}>
                        {s.categoria}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', fontWeight: 800, color: isAgotado ? 'var(--accent-red)' : 'var(--accent-amber)' }}>
                        {s.stock_actual}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', color: 'var(--text-muted)' }}>
                        {s.stock_minimo}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', textAlign: 'right' }}>
                        {onCrearSolicitudParaItem && (
                          <button
                            onClick={() => onCrearSolicitudParaItem(s)}
                            className="btn btn-sm btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <ShoppingCart size={13} /> Solicitar Compra
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
