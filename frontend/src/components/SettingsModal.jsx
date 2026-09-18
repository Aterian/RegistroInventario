import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, X, Globe } from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl, api } from '../api';

export const SettingsModal = ({ isOpen, onClose, onSaved }) => {
  const [urlInput, setUrlInput] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const cleanUrl = urlInput.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/estado`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          message: `Conexión exitosa. Servidor: ${data.estado} (Google: ${data.google_connected ? 'OK' : 'Modo local'})`
        });
      } else {
        setTestResult({
          success: false,
          message: `Error HTTP ${res.status}: ${res.statusText}`
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `No se pudo conectar: ${err.message}. Verifique la IP y que el servidor Python esté corriendo.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = urlInput.trim().replace(/\/+$/, '');
    setApiBaseUrl(cleanUrl);
    if (onSaved) onSaved();
    onClose();
  };

  const handleResetDefault = () => {
    setUrlInput('/api');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} color="var(--primary-red)" />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>Configuración de Conexión</h3>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: '0.3rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">
              <Globe size={14} /> Dirección del Servidor Backend (API URL)
            </label>
            <input
              type="text"
              className="form-input"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Ej: http://192.168.1.50:8000/api o /api"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)', marginTop: '0.25rem' }}>
              Para la app Android, coloque la IP local de la computadora principal en la red Wi-Fi (ej: http://192.168.0.25:8000/api).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="btn btn-sm btn-secondary"
            >
              {testing ? 'Comprobando...' : 'Probar Conexión'}
            </button>
            <button
              onClick={handleResetDefault}
              className="btn btn-sm btn-outline"
            >
              Restablecer Predeterminado
            </button>
          </div>

          {testResult && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: testResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(204, 51, 51, 0.12)',
              border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(204, 51, 51, 0.3)'}`,
              color: testResult.success ? 'var(--accent-emerald)' : 'var(--primary-red)'
            }}>
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-sm btn-outline">
            Cancelar
          </button>
          <button onClick={handleSave} className="btn btn-sm btn-primary">
            <Save size={14} /> Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
