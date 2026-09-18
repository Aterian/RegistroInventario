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
  Key 
} from 'lucide-react';
import { api } from '../api';

export const CatalogViewer = ({ 
  catalogos = {}, 
  onOpenCreateItem, 
  onOpenEditItem, 
  onReloadCatalog 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [editingStockId, setEditingStockId] = useState(null);
  const [tempStockMinimo, setTempStockMinimo] = useState('');

  const inventario = catalogos.inventario || [];
  const categorias = catalogos.categorias || [];

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Movilidad': return <Truck size={17} color="var(--primary-red)" />;
      case 'Informatica': return <Laptop size={17} color="var(--accent-cyan)" />;
      case 'Instrumental': return <Wrench size={17} color="var(--accent-amber)" />;
      case 'Repuestos': return <Package size={17} color="var(--accent-cyan)" />;
      case 'Indumentaria': return <Shirt size={17} color="#8b5cf6" />;
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getCategoryIcon(item.categoria)}
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {item.categoria}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem' }}>
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
                      {item.codigo_interno && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Tag size={13} /> Código: <strong style={{ color: 'var(--text-main)' }}>{item.codigo_interno}</strong>
                        </div>
                      )}
                      {item.numero_serie && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Hash size={13} /> Serie / Patente: <strong style={{ color: 'var(--text-main)' }}>{item.numero_serie}</strong>
                        </div>
                      )}
                    </div>
                  </div>

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

                  {/* Stock Mínimo y Actual */}
                  <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
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

                {/* Card Actions: Editar / Baja */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.4rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.65rem'
                }}>
                  <button 
                    onClick={() => onOpenEditItem(item)} 
                    className="btn btn-sm btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                  >
                    <Edit3 size={13} /> Editar
                  </button>
                  <button 
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
    </div>
  );
};
