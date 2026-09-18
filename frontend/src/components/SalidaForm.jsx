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
  Car,
  Building2,
  Info
} from 'lucide-react';
import { SignaturePadModal } from './SignaturePadModal';
import { api } from '../api';

export const SalidaForm = ({ 
  catalogos, 
  onSuccess, 
  onCancel 
}) => {
  const [selectedProyectos, setSelectedProyectos] = useState([]);
  const [proyectoSearch, setProyectoSearch] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

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

  // Filtrado de proyectos en la barra de búsqueda
  const filteredProyectos = useMemo(() => {
    const term = proyectoSearch.toLowerCase().trim();
    if (!term) return proyectos.slice(0, 10);
    return proyectos.filter(p => 
      (p.denominacion || '').toLowerCase().includes(term) ||
      (p.id_proyecto || '').toLowerCase().includes(term) ||
      (p.area || '').toLowerCase().includes(term)
    );
  }, [proyectos, proyectoSearch]);

  // Manejar selección de proyectos
  const handleAddProyecto = (projId) => {
    if (!selectedProyectos.includes(projId)) {
      setSelectedProyectos([...selectedProyectos, projId]);
    }
    setProyectoSearch('');
    setIsProjectDropdownOpen(false);
  };

  const handleRemoveProyecto = (projId) => {
    setSelectedProyectos(selectedProyectos.filter(id => id !== projId));
  };

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
      const alreadyAdded = selectedItems.some(si => si.id === item.id);
      return matchCat && matchSearch && !alreadyAdded;
    });
  }, [inventario, selectedCategoryFilter, itemSearch, selectedItems]);

  // Agregar ítem aplicando las reglas de salida
  const handleAddItem = (item) => {
    const cat = (item.categoria || '').toLowerCase();
    const isMov = cat.includes('movilidad');
    const isDron = Boolean(item.es_dron || (item.nombre || '').toLowerCase().includes('dron'));
    const isIns = cat.includes('instrumental') && !isDron;

    let initUnidad = 1.0;
    if (isMov) initUnidad = 0.0;
    if (isIns) initUnidad = 0.0; // Instrumental (excepto drones) valor salida = 0

    setSelectedItems(prev => [
      ...prev,
      {
        ...item,
        isMov,
        isIns,
        isDron,
        unidad_s: initUnidad,
        costo_u: isMov ? 0.45 : (isIns ? 25.0 : 10.0),
      }
    ]);
  };

  const handleItemChange = (index, field, value) => {
    setSelectedItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Validación y Envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (selectedProyectos.length === 0) {
      setErrorMessage('Debe seleccionar al menos un proyecto asignado.');
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
              Asignación de vehículos, instrumental y materiales a uno o varios proyectos de Ingeap
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
          {/* SECCIÓN 1: BUSCADOR RÁPIDO DE PROYECTOS */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Building2 size={16} color="var(--primary-red)" />
                1. Proyectos Asignados ({selectedProyectos.length} seleccionados) *
              </span>
              {selectedProyectos.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => setSelectedProyectos([])} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Limpiar selección
                </button>
              )}
            </label>

            {/* Chips de proyectos seleccionados */}
            {selectedProyectos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
                {selectedProyectos.map(pId => {
                  const pObj = proyectos.find(p => String(p.id_proyecto) === String(pId));
                  return (
                    <span 
                      key={pId} 
                      style={{
                        background: 'rgba(204, 51, 51, 0.12)',
                        border: '1px solid rgba(204, 51, 51, 0.3)',
                        color: 'var(--primary-red)',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '20px',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      {pObj ? pObj.denominacion : `Proyecto #${pId}`}
                      <button
                        type="button"
                        onClick={() => handleRemoveProyecto(pId)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-red)', display: 'flex' }}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Barra de búsqueda de proyectos */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.2rem' }}
                  placeholder="🔍 Escribe para buscar código o nombre del proyecto..."
                  value={proyectoSearch}
                  onFocus={() => setIsProjectDropdownOpen(true)}
                  onChange={(e) => {
                    setProyectoSearch(e.target.value);
                    setIsProjectDropdownOpen(true);
                  }}
                />
              </div>

              {/* Dropdown flotante con resultados */}
              {isProjectDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 50,
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}>
                  {filteredProyectos.length === 0 ? (
                    <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                      No se encontraron proyectos con "{proyectoSearch}"
                    </div>
                  ) : (
                    filteredProyectos.map(p => {
                      const isSelected = selectedProyectos.includes(String(p.id_proyecto));
                      return (
                        <div
                          key={p.id_proyecto}
                          onClick={() => handleAddProyecto(String(p.id_proyecto))}
                          style={{
                            padding: '0.6rem 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(204, 51, 51, 0.08)' : 'transparent',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.denominacion}</div>
                            {p.area && <div style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)' }}>Área: {p.area}</div>}
                          </div>
                          {isSelected ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary-red)', fontWeight: 700 }}>✓ Seleccionado</span>
                          ) : (
                            <button type="button" className="btn btn-sm btn-outline" style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}>
                              + Agregar
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: RESPONSABLE */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <User size={16} color="var(--primary-red)" /> 2. Empleado que Retira el Inventario *
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
                  placeholder="Ingrese Nombre y Apellido completo..."
                  value={customUser}
                  onChange={(e) => setCustomUser(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* SECCIÓN 3: SELECCIÓN DE ELEMENTOS CON REGLAS DE NEGOCIO */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <Truck size={16} color="var(--primary-red)" /> 3. Elementos a Llevar ({selectedItems.length} seleccionados) *
            </label>

            {/* Filtros de Categoría y Búsqueda */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '0.85rem' }}
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="TODOS">Todas las Categorías</option>
                {categorias.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2rem', height: '38px', fontSize: '0.85rem' }}
                  placeholder="Buscar ítem por nombre, código interno, serie..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Lista disponible para agregar */}
            <div style={{
              maxHeight: '170px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.5rem',
              background: 'var(--bg-card-hover)',
              marginBottom: '1rem'
            }}>
              {filteredInventario.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No hay ítems disponibles para agregar con los filtros actuales.
                </div>
              ) : (
                filteredInventario.slice(0, 30).map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '0.825rem'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700, marginRight: '0.5rem' }}>
                        [{item.categoria}]
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

            {/* Tabla de ítems seleccionados con sus lecturas iniciales según reglas */}
            {selectedItems.length > 0 && (
              <div style={{
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                background: 'var(--bg-card)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Elemento</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '220px' }}>Salida (Regla de Negocio)</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '130px' }}>Costo Unit.</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '50px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)' }}>{item.categoria}</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.nombre}</div>
                          {item.isIns && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Info size={11} /> Instrumental: valor salida 0 (días de uso al retorno)
                            </div>
                          )}
                          {item.isMov && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Info size={11} /> Movilidad: Kilómetros Odómetro
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {item.isIns ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: '70px', padding: '0.4rem 0.5rem', background: 'var(--bg-card-hover)', cursor: 'not-allowed' }}
                                value={0}
                                disabled
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>0 fijo</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="form-input"
                                style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                                value={item.unidad_s}
                                onChange={(e) => handleItemChange(idx, 'unidad_s', e.target.value)}
                                placeholder={item.isMov ? "Km Odómetro" : "Cantidad"}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {item.isMov ? 'km' : 'u'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>$</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="form-input"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                              value={item.costo_u}
                              onChange={(e) => handleItemChange(idx, 'costo_u', e.target.value)}
                            />
                          </div>
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
              <Edit3 size={16} color="var(--primary-red)" /> 4. Firma Digital de Salida *
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
