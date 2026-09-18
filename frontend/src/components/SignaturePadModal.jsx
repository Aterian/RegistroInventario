import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw, Check, X, Edit3 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const SignaturePadModal = ({ isOpen, onClose, onSave, title = "Firma Digital Requerida" }) => {
  const sigPadRef = useRef(null);
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const handleClear = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
    }
  };

  const handleSave = () => {
    if (sigPadRef.current) {
      if (sigPadRef.current.isEmpty()) {
        alert("Por favor dibuje su firma antes de confirmar.");
        return;
      }
      // Obtener PNG en base64
      const base64Data = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
      onSave(base64Data);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 size={18} color="var(--primary-red)" />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{title}</h3>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: '0.3rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Firme en el recuadro utilizando el dedo en pantalla táctil o el cursor del mouse:
          </p>

          <div style={{
            border: '2px dashed var(--corporate-gray)',
            borderRadius: '0.75rem',
            backgroundColor: isDark ? '#1a202c' : '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <SignatureCanvas
              ref={sigPadRef}
              penColor={isDark ? '#f8fafc' : '#0f172a'}
              canvasProps={{
                style: {
                  width: '100%',
                  height: '200px',
                  display: 'block',
                  cursor: 'crosshair'
                }
              }}
            />
            {/* Guía visual sutil */}
            <div style={{
              position: 'absolute',
              bottom: '35px',
              left: '10%',
              right: '10%',
              height: '1px',
              borderBottom: '1px dashed var(--corporate-gray)',
              pointerEvents: 'none',
              opacity: 0.6
            }} />
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button onClick={handleClear} className="btn btn-sm btn-secondary">
            <RotateCcw size={14} /> Limpiar
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} className="btn btn-sm btn-outline">
              Cancelar
            </button>
            <button onClick={handleSave} className="btn btn-sm btn-primary">
              <Check size={14} /> Confirmar Firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
