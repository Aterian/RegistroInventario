import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Search, 
  Tag, 
  Hash, 
  Image as ImageIcon, 
  Box, 
  Wrench, 
  Truck, 
  Laptop, 
  Shirt, 
  Shield 
} from 'lucide-react';

export const CatalogViewer = ({ catalogos = {}, onSelectItemForSalida }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');

  const inventario = catalogos.inventario || [];
  const categorias = catalogos.categorias || [];

  // Mapeo de iconos por categoría
  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Movilidad': return <Truck size={18} color="var(--primary-red)" />;
      case 'Informatica': return <Laptop size={18} color="var(--accent-cyan)" />;
      case 'Instrumental': return <Wrench size={18} color="var(--accent-amber)" />;
      case 'Indumentaria': return <Shirt size={18} color="#8b5cf6" />;
      default: return <Box size={18} color="var(--corporate-gray)" />;
    }
  };

  const filteredItems = useMemo(() => {
    return inventario.filter(item => {
      const matchCat = selectedCategory === 'TODOS' || item.categoria === selectedCategory;
      const term = searchTerm.toLowerCase();
      const matchSearch = (
        (item.nombre || '').toLowerCase().includes(term) ||
        (item.codigo_interno || '').toLowerCase().includes(term) ||
        (item.numero_serie || '').toLowerCase().includes(term)
      );
      return matchCat && matchSearch;
    });
  }, [inventario, selectedCategory, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>
            Catálogo Consolidado de Inventario
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Explora las 8 categorías del libro "Inventario v1.5" (activos operativos)
          </p>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
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
            Prueba ajustando los términos de búsqueda o cambiando de categoría.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {filteredItems.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Category & Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {getCategoryIcon(item.categoria)}
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {item.categoria}
                  </span>
                </div>

                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                  OPERATIVO
                </span>
              </div>

              {/* Title & Info */}
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
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
                      <Hash size={13} /> S/N / Patente: <strong style={{ color: 'var(--text-main)' }}>{item.numero_serie}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Image preview if URL exists */}
              {item.imagen && item.imagen.startsWith('http') && (
                <div style={{
                  height: '110px',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  background: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <img
                    src={item.imagen}
                    alt={item.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
