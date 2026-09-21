import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Search, 
  Tag, 
  Hash, 
  Plus, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  FileText, 
  Box, 
  Wrench, 
  Truck, 
  Laptop, 
  Shirt, 
  Shield, 
  Package, 
  Key,
  QrCode,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';
import { QRLabelModal } from './QRLabelModal';
import { api } from '../api';

export const CatalogViewer = ({ 
  catalogos = {}, 
  onOpenCreateItem, 
  onOpenEditItem, 
  onReloadCatalog 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  
  // Stock mínimo
  const [editingStockId, setEditingStockId] = useState(null);
  const [tempStockMinimo, setTempStockMinimo] = useState('');

  // Stock actual directo
  const [editingStockActualId, setEditingStockActualId] = useState(null);
  const [tempStockActual, setTempStockActual] = useState('');

  // Modal QR Label
  const [selectedItemForQR, setSelectedItemForQR] = useState(null);

  // Modal Mantenimiento
  const [maintenanceItem, setMaintenanceItem] = useState(null);
  const [maintenanceTipo, setMaintenanceTipo] = useState('Preventivo');
  const [maintenanceObs, setMaintenanceObs] = useState('');
  const [isSubmittingMaint, setIsSubmittingMaint] = useState(false);

  const inventario = catalogos.inventario || [];
  const categorias = catalogos.categorias || [];

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Movilidad': return <Truck size={17} color="var(--primary-red)" />;
      case 'Informatica': return <Laptop size={17} color="var(--accent-cyan)" />;
      case 'Instrumental': return <Wrench size={17} color="var(--accent-amber)" />;
      case 'Repuestos': return <Package size={17} color="var(--accent-cyan)" />;
      case 'Indumentaria': return <Shirt size={17} color="#8b5cf6" />;
      case 'Materiales': return <Layers size={17} color="#10b981" />;
      case 'Herramientas': return <Wrench size={17} color="#f59e0b" />;
      default: return <Box size={17} color="var(--corporate-gray)" />;
    }
  };

  const filteredItems = useMemo(() => {
    return inventario.filter(item => {
      const matchCat = selectedCategory === 'TODOS' || item.categoria === selectedCategory;
      const term = searchTerm.toLowerCase();
      const matchSearch = (
        (item.nombre || '').toLowerCase().includes(term) ||
        (item.codigo_interno || '').toLowerCase().includes(term) ||
        (item.numero_serie || '').toLowerCase().includes(term) ||
        (item.subcategoria || '').toLowerCase().includes(term)
      );
      return matchCat && matchSearch;
    });
  }, [inventario, selectedCategory, searchTerm]);

  const handleEliminar = async (item) => {
    if (!window.confirm(`¿Estás seguro de que deseas dar de baja "${item.nombre}" del catálogo?`)) {
      return;
    }
    try {
      await api.eliminarElemento(item.categoria, item.id);
      if (onReloadCatalog) onReloadCatalog();
    } catch (err) {
      alert('Error dando de baja elemento: ' + err.message);
    }
  };

  const handleSaveStockMinimo = async (item) => {
    try {
      await api.setStockMinimo(item.id, parseFloat(tempStockMinimo) || 0);
      setEditingStockId(null);
      if (onReloadCatalog) onReloadCatalog();
    } catch (err) {
      alert('Error guardando stock mínimo: ' + err.message);
    }
  };

  const handleSaveStockActual = async (item) => {
    try {
      const nuevo = parseFloat(tempStockActual) || 0;
      await api.actualizarStock(item.categoria, item.id, nuevo, 'Ajuste manual desde catálogo');
      setEditingStockActualId(null);
      if (onReloadCatalog) onReloadCatalog();
    } catch (err) {
      alert('Error actualizando stock actual: ' + err.message);
    }
  };

  const handleMarcarMantenimiento = async (e) => {
    e.preventDefault();
    if (!maintenanceItem) return;
    setIsSubmittingMaint(true);
    try {
      await api.marcarMantenimiento({
        categoria: maintenanceItem.categoria,
        id: maintenanceItem.id,
        tipo_mantenimiento: maintenanceTipo,
        observaciones: maintenanceObs
      });
      setMaintenanceItem(null);
      if (onReloadCatalog) onReloadCatalog();
    } catch (err) {
      alert('Error al registrar mantenimiento: ' + err.message);
    } finally {
      setIsSubmittingMaint(false);
    }
  };

  const handleFinalizarMantenimiento = async (item) => {
    if (!window.confirm(`¿Confirmar que "${item.nombre}" volvió a inventario y finalizó su mantenimiento?`)) return;
    try {
      await api.finalizarMantenimiento({
        categoria: item.categoria,
        id: item.id
      });
      if (onReloadCatalog) onReloadCatalog();
    } catch (err) {
      alert('Error finalizando mantenimiento: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', margin: 0 }}>
            Catálogo Consolidado de Inventario
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Explora, agrega o modifica activos, vehículos, instrumental, licencias y repuestos
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.2rem' }}
              placeholder="Buscar por código, serie o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={onOpenCreateItem} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} /> Nuevo Elemento (UUID)
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        overflowX: 'auto',
        paddingBottom: '0.35rem',
        scrollbarWidth: 'none'
      }}>
        <button
          onClick={() => setSelectedCategory('TODOS')}
          className={`btn btn-sm ${selectedCategory === 'TODOS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Todos ({inventario.length})
        </button>
        {categorias.map(cat => {
          const count = inventario.filter(i => i.categoria === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ whiteSpace: 'nowrap' }}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid of Items */}
      {filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <Box size={40} color="var(--corporate-gray)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.7 }} />
          <div style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            No se encontraron elementos
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Prueba ajustando los términos de búsqueda o seleccionando otra categoría.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}>
          {filteredItems.map(item => {
            const hasDriveLink = Boolean(item.url_carpeta && item.url_carpeta.startsWith('http'));
            const docsList = item.documentos || [];
            const isRepuesto = item.categoria === 'Repuestos';
            const isLicencia = item.subcategoria === 'Licencias y Suscripciones' || (item.nombre || '').toLowerCase().includes('licencia');

            return (
              <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  {/* Category & Badges */}
                  {/* Category & Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getCategoryIcon(item.categoria)}
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {item.categoria}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      {item.codigo_interno && (
                        <span style={{
                          background: 'rgba(204, 51, 51, 0.15)',
                          color: 'var(--primary-red)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}>
                          [{item.codigo_interno}]
                        </span>
                      )}
                      {isLicencia && (
                        <span style={{
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: 'var(--accent-cyan)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: 700
                        }}>
                          LICENCIA
                        </span>
                      )}
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                        ACTIVO
                      </span>
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div>
                    <h4 style={{ fontSize: '0.98rem', color: 'var(--text-main)', margin: '0 0 0.35rem 0', fontWeight: 700 }}>
                      {item.nombre}
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {item.numero_serie && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Hash size={13} /> Serie / Patente: <strong style={{ color: 'var(--text-main)' }}>{item.numero_serie}</strong>
                        </div>
                      )}
                      {item.modo_costeo && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>
                          Modo de costeo: <strong style={{ textTransform: 'capitalize' }}>{item.modo_costeo}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bloque de Mantenimiento / Calibración */}
                  {item.en_mantenimiento ? (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.5rem 0.65rem', 
                      borderRadius: '6px', 
                      background: 'rgba(245, 158, 11, 0.12)', 
                      border: '1px solid rgba(245, 158, 11, 0.35)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      flexWrap: 'wrap',
                      gap: '0.4rem' 
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <AlertTriangle size={13} /> EN MANTENIMIENTO ({item.tipo_mantenimiento || 'Revisión'})
                        </span>
                        {item.fecha_inicio_mantenimiento && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            Desde: {item.fecha_inicio_mantenimiento}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFinalizarMantenimiento(item)}
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                        title="Registrar fecha y hora de fin y devolver a Disponible"
                      >
                        Volvió a inventario
                      </button>
                    </div>
                  ) : (
                    (item.categoria === 'Instrumental' || item.categoria === 'Movilidad' || item.categoria === 'Herramientas') && (
                      <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setMaintenanceItem(item);
                            setMaintenanceTipo('Preventivo');
                            setMaintenanceObs('');
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Registrar que el equipo entra a mantenimiento o calibración"
                        >
                          <Wrench size={11} /> Registrar Mantenimiento
                        </button>
                      </div>
                    )
                  )}

                  {/* Repuestos: Compatibilidad */}
                  {isRepuesto && item.elementos_compatibles_ids && item.elementos_compatibles_ids.length > 0 && (
                    <div style={{ marginTop: '0.5rem', padding: '0.4rem', background: 'var(--bg-card-hover)', borderRadius: '6px', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>🔧 Compatibilidad: </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {item.elementos_compatibles_ids.length} equipos compatibles
                      </span>
                    </div>
                  )}

                  {/* Documentación & Drive */}
                  {(hasDriveLink || docsList.length > 0) && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {hasDriveLink && (
                        <a 
                          href={item.url_carpeta} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: 'var(--accent-cyan)',
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                            fontWeight: 600
                          }}
                        >
                          <ExternalLink size={12} /> Carpeta en Google Drive
                        </a>
                      )}
                      {docsList.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--corporate-gray)' }}>
                          📄 {docsList.length} documento(s) / trámites asociados
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock Actual Directo (Materiales, Indumentaria, Herramientas, Repuestos) */}
                  {(item.categoria === 'Materiales' || item.categoria === 'Indumentaria' || item.categoria === 'Herramientas' || item.categoria === 'Repuestos') && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.35rem 0.5rem', background: 'var(--bg-card-hover)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Stock Actual: <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{item.stock_actual ?? item.stock ?? 0}</strong>
                      </span>
                      {editingStockActualId === item.id ? (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            step="any"
                            style={{ width: '60px', padding: '0.15rem 0.3rem', fontSize: '0.75rem' }} 
                            className="form-input" 
                            value={tempStockActual} 
                            onChange={(e) => setTempStockActual(e.target.value)} 
                          />
                          <button 
                            onClick={() => handleSaveStockActual(item)} 
                            className="btn btn-sm btn-primary" 
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                          >
                            OK
                          </button>
                          <button 
                            onClick={() => setEditingStockActualId(null)} 
                            className="btn btn-sm btn-secondary" 
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setEditingStockActualId(item.id); setTempStockActual(item.stock_actual ?? item.stock ?? 0); }}
                          className="btn btn-sm btn-outline" 
                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                          title="Modificar stock físico disponible"
                        >
                          Ajustar Stock
                        </button>
                      )}
                    </div>
                  )}

                  {/* Stock Mínimo */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Stock Mínimo: <strong style={{ color: 'var(--text-main)' }}>{item.stock_minimo || 0}</strong>
                    </span>
                    {editingStockId === item.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          style={{ width: '55px', padding: '0.15rem 0.3rem', fontSize: '0.75rem' }} 
                          className="form-input" 
                          value={tempStockMinimo} 
                          onChange={(e) => setTempStockMinimo(e.target.value)} 
                        />
                        <button 
                          onClick={() => handleSaveStockMinimo(item)} 
                          className="btn btn-sm btn-primary" 
                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                        >
                          OK
                        </button>
                        <button 
                          onClick={() => setEditingStockId(null)} 
                          className="btn btn-sm btn-secondary" 
                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setEditingStockId(item.id); setTempStockMinimo(item.stock_minimo || 0); }}
                        className="btn btn-sm btn-outline" 
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        Ajustar Mínimo
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Actions: QR / Editar / Baja */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.4rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.65rem'
                }}>
                  <button
                    type="button"
                    onClick={() => setSelectedItemForQR(item)}
                    className="btn btn-sm btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                    title="Generar código QR e imprimir etiqueta PDF"
                  >
                    <QrCode size={13} /> Etiqueta QR
                  </button>
                  <button 
                    type="button"
                    onClick={() => onOpenEditItem(item)} 
                    className="btn btn-sm btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                  >
                    <Edit3 size={13} /> Editar
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleEliminar(item)} 
                    className="btn btn-sm btn-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                    title="Dar de baja este elemento del inventario"
                  >
                    <Trash2 size={13} /> Baja
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Marcar en Mantenimiento */}
      {maintenanceItem && (
        <div className="modal-overlay" onClick={() => setMaintenanceItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Wrench size={18} color="var(--accent-amber)" /> Enviar a Mantenimiento / Calibración
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {maintenanceItem.nombre} {maintenanceItem.codigo_interno && `[${maintenanceItem.codigo_interno}]`}
                </p>
              </div>
              <button onClick={() => setMaintenanceItem(null)} className="btn btn-sm btn-outline">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleMarcarMantenimiento} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tipo de Mantenimiento *</label>
                <select 
                  className="form-select"
                  value={maintenanceTipo}
                  onChange={(e) => setMaintenanceTipo(e.target.value)}
                  required
                >
                  <option value="Preventivo">Mantenimiento Preventivo</option>
                  <option value="Correctivo">Mantenimiento Correctivo / Reparación</option>
                  <option value="Calibración">Calibración y Certificación Oficial</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Observaciones / Taller / Proveedor</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Ej: Taller Topcon oficial, cambio de conector y calibración de prismas..."
                  value={maintenanceObs}
                  onChange={(e) => setMaintenanceObs(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setMaintenanceItem(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingMaint} className="btn btn-primary">
                  {isSubmittingMaint ? 'Registrando...' : 'Confirmar Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Etiqueta QR y PDF */}
      {selectedItemForQR && (
        <QRLabelModal
          isOpen={Boolean(selectedItemForQR)}
          onClose={() => setSelectedItemForQR(null)}
          item={selectedItemForQR}
        />
      )}
    </div>
  );
};
