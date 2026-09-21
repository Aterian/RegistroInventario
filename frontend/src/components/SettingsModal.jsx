import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, X, Globe, Smartphone, Monitor, RefreshCw, Cloud, Download } from 'lucide-react';
import { isDesktopApp, getGasUrl, setGasUrl, getApiBaseUrl, setApiBaseUrl, api, getOfflineQueue, syncOfflineQueue } from '../api';

export const SettingsModal = ({ isOpen, onClose, onSaved }) => {
  const isDesktop = isDesktopApp();

  // Estados para modo Móvil / Cloud
  const [gasUrlInput, setGasUrlInput] = useState(getGasUrl());
  const [offlineItems, setOfflineItems] = useState([]);
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Estados para modo Escritorio
  const [desktopConfig, setDesktopConfig] = useState({
    spreadsheet_inventario: '',
    spreadsheet_roster: '',
    credentials_file: '',
    github_repo: ''
  });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  // Estados generales
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setGasUrlInput(getGasUrl());
      setOfflineItems(getOfflineQueue());
      setTestResult(null);
      setUpdateInfo(null);

      if (isDesktop) {
        api.obtenerConfigSheets().then((cfg) => {
          if (cfg) {
            setDesktopConfig({
              spreadsheet_inventario: cfg.spreadsheet_inventario || '',
              spreadsheet_roster: cfg.spreadsheet_roster || '',
              credentials_file: cfg.credentials_file || '',
              github_repo: cfg.github_repo || ''
            });
          }
        }).catch(() => {});
      }
    }
  }, [isOpen, isDesktop]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (isDesktop) {
        const res = await api.probarConexionSheets();
        if (res.connected) {
          setTestResult({
            success: true,
            message: `Conexión con Google Cloud exitosa. Inventario: ${res.inventario_ok ? 'OK' : 'Error'}, Roster: ${res.roster_ok ? 'OK' : 'Error'}.`
          });
        } else {
          setTestResult({
            success: false,
            message: `No se pudo conectar a Google Sheets. Verifique el archivo de credenciales y los permisos.`
          });
        }
      } else {
        // En móvil/web
        setGasUrl(gasUrlInput);
        const res = await api.getEstado();
        if (res && res.estado === 'ONLINE') {
          setTestResult({
            success: true,
            message: `¡Conexión Cloud 24/7 exitosa! Libro: ${res.nombre_libro || 'Conectado'} | Proyectos: ${res.total_proyectos ?? '0'} | Empleados: ${res.total_usuarios ?? '0'}.`
          });
        } else {
          setTestResult({
            success: false,
            message: `Respuesta recibida pero con advertencia: ${JSON.stringify(res)}`
          });
        }
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Error al probar conexión: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncOffline = async () => {
    setSyncingOffline(true);
    try {
      const res = await syncOfflineQueue();
      setOfflineItems(getOfflineQueue());
      setTestResult({
        success: true,
        message: `Sincronización finalizada: ${res.synced} subidos con éxito, ${res.remaining} pendientes.`
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Error sincronizando pendientes: ${err.message}`
      });
    } finally {
      setSyncingOffline(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    try {
      const res = await api.verificarActualizacion();
      setUpdateInfo(res);
    } catch (err) {
      setUpdateInfo({ actualizacion_disponible: false, error: err.message });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSave = async () => {
    if (isDesktop) {
      await api.guardarConfigSheets(desktopConfig);
    } else {
      setGasUrl(gasUrlInput);
    }
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} color="var(--primary-red)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>Configuración del Sistema</h3>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: '0.3rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Badge de Entorno Detectado */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 0.8rem',
            background: isDesktop ? 'rgba(6, 182, 212, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${isDesktop ? 'rgba(6, 182, 212, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            borderRadius: '0.5rem',
            marginBottom: '1.2rem'
          }}>
            {isDesktop ? <Monitor size={18} color="var(--accent-cyan)" /> : <Smartphone size={18} color="var(--accent-emerald)" />}
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: isDesktop ? 'var(--accent-cyan)' : 'var(--accent-emerald)' }}>
              {isDesktop 
                ? '💻 Modo Escritorio Nativo (PyWebView + SQLite AppData)' 
                : '📱 Modo Móvil Autónomo (Conexión Cloud 24/7 sin PC)'}
            </span>
          </div>

          {!isDesktop ? (
            /* CONFIGURACIÓN PARA MÓVIL / WEB (INDEPENDIENTE 24/7) */
            <>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Cloud size={15} color="var(--accent-cyan)" /> URL de Google Apps Script Web App (Cloud 24/7)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)', marginTop: '0.3rem', display: 'block' }}>
                  ✓ Esta URL conecta la aplicación móvil directamente a Google Cloud.
                  <br />
                  ✓ <strong>No es necesario prender la PC</strong> para usar la app en el celular.
                </span>
              </div>

              {offlineItems.length > 0 && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--accent-yellow)' }}>
                      📡 {offlineItems.length} registro(s) pendiente(s) de subida
                    </span>
                    <p style={{ fontSize: '0.725rem', color: 'var(--corporate-gray)', margin: 0 }}>
                      Guardados localmente mientras estabas en terreno sin señal.
                    </p>
                  </div>
                  <button
                    onClick={handleSyncOffline}
                    disabled={syncingOffline}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {syncingOffline ? 'Subiendo...' : 'Sincronizar'}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* CONFIGURACIÓN PARA ESCRITORIO NATIVO */
            <>
              <div className="form-group">
                <label className="form-label">Nombre o ID del Libro de Inventario</label>
                <input
                  type="text"
                  className="form-input"
                  value={desktopConfig.spreadsheet_inventario}
                  onChange={(e) => setDesktopConfig({ ...desktopConfig, spreadsheet_inventario: e.target.value })}
                  placeholder="Inventario v1.5 - Dev"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre o ID del Libro de Roster (Personal y Proyectos)</label>
                <input
                  type="text"
                  className="form-input"
                  value={desktopConfig.spreadsheet_roster}
                  onChange={(e) => setDesktopConfig({ ...desktopConfig, spreadsheet_roster: e.target.value })}
                  placeholder="BBDD_asist_roster"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Archivo de Clave Privada Service Account</label>
                <input
                  type="text"
                  className="form-input"
                  value={desktopConfig.credentials_file}
                  onChange={(e) => setDesktopConfig({ ...desktopConfig, credentials_file: e.target.value })}
                  placeholder="credentials.json"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--corporate-gray)', marginTop: '0.2rem', display: 'block' }}>
                  El sistema busca automáticamente en %LOCALAPPDATA%\Ingeap\Inventario y junto al ejecutable.
                </span>
              </div>

              {/* Botón de Comprobación de Actualizaciones */}
              <div style={{ padding: '0.75rem 0', borderTop: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className="btn btn-sm btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <RefreshCw size={14} className={checkingUpdate ? 'spin' : ''} />
                  {checkingUpdate ? 'Consultando GitHub...' : 'Buscar Actualizaciones'}
                </button>

                {updateInfo && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    {updateInfo.actualizacion_disponible ? (
                      <div style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Download size={14} />
                        <span>Nueva versión {updateInfo.version_nueva} disponible.</span>
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: 'auto' }}
                          onClick={() => api.aplicarActualizacion(updateInfo.url_descarga)}
                        >
                          Actualizar Ahora
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--corporate-gray)' }}>
                        ✓ Estás utilizando la versión más reciente.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Botón Probar Conexión */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', marginBottom: '0.8rem' }}>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="btn btn-sm btn-secondary"
            >
              {testing ? 'Comprobando...' : 'Probar Conectividad'}
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
