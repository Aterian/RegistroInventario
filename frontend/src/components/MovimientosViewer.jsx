import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  RefreshCw, 
  Calendar, 
  Clock, 
  User, 
  Package, 
  Sliders, 
  Save, 
  X 
} from 'lucide-react';
import { api } from '../api';

export const MovimientosViewer = ({ inventario = [] }) => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario de nuevo movimiento manual
  const [tipoMov, setTipoMov] = useState('Ingreso');
  const [categoria, setCategoria] = useState('Materiales');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [elementoNombre, setElementoNombre] = useState('');
  const [equipoDestino, setEquipoDestino] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [usuario, setUsuario] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      const data = await api.getMovimientos(150, searchTerm);
      setMovimientos(data);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, [searchTerm]);

  const handleCrearMovimiento = async (e) => {
    e.preventDefault();
    if (!elementoNombre.trim()) return;

    setIsSubmitting(true);
    try {
      let obsFinal = observaciones.trim();
      if (categoria === 'Repuestos' && equipoDestino) {
        obsFinal = obsFinal ? `${obsFinal} | Aplicado a: ${equipoDestino}` : `Aplicado a: ${equipoDestino}`;
      }

      await api.registrarMovimiento({
        tipo_movimiento: tipoMov,
        elemento: elementoNombre.trim(),
        categoria,
        cantidad: parseFloat(cantidad) || 1,
        usuario: usuario.trim() || 'Oficina / Depósito',
        observaciones: obsFinal,
      });
      setIsModalOpen(false);
      setSelectedItemId('');
      setElementoNombre('');
      setEquipoDestino('');
      setCantidad(1);
      setObservaciones('');
      cargarMovimientos();
    } catch (err) {
      alert('Error registrando movimiento: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTipoBadge = (tipo) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('salida')) {
      return (
        <span style={{
          background: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--accent-red)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 700,
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <ArrowUpRight size={12} /> Salida
        </span>
      );
    }
    if (t.includes('retorno')) {
      return (
        <span style={{
          background: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--accent-emerald)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 700,
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <ArrowDownLeft size={12} /> Retorno
        </span>
      );
    }
    if (t.includes('ingreso') || t.includes('alta')) {
      return (
        <span style={{
          background: 'rgba(6, 182, 212, 0.15)',
          color: 'var(--accent-cyan)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 700,
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          📥 Ingreso / Compra
        </span>
      );
    }
    return (
      <span style={{
        background: 'rgba(153, 153, 153, 0.15)',
        color: 'var(--corporate-gray)',
        padding: '0.2rem 0.5rem',
        borderRadius: '4px',
        fontWeight: 700,
        fontSize: '0.75rem'
      }}>
        {tipo}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={22} color="var(--primary-red)" />
            Movimientos de Catálogo y Stock (Kardex)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Registro cronológico de ingresos por compras, egresos por viajes y reingresos
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }} 
              placeholder="Filtrar por elemento..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button 
            onClick={cargarMovimientos} 
            className="btn btn-sm btn-outline"
            title="Recargar movimientos"
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={15} /> Registrar Movimiento Manual
          </button>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Fecha y Hora</th>
                <th style={{ padding: '0.75rem 1rem' }}>Operación</th>
                <th style={{ padding: '0.75rem 1rem' }}>Elemento / Código</th>
                <th style={{ padding: '0.75rem 1rem' }}>Cantidad</th>
                <th style={{ padding: '0.75rem 1rem' }}>Motivo / Referencia</th>
                <th style={{ padding: '0.75rem 1rem' }}>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    {loading ? 'Cargando movimientos...' : 'No se registraron movimientos con ese criterio.'}
                  </td>
                </tr>
              ) : (
                movimientos.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {m.fecha_hora ? m.fecha_hora.replace('T', ' ').slice(0, 19) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getTipoBadge(m.tipo_movimiento)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {m.elemento}
                      {m.codigo_interno && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)', marginLeft: '0.35rem' }}>
                          [{m.codigo_interno}]
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {m.cantidad}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      {m.observaciones || (m.proyecto ? `Proyecto: ${m.proyecto}` : '-')}
                      {m.id_viaje && (
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                          Viaje: #{m.id_viaje.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>
                      {m.usuario || 'Sistema'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Movimiento Manual */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', padding: '2rem 2.25rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.5rem',
              paddingBottom: '0.85rem',
              borderBottom: '1px solid var(--border-subtle)' 
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Registrar Movimiento Manual de Stock
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Añade ingresos por compras, ajustes directos o bajas de inventario
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-sm btn-outline">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCrearMovimiento} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">Tipo de Movimiento *</label>
                  <select className="form-select" value={tipoMov} onChange={(e) => setTipoMov(e.target.value)}>
                    <option value="Ingreso">📥 Ingreso (Compra / Reposición)</option>
                    <option value="Ajuste">⚙️ Ajuste de Inventario</option>
                    <option value="Baja">🗑️ Baja (Rotura / Obsolescencia)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">Categoría *</label>
                  <select 
                    className="form-select" 
                    value={categoria} 
                    onChange={(e) => {
                      setCategoria(e.target.value);
                      setSelectedItemId('');
                      setElementoNombre('');
                    }}
                  >
                    <option value="Materiales">Materiales</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Repuestos">Repuestos</option>
                    <option value="Indumentaria">Indumentaria</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Movilidad">Movilidad</option>
                  </select>
                </div>
              </div>

              {/* Selector de elemento del catálogo */}
              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Seleccionar Elemento del Catálogo *</label>
                <select
                  className="form-select"
                  value={selectedItemId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedItemId(val);
                    if (val && val !== 'OTRO') {
                      const it = inventario.find(i => String(i.id) === String(val));
                      if (it) {
                        setElementoNombre(it.nombre);
                      }
                    } else if (val === 'OTRO') {
                      setElementoNombre('');
                    }
                  }}
                >
                  <option value="">-- Seleccionar elemento del inventario --</option>
                  {inventario
                    .filter(i => (i.categoria || '').toLowerCase() === categoria.toLowerCase())
                    .map(it => (
                      <option key={it.id} value={it.id}>
                        {it.codigo_interno ? `[${it.codigo_interno}] ` : ''}{it.nombre} {it.numero_serie ? `(S/N: ${it.numero_serie})` : ''}
                      </option>
                    ))}
                  <option value="OTRO">-- Otro / Escribir manualmente --</option>
                </select>

                {/* Si elige OTRO o escribe descripción libre */}
                {(selectedItemId === 'OTRO' || selectedItemId === '') && (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ marginTop: '0.4rem' }}
                    placeholder="Descripción del elemento o insumo..."
                    value={elementoNombre}
                    onChange={(e) => setElementoNombre(e.target.value)}
                    required
                  />
                )}
              </div>

              {/* Si es categoría REPUESTOS: seleccionar en qué equipo se aplicó */}
              {categoria === 'Repuestos' && (
                <div className="form-group" style={{ marginBottom: '0.25rem', background: 'var(--bg-card-hover)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <label className="form-label" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    🔧 Equipo / Instrumental Destino (donde se aplicó)
                  </label>
                  <select
                    className="form-select"
                    value={equipoDestino}
                    onChange={(e) => setEquipoDestino(e.target.value)}
                  >
                    <option value="">-- Sin equipo específico / Almacén general --</option>
                    {inventario
                      .filter(i => i.categoria === 'Instrumental' || i.categoria === 'Movilidad' || i.categoria === 'Herramientas')
                      .map(it => (
                        <option key={it.id} value={`${it.nombre} [${it.codigo_interno || it.id}]`}>
                          [{it.categoria}] {it.codigo_interno ? `[${it.codigo_interno}] ` : ''}{it.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Cantidad *</label>
                <input 
                  type="number" 
                  step="any" 
                  className="form-input" 
                  value={cantidad} 
                  onChange={(e) => setCantidad(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Usuario / Responsable</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Nombre de quien registra"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Observaciones / N° Factura / Motivo</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  placeholder="Ej: Compra proveedor Corralón Norte, Factura B-1234..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '0.75rem', 
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)' 
              }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Guardando...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
