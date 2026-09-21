import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Keyboard, AlertTriangle, CheckCircle } from 'lucide-react';

export const QRScannerModal = ({ isOpen, onClose, onScanSuccess, title = "Escanear Código QR" }) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState('');
  const html5QrCodeRef = useRef(null);
  const scannerContainerId = "qr-reader-container";

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      setCameraError('');
      setScannedResult('');
      setManualCode('');

      const timer = setTimeout(async () => {
        try {
          const qrScanner = new Html5Qrcode(scannerContainerId);
          html5QrCodeRef.current = qrScanner;

          const config = {
            fps: 15,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          };

          await qrScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              if (!isMounted) return;
              handleSuccess(decodedText);
            },
            (errorMessage) => {
              // lectura en curso (errores de frame ignorados)
            }
          );
          if (isMounted) setIsScanning(true);
        } catch (err) {
          if (isMounted) {
            console.warn("No se pudo iniciar la cámara para QR:", err);
            setCameraError("No se pudo acceder a la cámara. Por favor asegúrese de otorgar permisos o use el ingreso manual de código.");
            setIsScanning(false);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        isMounted = false;
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Error deteniendo el escáner QR:", err);
      } finally {
        html5QrCodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleSuccess = (rawText) => {
    let cleanCode = String(rawText || '').trim();
    // Soporta formato INGEAP:3001 o {"codigo":"3001"} o código plano
    if (cleanCode.startsWith('INGEAP:')) {
      cleanCode = cleanCode.replace('INGEAP:', '').trim();
    } else if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanCode);
        cleanCode = parsed.codigo_interno || parsed.codigo || parsed.id || cleanCode;
      } catch (e) {}
    }

    setScannedResult(cleanCode);
    stopScanner();

    if (onScanSuccess) {
      onScanSuccess(cleanCode);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccess(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '460px', width: '92%', padding: '1.25rem' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={22} color="var(--primary-red)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{title}</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-sm btn-outline"
            style={{ padding: '0.35rem 0.5rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div style={{
          position: 'relative',
          background: '#090d16',
          borderRadius: '8px',
          overflow: 'hidden',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1rem'
        }}>
          <div id={scannerContainerId} style={{ width: '100%', height: '100%' }}></div>

          {cameraError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.95)',
              textAlign: 'center',
              gap: '0.75rem'
            }}>
              <AlertTriangle size={36} color="var(--accent-amber)" />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {cameraError}
              </p>
            </div>
          )}

          {scannedResult && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(16, 185, 129, 0.92)',
              color: '#fff',
              textAlign: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle size={44} />
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>¡Código detectado!</h4>
              <span style={{ fontSize: '1.1rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem 0.75rem', borderRadius: '6px', fontWeight: 700 }}>
                {scannedResult}
              </span>
            </div>
          )}
        </div>

        {/* Ingreso manual como respaldo */}
        <form onSubmit={handleManualSubmit} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            <Keyboard size={14} /> Ingreso manual de código o número interno
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text"
              className="form-input"
              placeholder="Ej: 3001, H1, 1000..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
