import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Filter, 
  Building2, 
  User, 
  Save, 
  X, 
  RefreshCw 
} from 'lucide-react';
import { api } from '../api';

export const SolicitudesViewer = ({ proyectos = [], prefilledItem = null, onClearPrefilled }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('Pendiente');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario nueva solicitud
  const [elemento, setElemento] = useState('');
  const [categoria, setCategoria] = useState('Materiales');
  const [cantidad, setCantidad] = useState(1);
  const [solicitante, setSolicitante] = useState('');
  const [prioridad, setPrioridad] = useState('Media');
  const [idProyecto, setIdProyecto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      const data = await api.getSolicitudes(filtroEstado);
      setSolicitudes(data);
    } catch (err) {
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [filtroEstado]);

  // Si viene un prefilledItem desde el DashboardAlertas
  useEffect(() => {
    if (prefilledItem) {
      setElemento(prefilledItem.elemento || '');
      setCategoria(prefilledItem.categoria || 'Materiales');
      setCantidad(Math.max(1, (prefilledItem.stock_minimo || 1) - (prefilledItem.stock_actual || 0)));
      setPrioridad('Alta');
      setObservaciones(`Reposición por stock bajo (Stock actual: ${prefilledItem.stock_actual}, Mínimo: ${prefilledItem.stock_minimo})`);
      setIsModalOpen(true);
      if (onClearPrefilled) onClearPrefilled();
    }
  }, [prefilledItem]);

  const handleCrearSolicitud = async (e) => {
    e.preventDefault();
    if (!elemento.trim() || !solicitante.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedProj = proyectos.find(p => String(p.id_proyecto) === String(idProyecto));
      await api.crearSolicitud({
        elemento: elemento.trim(),
        categoria,
        cantidad: parseFloat(cantidad) || 1,
        solicitante: solicitante.trim(),
        prioridad,
        id_proyecto: idProyecto,
        proyecto: selectedProj ? selectedProj.denominacion : '',
        observaciones: observaciones.trim(),
      });
      setIsModalOpen(false);
      setElemento('');
      setCantidad(1);
      setSolicitante('');
      setObservaciones('');
      cargarSolicitudes();
    } catch (err) {
      alert('Error creando solicitud: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCambiarEstado = async (idSolicitud, nuevoEstado) => {
    try {
      await api.actualizarSolicitud(idSolicitud, nuevoEstado);
      cargarSolicitudes();
    } catch (err) {
      alert('Error actualizando solicitud: ' + err.message);
    }
  };

  const getPrioridadBadge = (p) => {
    switch (p) {
      case 'Urgente':
        return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>🔴 URGENTE</span>;
      case 'Alta':
        return <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>🟠 ALTA</span>;
      case 'Baja':
        return <span style={{ background: 'rgba(153, 153, 153, 0.2)', color: 'var(--corporate-gray)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>🟢 BAJA</span>;
      default:
        return <span style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>🟡 MEDIA</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={22} color="var(--primary-red)" />
            Solicitudes y Lista de Compras Pendientes
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Requerimientos de compra de materiales, insumos y herramientas para campo y oficina
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={cargarSolicitudes} 
            className="btn btn-sm btn-outline"
            title="Recargar solicitudes"
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={15} /> Nueva Solicitud de Compra
          </button>
        </div>
      </div>

      {/* Filtros de Estado */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {['Pendiente', 'Aprobada', 'Comprada', 'Descartada', 'Todas'].map(st => (
          <button
            key={st}
            onClick={() => setFiltroEstado(st)}
            className={`btn btn-sm ${filtroEstado === st ? 'btn-primary' : 'btn-secondary'}`}
          >
            {st === 'Pendiente' && <Clock size={13} style={{ marginRight: '4px' }} />}
            {st === 'Aprobada' && <CheckCircle size={13} style={{ marginRight: '4px' }} />}
            {st === 'Comprada' && <ShoppingCart size={13} style={{ marginRight: '4px' }} />}
            {st === 'Descartada' && <XCircle size={13} style={{ marginRight: '4px' }} />}
            {st}
          </button>
        ))}
      </div>

      {/* Grid de Tarjetas de Solicitudes */}
      {solicitudes.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          {loading ? 'Cargando solicitudes...' : `No hay solicitudes en estado "${filtroEstado}".`}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem'
        }}>
          {solicitudes.map((s) => (
            <div key={s.id_solicitud} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  {getPrioridadBadge(s.prioridad)}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {s.fecha || s.fecha_hora?.slice(0, 10)}
                  </span>
                </div>

                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  {s.elemento}
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--primary-red)', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Cantidad solicitada: {s.cantidad} u. ({s.categoria || 'General'})
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <User size={13} /> Solicitante: <strong style={{ color: 'var(--text-main)' }}>{s.solicitante}</strong>
                </div>

                {s.proyecto && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <Building2 size={13} /> Proyecto: {s.proyecto}
                  </div>
                )}

                {s.observaciones && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--corporate-gray)', marginTop: '0.4rem', fontStyle: 'italic', background: 'var(--bg-card-hover)', padding: '0.4rem', borderRadius: '4px' }}>
                    "{s.observaciones}"
                  </div>
                )}
              </div>

              {/* Botones de Acción de Estado */}
              <div style={{
                display: 'flex',
                gap: '0.4rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '0.75rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                {s.estado === 'Pendiente' && (
                  <>
                    <button 
                      onClick={() => handleCambiarEstado(s.id_solicitud, 'Aprobada')}
                      className="btn btn-sm btn-outline"
                      style={{ color: 'var(--accent-emerald)' }}
                    >
                      ✔️ Aprobar
                    </button>
                    <button 
                      onClick={() => handleCambiarEstado(s.id_solicitud, 'Descartada')}
                      className="btn btn-sm btn-outline"
                      style={{ color: 'var(--accent-red)' }}
                    >
                      ❌ Descartar
                    </button>
                  </>
                )}

                {s.estado === 'Aprobada' && (
                  <button 
                    onClick={() => handleCambiarEstado(s.id_solicitud, 'Comprada')}
                    className="btn btn-sm btn-primary"
                  >
                    🛒 Marcar como Comprada
                  </button>
                )}

                {s.estado === 'Comprada' && (
                  <span className="badge badge-success">
                    ✔️ Compra Finalizada
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva Solicitud */}
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
                  Nueva Solicitud de Compra
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Ingresa los detalles del material o insumo a adquirir
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-sm btn-outline">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCrearSolicitud} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Elemento / Material requerido *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 100 Estacas de madera 2x2, Pintura aerosol, Batería Topcon..."
                  value={elemento}
                  onChange={(e) => setElemento(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">Categoría</label>
                  <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="Materiales">Materiales</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Repuestos">Repuestos</option>
                    <option value="Indumentaria">Indumentaria</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Informatica">Informática</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">Cantidad Requerida *</label>
                  <input 
                    type="number" 
                    step="any" 
                    min="1"
                    className="form-input" 
                    value={cantidad} 
                    onChange={(e) => setCantidad(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">Solicitante (Empleado) *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nombre de quien solicita"
                    value={solicitante}
                    onChange={(e) => setSolicitante(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">Prioridad</label>
                  <select className="form-select" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Proyecto Asociado (Opcional)</label>
                <select className="form-select" value={idProyecto} onChange={(e) => setIdProyecto(e.target.value)}>
                  <option value="">General / Taller / Sin proyecto específico</option>
                  {proyectos.map(p => (
                    <option key={p.id_proyecto} value={p.id_proyecto}>
                      {p.denominacion || p.id_proyecto}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                <label className="form-label">Motivo o Justificación</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  placeholder="Motivo de la compra, proveedor sugerido, urgencia, etc."
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
                  {isSubmitting ? 'Guardando...' : 'Crear Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
