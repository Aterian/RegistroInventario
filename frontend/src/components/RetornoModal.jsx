import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ArrowRightCircle, 
  Sliders, 
  Divide, 
  User, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { SignaturePadModal } from './SignaturePadModal';
import { api } from '../api';

export const RetornoModal = ({ 
  isOpen, 
  onClose, 
  viaje, 
  usuarios = [], 
  onSuccess 
}) => {
  if (!isOpen || !viaje) return null;

  // Extraer proyectos y elementos únicos del viaje
  const proyectos = useMemo(() => {
    const raw = viaje.proyectos || [];
    // Si los proyectos son strings o dicts
    return raw.map(p => {
      if (typeof p === 'object' && p !== null) {
        return { id_proyecto: String(p.id_proyecto || p.id), denominacion: p.denominacion || p.nombre };
      }
      return { id_proyecto: String(p), denominacion: String(p) };
    });
  }, [viaje]);

  const items = useMemo(() => {
    return viaje.items || [];
  }, [viaje]);

  // Estados de formulario
  const [unidadesRetorno, setUnidadesRetorno] = useState({});
  const [prorrateoMode, setProrrateoMode] = useState('equitativo'); // 'equitativo' | 'porcentual'
  const [porcentajes, setPorcentajes] = useState({});
  const [selectedUserR, setSelectedUserR] = useState('');
  const [customUserR, setCustomUserR] = useState('');

  // Firma
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [firmaRBase64, setFirmaRBase64] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Inicializar lecturas de retorno y prorrateo
  useEffect(() => {
    // Inicializar unidades_r con valor al menos igual a unidad_s
    const initUnidades = {};
    items.forEach(it => {
      const key = it.id_gasto || it.elemento;
      initUnidades[key] = it.unidad_r > 0 ? it.unidad_r : (it.unidad_s || 0);
    });
    setUnidadesRetorno(initUnidades);

    // Inicializar porcentajes equitativos
    if (proyectos.length > 0) {
      const basePct = parseFloat((100 / proyectos.length).toFixed(2));
      const initPct = {};
      let acumulado = 0;
      proyectos.forEach((p, idx) => {
        if (idx === proyectos.length - 1) {
          initPct[p.id_proyecto] = parseFloat((100 - acumulado).toFixed(2));
        } else {
          initPct[p.id_proyecto] = basePct;
          acumulado += basePct;
        }
      });
      setPorcentajes(initPct);
    }
  }, [items, proyectos]);

  // Calcular suma total de porcentajes
  const sumaPorcentajes = useMemo(() => {
    const total = Object.values(porcentajes).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    return Math.round(total * 100) / 100;
  }, [porcentajes]);

  const isProrrateoValido = Math.abs(sumaPorcentajes - 100.0) < 0.05;

  // Cambiar a modo equitativo
  const handleSetEquitativo = () => {
    setProrrateoMode('equitativo');
    if (proyectos.length > 0) {
      const basePct = parseFloat((100 / proyectos.length).toFixed(2));
      const initPct = {};
      let acumulado = 0;
      proyectos.forEach((p, idx) => {
        if (idx === proyectos.length - 1) {
          initPct[p.id_proyecto] = parseFloat((100 - acumulado).toFixed(2));
        } else {
          initPct[p.id_proyecto] = basePct;
          acumulado += basePct;
        }
      });
      setPorcentajes(initPct);
    }
  };

  // Manejar cambio de slider de un proyecto
  const handleSliderChange = (projId, val) => {
    const floatVal = parseFloat(val) || 0;
    setPorcentajes(prev => ({
      ...prev,
      [projId]: floatVal
    }));
  };

  // Envío de retorno
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isProrrateoValido) {
      setErrorMessage(`La suma de los porcentajes de prorrateo debe ser exactamente 100%. Actual: ${sumaPorcentajes}%`);
      return;
    }

    const finalUser = selectedUserR === 'OTRO' ? customUserR.trim() : selectedUserR;
    if (!finalUser) {
      setErrorMessage('Debe especificar el empleado que recibe el retorno.');
      return;
    }

    if (!firmaRBase64) {
      setErrorMessage('La firma digital de recepción es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = items.map(it => {
        const key = it.id_gasto || it.elemento;
        return {
          id_gasto: it.id_gasto || null,
          elemento: it.elemento || '',
          unidad_r: parseFloat(unidadesRetorno[key]) || 0.0
        };
      });

      const prorrateoPayload = proyectos.map(p => ({
        id_proyecto: p.id_proyecto,
        porcentaje: parseFloat(porcentajes[p.id_proyecto]) || 0.0
      }));

      await api.registrarRetorno({
        id_viaje: viaje.id_viaje,
        items: itemsPayload,
        prorrateo: prorrateoPayload,
        user_r: finalUser,
        firma_r_base64: firmaRBase64
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Error registrando el retorno');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowRightCircle size={20} color="var(--primary-red)" />
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>
                Cierre de Viaje y Retorno de Inventario
              </h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              ID: {viaje.id_viaje} | Salida: {viaje.fecha_s} ({viaje.user_s})
            </div>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: '0.3rem' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {errorMessage && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(204, 51, 51, 0.12)',
                border: '1px solid rgba(204, 51, 51, 0.3)',
                color: 'var(--primary-red)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}>
                <AlertTriangle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SECCIÓN 1: LECTURA DE UNIDADES DE RETORNO */}
            <div>
              <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                1. Registro de Unidades Finales al Retorno (Odómetro / Cantidad)
              </label>
              <div style={{
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                background: 'var(--bg-surface-elevated)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-strong)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Elemento</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>Unid. Salida</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '120px' }}>Unid. Retorno</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '80px', textAlign: 'right' }}>Consumo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const key = it.id_gasto || it.elemento;
                      const u_s = parseFloat(it.unidad_s) || 0;
                      const u_r = parseFloat(unidadesRetorno[key]) || 0;
                      const tipo = (it.tipo || '').toLowerCase();
                      const isMov = tipo.includes('movilidad');
                      const isIns = tipo.includes('instrumental') && !tipo.includes('dron');
                      const isMat = tipo.includes('material');

                      let consumoTexto = '';
                      if (isMov) {
                        const delta = Math.max(0, u_r - u_s);
                        consumoTexto = `+${delta.toFixed(0)} km`;
                      } else if (isIns) {
                        consumoTexto = `${u_r} días`;
                      } else if (isMat) {
                        const consumo = Math.max(0, u_s - u_r);
                        consumoTexto = `${consumo} consumidos`;
                      } else {
                        consumoTexto = `${u_r} u.`;
                      }

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{it.elemento}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              {it.tipo} • Costo U: ${it.costo_u} {isMov ? '/km' : (isIns ? '/día' : '/u')}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>
                            {u_s} {isMov ? 'km' : (isIns ? '(Días al ret.)' : 'u')}
                          </td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>
                            <input
                              type="number"
                              step="any"
                              min={isMov ? u_s : 0}
                              className="form-input"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                              placeholder={isMov ? "Km final" : (isIns ? "Días de uso" : "Devueltos")}
                              value={unidadesRetorno[key] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUnidadesRetorno(prev => ({ ...prev, [key]: val }));
                              }}
                              required
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-red)', fontFamily: 'monospace' }}>
                            {consumoTexto}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECCIÓN 2: PRORRATEO MULTIPROYECTO */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.875rem', margin: 0 }}>
                  2. Modalidad de Prorrateo de Costos entre Proyectos
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={handleSetEquitativo}
                    className={`btn btn-sm ${prorrateoMode === 'equitativo' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <Divide size={13} /> Equitativo (100 / {proyectos.length}%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProrrateoMode('porcentual')}
                    className={`btn btn-sm ${prorrateoMode === 'porcentual' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <Sliders size={13} /> Porcentual (Sliders)
                  </button>
                </div>
              </div>

              {/* Sliders o Porcentajes */}
              <div style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-elevated)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {proyectos.map(p => {
                  const pct = porcentajes[p.id_proyecto] || 0;
                  return (
                    <div key={p.id_proyecto}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.denominacion}</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary-red)', fontFamily: 'monospace' }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="slider-container">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          disabled={prorrateoMode === 'equitativo'}
                          className="slider-input"
                          value={pct}
                          onChange={(e) => handleSliderChange(p.id_proyecto, e.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          disabled={prorrateoMode === 'equitativo'}
                          className="form-input"
                          style={{ width: '75px', padding: '0.25rem 0.4rem', fontSize: '0.8rem', textAlign: 'right' }}
                          value={pct}
                          onChange={(e) => handleSliderChange(p.id_proyecto, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Validador de Suma 100% */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem'
                }}>
                  <span>Suma total de prorrateo:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontWeight: 800,
                      fontSize: '1rem',
                      fontFamily: 'monospace',
                      color: isProrrateoValido ? 'var(--accent-emerald)' : 'var(--primary-red)'
                    }}>
                      {sumaPorcentajes}%
                    </span>
                    {isProrrateoValido ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> Correcto (100%)
                      </span>
                    ) : (
                      <span className="badge badge-active">
                        <AlertTriangle size={12} /> Requiere 100%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: RECEPTOR Y FIRMA DE RETORNO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  <User size={15} color="var(--primary-red)" /> 3. Empleado que Recibe
                </label>
                <select
                  className="form-select"
                  value={selectedUserR}
                  onChange={(e) => setSelectedUserR(e.target.value)}
                  required
                >
                  <option value="">-- Seleccionar receptor --</option>
                  {usuarios.map(u => (
                    <option key={u.id_usuario} value={u.nombre}>
                      {u.nombre} ({u.area || 'Ingeap'})
                    </option>
                  ))}
                  <option value="OTRO">-- Otro empleado --</option>
                </select>

                {selectedUserR === 'OTRO' && (
                  <input
                    type="text"
                    className="form-input"
                    style={{ marginTop: '0.5rem' }}
                    placeholder="Nombre del receptor..."
                    value={customUserR}
                    onChange={(e) => setCustomUserR(e.target.value)}
                    required
                  />
                )}
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  <Edit3 size={15} color="var(--primary-red)" /> 4. Firma de Recepción
                </label>

                {firmaRBase64 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--accent-emerald)',
                    background: 'rgba(16, 185, 129, 0.08)'
                  }}>
                    <img src={firmaRBase64} alt="Firma Retorno" style={{ height: '36px', background: '#fff', borderRadius: '3px' }} />
                    <button
                      type="button"
                      onClick={() => setIsSigModalOpen(true)}
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSigModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                  >
                    <Edit3 size={14} /> Firmar Devolución
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-sm btn-outline" disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={isSubmitting || !isProrrateoValido || !firmaRBase64}
            >
              {isSubmitting ? 'Liquidando y Actualizando Sheets...' : 'Cerrar Viaje y Liquidar'}
            </button>
          </div>
        </form>

        {/* Modal de Firma */}
        <SignaturePadModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onSave={(b64) => setFirmaRBase64(b64)}
          title="Firma de Retorno y Recepción de Inventario"
        />
      </div>
    </div>
  );
};
