import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Search, 
  QrCode, 
  Package, 
  AlertCircle, 
  Save, 
  CheckCircle2, 
  Truck, 
  User, 
  Building2,
  Edit3
} from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';
import { api } from '../api';

export const EditarSalidaModal = ({ isOpen, onClose, viaje, catalogos, onSaved }) => {
  if (!isOpen || !viaje) return null;

  const inventario = catalogos?.inventario || [];
  const categorias = catalogos?.categorias || [];
  const usuarios = catalogos?.usuarios || [];

  // Extraer items únicos del viaje (agrupados por elemento/código)
  const [itemsList, setItemsList] = useState([]);
  const [userResponsable, setUserResponsable] = useState(viaje.user_s || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados para agregar nuevo elemento
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('TODOS');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Inicializar items al abrir el modal
  useEffect(() => {
    if (viaje && viaje.items) {
      setUserResponsable(viaje.user_s || '');
      setErrorMessage('');
      setIsAddingNew(false);

      // Desduplicar ítems en caso de viajes multiproyecto donde se repite la fila por proyecto
      const map = new Map();
      viaje.items.forEach(it => {
        const key = it.elemento || it.nombre;
        if (!map.has(key)) {
          map.set(key, {
            id: it.id || it.id_elemento || '',
            elemento: it.elemento || it.nombre || 'Elemento',
            nombre: it.nombre || it.elemento || 'Elemento',
            tipo: it.tipo || it.categoria || 'Materiales',
            categoria: it.categoria || it.tipo || 'Materiales',
            codigo_interno: it.codigo_interno || '',
            unidad_s: Number(it.unidad_s || 1),
            costo_u: Number(it.costo_u || 0),
            unidad_medida: it.unidad_medida || '',
            modo_costeo: it.modo_costeo || ''
          });
        }
      });
      setItemsList(Array.from(map.values()));
    }
  }, [viaje]);

  // Proyectos del viaje
  const proyectos = useMemo(() => {
    const raw = viaje.proyectos || [];
    return raw.map(p => typeof p === 'object' ? (p.denominacion || p.nombre || p.id_proyecto) : String(p));
  }, [viaje]);

  // Filtrado de inventario para agregar
  const filteredInventario = useMemo(() => {
    if (!isAddingNew) return [];
    return inventario.filter(item => {
      const matchCat = selectedCategoria === 'TODOS' || item.categoria === selectedCategoria;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || (
        (item.nombre || '').toLowerCase().includes(term) ||
        (item.codigo_interno || '').toLowerCase().includes(term) ||
        (item.numero_serie || '').toLowerCase().includes(term)
      );
      // Evitar ítems ya presentes en la salida
      const alreadyInList = itemsList.some(it => {
        let itName = it.elemento || it.nombre || '';
        return (it.id && it.id === item.id) || itName.includes(item.nombre);
      });
      return matchCat && matchSearch && !alreadyInList;
    }).slice(0, 15);
  }, [inventario, isAddingNew, selectedCategoria, searchTerm, itemsList]);

  // Manejar cambio de cantidad de un ítem existente
  const handleUpdateCantidad = (index, value) => {
    const num = Math.max(0.1, parseFloat(value) || 1);
    setItemsList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], unidad_s: num };
      return next;
    });
  };

  // Manejar eliminación de ítem
  const handleRemoveItem = (index) => {
    if (itemsList.length <= 1) {
      setErrorMessage('La salida debe conservar al menos 1 elemento. Si desea cancelar toda la salida, hágalo desde administración.');
      return;
    }
    setErrorMessage('');
    setItemsList(prev => prev.filter((_, idx) => idx !== index));
  };

  // Agregar nuevo ítem seleccionado del inventario
  const handleAddInventarioItem = (item) => {
    const defaultQty = (item.categoria || '').toLowerCase().includes('movilidad') ? 100 : 1;
    const newItem = {
      id: item.id,
      elemento: item.nombre,
      nombre: item.nombre,
      tipo: item.categoria,
      categoria: item.categoria,
      codigo_interno: item.codigo_interno || '',
      unidad_s: defaultQty,
      costo_u: Number(item.costo_unitario || item.costo_u || 0),
      unidad_medida: item.modo_costeo || '',
      modo_costeo: item.modo_costeo || ''
    };
    setItemsList(prev => [...prev, newItem]);
    setSearchTerm('');
    setIsAddingNew(false);
  };

  // Escaneo QR
  const handleScanSuccess = (codigo) => {
    setIsScannerOpen(false);
    const clean = codigo.trim().toLowerCase();
    const found = inventario.find(i => 
      (i.codigo_interno || '').toLowerCase() === clean ||
      (i.id || '').toLowerCase() === clean ||
      (i.numero_serie || '').toLowerCase() === clean
    );

    if (found) {
      handleAddInventarioItem(found);
      setScanMessage({ success: true, text: `✓ Se agregó: ${found.nombre}` });
    } else {
      setSearchTerm(codigo);
      setIsAddingNew(true);
      setScanMessage({ success: false, text: `No se encontró coincidencia exacta para "${codigo}". Puede buscarlo manualmente.` });
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Guardar cambios
  const handleSave = async () => {
    if (itemsList.length === 0) {
      setErrorMessage('Debe haber al menos un elemento en la salida.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        items: itemsList,
        user_s: userResponsable.trim() || viaje.user_s
      };

      const res = await api.editarSalida(viaje.id_viaje, payload);
      if (res && res.success !== false) {
        if (onSaved) onSaved();
        onClose();
      } else {
        setErrorMessage(res?.error || 'No se pudieron guardar los cambios.');
      }
    } catch (err) {
      console.error('Error guardando edición de salida:', err);
      setErrorMessage(err.message || 'Error de conexión al actualizar la salida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}
      >
        {/* Cabecera */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                background: 'rgba(234, 179, 8, 0.15)',
                color: 'var(--accent-amber)',
                padding: '0.4rem',
                borderRadius: '6px'
              }}>
                <Edit3 size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Modificar Elementos de Salida
              </h3>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Ajuste cantidades, elimine ítems cargados por error o agregue elementos olvidados antes del retorno.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: '0.35rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Resumen del Viaje */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          background: 'var(--bg-surface-elevated)',
          padding: '0.85rem 1rem',
          borderRadius: '0.65rem',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          fontSize: '0.825rem'
        }}>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>IDENTIFICADOR</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)' }}>
              #{viaje.id_viaje ? viaje.id_viaje.substring(0, 10) : ''}...
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>PROYECTOS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.15rem' }}>
              {proyectos.map((p, idx) => (
                <span key={idx} style={{
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: 'var(--accent-cyan)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>RESPONSABLE</div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <User size={13} color="var(--primary-red)" />
              {viaje.user_s || 'Sin asignar'}
            </div>
          </div>
        </div>

        {scanMessage && (
          <div style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            background: scanMessage.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
            color: scanMessage.success ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            fontSize: '0.825rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            {scanMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {scanMessage.text}
          </div>
        )}

        {errorMessage && (
          <div style={{
            padding: '0.75rem',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--accent-red)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Lista de Ítems en la Salida */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.6rem'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Elementos Registrados ({itemsList.length})
            </span>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="btn btn-sm btn-outline"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <QrCode size={14} color="var(--primary-red)" /> Escanear QR
              </button>

              <button
                type="button"
                onClick={() => setIsAddingNew(!isAddingNew)}
                className={`btn btn-sm ${isAddingNew ? 'btn-secondary' : 'btn-primary'}`}
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> {isAddingNew ? 'Ocultar Catálogo' : 'Agregar Elemento'}
              </button>
            </div>
          </div>

          {/* Panel para agregar nuevo elemento */}
          {isAddingNew && (
            <div style={{
              background: 'var(--bg-card-hover)',
              padding: '1rem',
              borderRadius: '0.65rem',
              border: '1px dashed var(--primary-red)',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-red)', marginBottom: '0.6rem' }}>
                BUSCAR Y AGREGAR ELEMENTO DESDE EL INVENTARIO
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <select
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  className="form-input"
                  style={{ width: 'auto', minWidth: '150px', fontSize: '0.825rem' }}
                >
                  <option value="TODOS">Todas las categorías</option>
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Escriba código interno, modelo o nombre..."
                    className="form-input"
                    style={{ paddingLeft: '2.1rem', fontSize: '0.825rem' }}
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {filteredInventario.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>
                    {searchTerm ? 'No se encontraron elementos disponibles con esa búsqueda.' : 'Escriba un término para filtrar el inventario disponible.'}
                  </div>
                ) : (
                  filteredInventario.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        fontSize: '0.825rem'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.codigo_interno ? `[${item.codigo_interno}] ` : ''}{item.nombre}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--corporate-gray)' }}>
                          {item.categoria} {item.numero_serie ? `| S/N: ${item.numero_serie}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddInventarioItem(item)}
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        <Plus size={13} /> Agregar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tabla de Elementos Actuales */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Elemento</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Categoría</th>
                  <th style={{ padding: '0.65rem 0.85rem', width: '140px' }}>Cantidad / Salida</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '70px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {itemsList.map((it, idx) => {
                  const isMov = (it.tipo || it.categoria || '').toLowerCase().includes('movilidad');
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {it.elemento || it.nombre}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--corporate-gray)', fontSize: '0.8rem' }}>
                        {it.tipo || it.categoria}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="number"
                            min="0.1"
                            step={isMov ? "1" : "1"}
                            value={it.unidad_s}
                            onChange={(e) => handleUpdateCantidad(idx, e.target.value)}
                            className="form-input"
                            style={{ width: '75px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {isMov ? 'km' : 'unid'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="btn btn-sm btn-outline"
                          style={{ padding: '0.3rem 0.45rem', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          title="Eliminar de la salida"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Escaneo QR integrado */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
          title="Escanear Ítem para Salida"
        />

        {/* Botones de Acción */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1rem'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || itemsList.length === 0}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '160px', justifyContent: 'center' }}
          >
            {isSubmitting ? (
              <span>Guardando...</span>
            ) : (
              <>
                <Save size={16} /> Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
