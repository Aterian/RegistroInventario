import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  User, 
  Layers, 
  Check, 
  Search, 
  Edit3, 
  AlertCircle, 
  CheckCircle2, 
  Truck, 
  X, 
  Car 
} from 'lucide-react';
import { SignaturePadModal } from './SignaturePadModal';
import { api } from '../api';

export const SalidaForm = ({ 
  catalogos, 
  onSuccess, 
  onCancel 
}) => {
  const [selectedProyectos, setSelectedProyectos] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [customUser, setCustomUser] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Catálogo y búsqueda de ítems
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('TODOS');

  // Firma
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState('');

  // Estados de envío
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const proyectos = catalogos?.proyectos || [];
  const usuarios = catalogos?.usuarios || [];
  const inventario = catalogos?.inventario || [];
  const categorias = catalogos?.categorias || [];

  // Filtrado de ítems de inventario disponibles
  const filteredInventario = useMemo(() => {
    return inventario.filter(item => {
      const matchCat = selectedCategoryFilter === 'TODOS' || item.categoria === selectedCategoryFilter;
      const term = itemSearch.toLowerCase();
      const matchSearch = (
        (item.nombre || '').toLowerCase().includes(term) ||
        (item.codigo_interno || '').toLowerCase().includes(term) ||
        (item.numero_serie || '').toLowerCase().includes(term)
      );
      // No mostrar si ya está agregado a la lista
      const alreadyAdded = selectedItems.some(si => si.id === item.id);
      return matchCat && matchSearch && !alreadyAdded;
    });
  }, [inventario, selectedCategoryFilter, itemSearch, selectedItems]);

  // Manejar selección de proyectos
  const handleToggleProyecto = (projId) => {
    if (selectedProyectos.includes(projId)) {
      setSelectedProyectos(selectedProyectos.filter(id => id !== projId));
    } else {
      setSelectedProyectos([...selectedProyectos, projId]);
    }
  };

  // Agregar ítem a la lista de salida
  const handleAddItem = (item) => {
    setSelectedItems(prev => [
      ...prev,
      {
        ...item,
        unidad_s: item.categoria === 'Movilidad' ? 0.0 : 1.0,
        costo_u: item.categoria === 'Movilidad' ? 0.45 : 10.0,
      }
    ]);
  };

  // Actualizar valores de un ítem agregado
  const handleItemChange = (index, field, value) => {
    setSelectedItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
      return updated;
    });
  };

  // Remover ítem de la lista
  const handleRemoveItem = (index) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Validación y Envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (selectedProyectos.length === 0) {
      setErrorMessage('Debe seleccionar al menos un proyecto.');
      return;
    }

    const finalUser = selectedUser === 'OTRO' ? customUser.trim() : selectedUser;
    if (!finalUser) {
      setErrorMessage('Debe especificar el empleado responsable del retiro.');
      return;
    }

    if (selectedItems.length === 0) {
      setErrorMessage('Debe agregar al menos un elemento del inventario para la salida.');
      return;
    }

    if (!firmaBase64) {
      setErrorMessage('La firma digital del responsable es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        proyectos_ids: selectedProyectos,
        items: selectedItems.map(it => ({
          id: String(it.id),
          categoria: it.categoria,
          codigo_interno: it.codigo_interno || '',
          nombre: it.nombre,
          numero_serie: it.numero_serie || '',
          unidad_s: Number(it.unidad_s) || 0.0,
          costo_u: Number(it.costo_u) || 0.0
        })),
        user_s: finalUser,
        firma_s_base64: firmaBase64
      };

      await api.registrarSalida(payload);
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMessage(err.message || 'Error registrando la salida');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>Registro de Salida Multiproyecto</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Asignación de herramientas, instrumental y movilidad a uno o varios proyectos
            </p>
          </div>
          <button type="button" onClick={onCancel} className="btn btn-sm btn-outline">
            Cancelar
          </button>
        </div>

        {errorMessage && (
          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(204, 51, 51, 0.12)',
            border: '1px solid rgba(204, 51, 51, 0.3)',
            color: 'var(--primary-red)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* SECCIÓN 1: PROYECTOS */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <Layers size={16} color="var(--primary-red)" /> 1. Seleccione los Proyectos Asignados ({selectedProyectos.length} seleccionados)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.5rem',
              maxHeight: '160px',
              overflowY: 'auto',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}>
              {proyectos.map(p => {
                const isSelected = selectedProyectos.includes(String(p.id_proyecto));
                return (
                  <div
                    key={p.id_proyecto}
                    onClick={() => handleToggleProyecto(String(p.id_proyecto))}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: isSelected ? 'rgba(204, 51, 51, 0.15)' : 'transparent',
                      border: isSelected ? '1px solid var(--primary-red)' : '1px solid var(--border-subtle)',
                      color: isSelected ? 'var(--primary-red)' : 'var(--text-main)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '3px',
                      border: isSelected ? 'none' : '1px solid var(--border-strong)',
                      backgroundColor: isSelected ? 'var(--primary-red)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}>
                      {isSelected && <Check size={12} />}
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.denominacion}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: RESPONSABLE */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <User size={16} color="var(--primary-red)" /> 2. Empleado que Retira el Inventario
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: selectedUser === 'OTRO' ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
              <select
                className="form-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                required
              >
                <option value="">-- Seleccione empleado responsable --</option>
                {usuarios.map(u => (
                  <option key={u.id_usuario} value={u.nombre}>
                    {u.nombre} ({u.area || 'Ingeap'}) {u.dni ? `- DNI ${u.dni}` : ''}
                  </option>
                ))}
                <option value="OTRO">-- Otro / No figura en lista --</option>
              </select>

              {selectedUser === 'OTRO' && (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ingrese Nombre y Apellido del responsable..."
                  value={customUser}
                  onChange={(e) => setCustomUser(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* SECCIÓN 3: SELECCIÓN DE ELEMENTOS DE INVENTARIO */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <Truck size={16} color="var(--primary-red)" /> 3. Elementos a Desplazar ({selectedItems.length} seleccionados)
            </label>

            {/* Buscador y filtro de categorías */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2rem', paddingRight: '0.5rem' }}
                  placeholder="Buscar en catálogo por nombre, marca, serie..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '160px' }}
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="TODOS">Todas las Categorías</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Lista de sugerencias del catálogo */}
            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.5rem',
              background: 'var(--bg-surface-elevated)',
              marginBottom: '1rem'
            }}>
              {filteredInventario.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No se encontraron elementos disponibles en el catálogo.
                </div>
              ) : (
                filteredInventario.slice(0, 30).map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '3px',
                        background: 'rgba(204,51,51,0.1)',
                        color: 'var(--primary-red)',
                        marginRight: '0.5rem'
                      }}>
                        {item.categoria}
                      </span>
                      <strong style={{ color: 'var(--text-main)' }}>{item.nombre}</strong>
                      {item.codigo_interno && (
                        <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem', fontFamily: 'monospace' }}>
                          [{item.codigo_interno}]
                        </span>
                      )}
                      {item.numero_serie && (
                        <span style={{ color: 'var(--corporate-gray)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                          S/N: {item.numero_serie}
                        </span>
                      )}
                    </div>
                    <button type="button" className="btn btn-sm btn-outline" style={{ padding: '0.2rem 0.5rem' }}>
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Tabla de ítems seleccionados con sus lecturas iniciales */}
            {selectedItems.length > 0 && (
              <div style={{
                borderRadius: '0.5rem',
                border: '1px solid var(--border-strong)',
                overflow: 'hidden',
                background: 'var(--bg-surface)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-strong)', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Elemento</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '130px' }}>Unidad Salida</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '130px' }}>Costo Unitario</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '60px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)' }}>{item.categoria}</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.nombre}</div>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="form-input"
                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                            value={item.unidad_s}
                            onChange={(e) => handleItemChange(idx, 'unidad_s', e.target.value)}
                            title={item.categoria === 'Movilidad' ? 'Odómetro inicial (km)' : 'Cantidad inicial'}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="form-input"
                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                            value={item.costo_u}
                            onChange={(e) => handleItemChange(idx, 'costo_u', e.target.value)}
                            title="Costo por unidad de uso (USD o pesos)"
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="btn btn-sm btn-danger"
                            style={{ padding: '0.35rem' }}
                            title="Eliminar ítem"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECCIÓN 4: FIRMA DIGITAL */}
          <div style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <Edit3 size={16} color="var(--primary-red)" /> 4. Firma Digital de Salida
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {firmaBase64 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--accent-emerald)',
                  background: 'rgba(16, 185, 129, 0.08)'
                }}>
                  <img
                    src={firmaBase64}
                    alt="Firma Capturada"
                    style={{ height: '44px', width: 'auto', borderRadius: '4px', background: '#fff' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={14} /> Firma Capturada
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSigModalOpen(true)}
                      className="btn btn-sm btn-outline"
                      style={{ marginTop: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Volver a Firmar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSigModalOpen(true)}
                  className="btn btn-secondary"
                >
                  <Edit3 size={15} /> Abrir Panel de Firma Digital
                </button>
              )}
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <button type="button" onClick={onCancel} className="btn btn-outline" disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando y Subiendo...' : 'Confirmar Salida de Inventario'}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL DE FIRMA */}
      <SignaturePadModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onSave={(b64) => setFirmaBase64(b64)}
        title="Firma de Salida - Responsable"
      />
    </div>
  );
};
