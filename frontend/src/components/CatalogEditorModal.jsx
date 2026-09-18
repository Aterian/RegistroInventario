import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Layers, Wrench, Shield, Laptop, Truck } from 'lucide-react';
import { api } from '../api';

export const CatalogEditorModal = ({ 
  isOpen, 
  onClose, 
  itemToEdit = null, 
  categorias = [], 
  inventarioCompleto = [], 
  onSuccess 
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(itemToEdit);

  const [categoria, setCategoria] = useState(itemToEdit?.categoria || 'Materiales');
  const [nombre, setNombre] = useState(itemToEdit?.nombre || '');
  const [codigoInterno, setCodigoInterno] = useState(itemToEdit?.codigo_interno || '');
  const [marca, setMarca] = useState(itemToEdit?.marca || '');
  const [modelo, setModelo] = useState(itemToEdit?.modelo || '');
  const [numeroSerie, setNumeroSerie] = useState(itemToEdit?.numero_serie || '');
  const [tipo, setTipo] = useState(itemToEdit?.tipo || '');
  const [subcategoria, setSubcategoria] = useState(itemToEdit?.subcategoria || '');
  const [patente, setPatente] = useState(itemToEdit?.patente || '');
  const [stockMinimo, setStockMinimo] = useState(itemToEdit?.stock_minimo || 0);
  const [stockActual, setStockActual] = useState(itemToEdit?.stock_actual || 0);
  const [urlCarpeta, setUrlCarpeta] = useState(itemToEdit?.url_carpeta || '');
  const [observaciones, setObservaciones] = useState(itemToEdit?.observaciones || '');

  // Repuestos: elementos compatibles seleccionados
  const [compatiblesIds, setCompatiblesIds] = useState(
    Array.isArray(itemToEdit?.elementos_compatibles_ids) ? itemToEdit.elementos_compatibles_ids : []
  );
  const [compatibleSearch, setCompatibleSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Ítems elegibles para repuestos (excluyendo repuestos)
  const itemsElegibles = inventarioCompleto.filter(i => 
    i.categoria !== 'Repuestos' && 
    (compatibleSearch === '' || 
     (i.nombre || '').toLowerCase().includes(compatibleSearch.toLowerCase()) || 
     (i.codigo_interno || '').toLowerCase().includes(compatibleSearch.toLowerCase()))
  );

  const handleToggleCompatible = (id) => {
    if (compatiblesIds.includes(id)) {
      setCompatiblesIds(compatiblesIds.filter(x => x !== id));
    } else {
      setCompatiblesIds([...compatiblesIds, id]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre o descripción del elemento es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        categoria,
        nombre: nombre.trim(),
        codigo_interno: codigoInterno.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        numero_serie: numeroSerie.trim(),
        tipo: tipo.trim() || subcategoria.trim(),
        subcategoria: subcategoria.trim(),
        patente: patente.trim(),
        stock_minimo: parseFloat(stockMinimo) || 0,
        stock_actual: parseFloat(stockActual) || 0,
        elementos_compatibles_ids: compatiblesIds,
        url_carpeta: urlCarpeta.trim(),
        observaciones: observaciones.trim(),
      };

      if (isEditing) {
        await api.editarElemento(itemToEdit.categoria, itemToEdit.id, payload);
      } else {
        await api.crearElemento(payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Error guardando en el catálogo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto', padding: '2rem 2.25rem' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
              {isEditing ? 'Editar Elemento del Catálogo' : 'Agregar Nuevo Elemento al Catálogo'}
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isEditing ? `Modificando ID: ${itemToEdit.id}` : 'Se asignará un identificador único UUIDv4'}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="card" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)', padding: '0.75rem', marginBottom: '1rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Categoría y Subcategoría */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Categoría *</label>
              <select 
                className="form-select" 
                value={categoria} 
                onChange={(e) => setCategoria(e.target.value)}
                disabled={isEditing}
              >
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {categoria === 'Informatica' ? (
              <div className="form-group">
                <label className="form-label">Subcategoría Informática</label>
                <select 
                  className="form-select" 
                  value={subcategoria} 
                  onChange={(e) => {
                    setSubcategoria(e.target.value);
                    if (e.target.value === 'Licencias y Suscripciones') setTipo('Licencias y Suscripciones');
                  }}
                >
                  <option value="">Hardware / Estándar</option>
                  <option value="Licencias y Suscripciones">Licencias y Suscripciones</option>
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Código Interno</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: MOV-04, INS-21..." 
                  value={codigoInterno} 
                  onChange={(e) => setCodigoInterno(e.target.value)} 
                />
              </div>
            )}
          </div>

          {/* Nombre / Denominación */}
          <div className="form-group">
            <label className="form-label">Nombre / Denominación del Elemento *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej: Estación Total Leica TS06, Ford Ranger 4x4, Base nivelante..." 
              value={nombre} 
              onChange={(e) => setNombre(e.target.value)} 
              required 
            />
          </div>

          {/* Marca y Modelo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Marca</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej: Topcon, Leica, Ford, Dji..." 
                value={marca} 
                onChange={(e) => setMarca(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Modelo</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej: Hiper VR, Ranger XLT, Mavic 2..." 
                value={modelo} 
                onChange={(e) => setModelo(e.target.value)} 
              />
            </div>
          </div>

          {/* Número de Serie o Patente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">
                {categoria === 'Movilidad' ? 'Patente' : 'Número de Serie'}
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder={categoria === 'Movilidad' ? 'Ej: AF 123 CD' : 'N° de serie de fábrica'} 
                value={categoria === 'Movilidad' ? patente : numeroSerie} 
                onChange={(e) => categoria === 'Movilidad' ? setPatente(e.target.value) : setNumeroSerie(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Mínimo Deseado</label>
              <input 
                type="number" 
                step="any"
                min="0"
                className="form-input" 
                placeholder="Ej: 5 (Alerta si stock <= mínimo)" 
                value={stockMinimo} 
                onChange={(e) => setStockMinimo(e.target.value)} 
              />
            </div>
          </div>

          {/* Si es categoría REPUESTOS: Selector múltiple de elementos compatibles */}
          {categoria === 'Repuestos' && (
            <div style={{
              background: 'var(--bg-card-hover)',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  🔧 Elementos Compatibles del Inventario ({compatiblesIds.length} seleccionados)
                </label>
                <input 
                  type="text"
                  placeholder="Buscar instrumental o equipo..."
                  className="form-input"
                  style={{ width: '220px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  value={compatibleSearch}
                  onChange={(e) => setCompatibleSearch(e.target.value)}
                />
              </div>
              <div style={{
                maxHeight: '140px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '0.4rem',
                background: 'var(--bg-main)'
              }}>
                {itemsElegibles.slice(0, 40).map(item => {
                  const isChecked = compatiblesIds.includes(item.id);
                  return (
                    <label 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        fontSize: '0.8rem', 
                        cursor: 'pointer',
                        padding: '0.2rem',
                        borderRadius: '4px',
                        background: isChecked ? 'rgba(6, 182, 212, 0.12)' : 'transparent'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handleToggleCompatible(item.id)} 
                      />
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        [{item.categoria}]
                      </span>
                      <span>{item.nombre}</span>
                      {item.codigo_interno && (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                          ({item.codigo_interno})
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enlace a Google Drive / Documentos */}
          <div className="form-group">
            <label className="form-label">Enlace a Carpeta o Archivo de Google Drive (Opcional)</label>
            <input 
              type="url" 
              className="form-input" 
              placeholder="https://drive.google.com/drive/folders/..." 
              value={urlCarpeta} 
              onChange={(e) => setUrlCarpeta(e.target.value)} 
            />
          </div>

          {/* Observaciones */}
          <div className="form-group">
            <label className="form-label">Observaciones / Detalles Técnicos</label>
            <textarea 
              className="form-input" 
              rows={2} 
              placeholder="Detalles sobre estado, accesorios incluidos, calibraciones, etc." 
              value={observaciones} 
              onChange={(e) => setObservaciones(e.target.value)} 
            />
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Save size={16} />
              {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Elemento')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
