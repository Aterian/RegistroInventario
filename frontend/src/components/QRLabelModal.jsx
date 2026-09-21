import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { X, Printer, Download, QrCode, Tag, Check } from 'lucide-react';
import logoIngeap from '../assets/logo_ingeap.png';

export const QRLabelModal = ({ isOpen, onClose, item }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copied, setCopied] = useState(false);

  const codigoInterno = item?.codigo_interno || 'S/C';
  const qrContent = `INGEAP:${codigoInterno}`;

  useEffect(() => {
    if (isOpen && item) {
      QRCode.toDataURL(qrContent, {
        width: 320,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("Error generando QR DataURL:", err));
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      // Dimensiones de etiqueta estándar de 70mm x 40mm (aprox 198 x 113 pt)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [70, 42]
      });

      // Fondo blanco limpio
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 70, 42, 'F');

      // Borde exterior corporativo fino
      doc.setDrawColor(204, 51, 51); // Rojo Ingeap
      doc.setLineWidth(0.6);
      doc.roundedRect(1.5, 1.5, 67, 39, 1.5, 1.5, 'S');

      // Logo Ingeap en esquina superior izquierda
      try {
        doc.addImage(logoIngeap, 'PNG', 4, 3, 22, 9);
      } catch (e) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(204, 51, 51);
        doc.text('INGEAP', 4, 7);
      }

      // Encabezado institucional
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('CONTROL PATRIMONIAL', 28, 6.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text(item.categoria ? item.categoria.toUpperCase() : 'INVENTARIO', 28, 10);

      // Línea divisoria
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(4, 13, 66, 13);

      // Código QR a la derecha
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 43, 14.5, 23, 23);
      }

      // Código interno destacado en tamaño grande (negrita)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(204, 51, 51);
      doc.text(codigoInterno, 4, 19.5);

      // Nombre del elemento
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const splitNombre = doc.splitTextToSize(item.nombre || 'Sin descripción', 37);
      doc.text(splitNombre.slice(0, 2), 4, 25);

      // Número de serie o patente
      if (item.numero_serie) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`S/N: ${item.numero_serie}`, 4, 34);
      }

      // Pie con marca de verificación
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(4.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`ID: ${String(item.id || '').substring(0, 14)}`, 4, 38.5);

      doc.save(`Etiqueta_${codigoInterno}_${(item.nombre || 'item').substring(0, 12)}.pdf`);
    } catch (err) {
      alert('Error generando PDF de etiqueta: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codigoInterno);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '440px', width: '92%', padding: '1.25rem' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag size={20} color="var(--primary-red)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Etiqueta de Identificación QR</h3>
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

        {/* Vista previa de etiqueta física */}
        <div style={{
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          border: '2px solid var(--primary-red)',
          position: 'relative',
          marginBottom: '1.25rem'
        }}>
          {/* Header de etiqueta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <img src={logoIngeap} alt="Ingeap Logo" style={{ height: '24px', objectFit: 'contain' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>CONTROL PATRIMONIAL</div>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{item.categoria?.toUpperCase()}</div>
            </div>
          </div>

          {/* Cuerpo: código destacado + datos a la izquierda, QR a la derecha */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-red)', letterSpacing: '-0.5px', marginBottom: '0.15rem' }}>
                {codigoInterno}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.2, marginBottom: '0.35rem' }}>
                {item.nombre}
              </div>
              {item.numero_serie && (
                <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                  S/N: {item.numero_serie}
                </div>
              )}
              {item.modo_costeo && (
                <div style={{ fontSize: '0.65rem', color: '#0284c7', marginTop: '0.25rem', fontWeight: 600 }}>
                  Costeo: {item.modo_costeo}
                </div>
              )}
            </div>

            {/* Código QR */}
            <div style={{
              background: '#f8fafc',
              padding: '4px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" style={{ width: '90px', height: '90px', display: 'block' }} />
              ) : (
                <div style={{ width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={36} color="#94a3b8" />
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Codificado: {qrContent}</span>
            <span>ID: {String(item.id || '').substring(0, 10)}</span>
          </div>
        </div>

        {/* Botonera de acciones */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={handleDownloadPdf}
            className="btn btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            disabled={isGeneratingPdf}
          >
            <Download size={16} /> {isGeneratingPdf ? 'Generando...' : 'Descargar PDF Etiqueta'}
          </button>

          <button 
            type="button"
            onClick={handleCopyCode}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem' }}
          >
            {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Tag size={16} />}
            {copied ? 'Copiado' : 'Copiar Código'}
          </button>
        </div>
      </div>
    </div>
  );
};
