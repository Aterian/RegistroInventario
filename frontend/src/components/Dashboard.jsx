import React, { useState } from 'react';
import { 
  Truck, 
  Clock, 
  User, 
  FileText, 
  ArrowRightCircle, 
  Search, 
  PlusCircle, 
  Package, 
  Layers, 
  CheckCircle, 
  ExternalLink 
} from 'lucide-react';
import { api } from '../api';

export const Dashboard = ({ 
  viajesActivos = [], 
  loading, 
  onNewSalida, 
  onOpenRetorno 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar viajes
  const filteredViajes = viajesActivos.filter(v => {
    const term = searchTerm.toLowerCase();
    const idMatch = (v.id_viaje || '').toLowerCase().includes(term);
    const userMatch = (v.user_s || '').toLowerCase().includes(term);
    const projsMatch = (Array.isArray(v.proyectos) ? v.proyectos.join(' ') : '').toLowerCase().includes(term);
    return idMatch || userMatch || projsMatch;
  });

  // Métricas
  const totalItemsCount = viajesActivos.reduce((acc, v) => acc + (v.items ? v.items.length : 0), 0);
  const totalProyectosSet = new Set();
  viajesActivos.forEach(v => {
    if (Array.isArray(v.proyectos)) {
      v.proyectos.forEach(p => totalProyectosSet.add(typeof p === 'object' ? p.denominacion : p));
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner / Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(204, 51, 51, 0.12)',
            color: 'var(--primary-red)'
          }}>
            <Truck size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              VIAJES EN CURSO
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {viajesActivos.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(6, 182, 212, 0.12)',
            color: 'var(--accent-cyan)'
          }}>
            <Package size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              ÍTEMS RETIRADOS
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {totalItemsCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(153, 153, 153, 0.15)',
            color: 'var(--corporate-gray)'
          }}>
            <Layers size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              PROYECTOS ACTIVOS
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {totalProyectosSet.size}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={onNewSalida}
            className="btn btn-primary"
            style={{ width: '100%', height: '100%', minHeight: '52px', fontSize: '0.95rem' }}
          >
            <PlusCircle size={18} /> Registrar Salida
          </button>
        </div>
      </div>

      {/* Header & Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginTop: '0.5rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--text-main)' }}>
            Control de Viajes en Terreno
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Listado de salidas pendientes de devolución y liquidación de inventario
          </p>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.3rem' }}
            placeholder="Buscar por ID, responsable o proyecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* List of Active Trips */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Cargando viajes en curso...</div>
        </div>
      ) : filteredViajes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <Truck size={48} color="var(--corporate-gray)" style={{ margin: '0 auto 1rem auto', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            {searchTerm ? 'No se encontraron viajes con ese criterio' : 'No hay viajes activos actualmente'}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
            Todos los elementos de inventario están registrados en base. Puedes registrar una nueva salida multiproyecto cuando un equipo salga a terreno.
          </p>
          <button onClick={onNewSalida} className="btn btn-primary">
            <PlusCircle size={16} /> Crear Nueva Salida
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredViajes.map((viaje) => {
            const proyectos = Array.isArray(viaje.proyectos) ? viaje.proyectos : [];
            const items = Array.isArray(viaje.items) ? viaje.items : [];
            const pdfUrl = api.getPdfUrl(viaje.id_viaje);

            return (
              <div key={viaje.id_viaje} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <span className="badge badge-active" style={{ marginBottom: '0.35rem' }}>
                      <Clock size={11} /> EN TERRENO
                    </span>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-dim)' }} title={viaje.id_viaje}>
                      ID: {viaje.id_viaje.slice(0, 8)}...{viaje.id_viaje.slice(-4)}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {viaje.fecha_s}
                  </span>
                </div>

                {/* Responsible Person */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                  <User size={16} color="var(--primary-red)" />
                  <span><strong>Retira:</strong> {viaje.user_s || 'Sin asignar'}</span>
                </div>

                {/* Projects Chips */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    PROYECTOS ASIGNADOS ({proyectos.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {proyectos.map((p, idx) => (
                      <span key={idx} style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--text-main)'
                      }}>
                        {typeof p === 'object' ? p.denominacion : p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Items preview */}
                <div style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.825rem',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Elementos Retirados:</span>
                    <span>{items.length} ítem(s)</span>
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {items.slice(0, 3).map((it, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                          • {it.elemento || it.nombre}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                          {it.unidad_s} {it.tipo === 'Movilidad' ? 'km' : 'unid'}
                        </span>
                      </li>
                    ))}
                    {items.length > 3 && (
                      <li style={{ color: 'var(--primary-red)', fontSize: '0.75rem', fontWeight: 600 }}>
                        + {items.length - 3} elemento(s) más...
                      </li>
                    )}
                  </ul>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline"
                    style={{ flex: 1, textDecoration: 'none' }}
                    title="Ver remito preliminar de salida"
                  >
                    <FileText size={14} /> Remito PDF
                  </a>

                  <button
                    onClick={() => onOpenRetorno(viaje)}
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1.3 }}
                  >
                    <ArrowRightCircle size={14} /> Registrar Retorno
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
