import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable
)

from backend.config import (
    PDFS_DIR,
    UPLOADS_DIR,
    COLOR_PRIMARY_RED,
    COLOR_CORPORATE_GRAY,
    COLOR_DARK_NAVY
)

logger = logging.getLogger("ingeap.pdf_service")

def _resolve_signature_path(signature_ref: str) -> Optional[str]:
    """Resuelve la ruta local de una imagen de firma para incrustarla en el PDF."""
    if not signature_ref:
        return None

    # Si ya es ruta absoluta y existe
    if os.path.exists(signature_ref):
        return signature_ref

    # Si es ruta relativa tipo /api/uploads/firmas/xxx.png
    basename = os.path.basename(signature_ref)
    candidate = UPLOADS_DIR / basename
    if candidate.exists():
        return str(candidate)

    # Si es solo el nombre de archivo en UPLOADS_DIR
    candidate = UPLOADS_DIR / signature_ref
    if candidate.exists():
        return str(candidate)

    return None

def generate_remito_pdf(viaje_data: Dict[str, Any]) -> str:
    """
    Genera el remito formal de entrega y retorno en PDF utilizando ReportLab.
    Retorna la ruta absoluta del archivo PDF generado.
    """
    id_viaje = viaje_data.get("id_viaje", "desconocido")
    pdf_filename = f"remito_{id_viaje[:8]}_{id_viaje[-6:]}.pdf"
    output_path = PDFS_DIR / pdf_filename

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos personalizados
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor(COLOR_PRIMARY_RED)
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor(COLOR_CORPORATE_GRAY)
    )

    header_badge_style = ParagraphStyle(
        "HeaderBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.white,
        alignment=2 # Right
    )

    meta_label_style = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor(COLOR_DARK_NAVY)
    )

    meta_val_style = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155")
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1 # Center
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b")
    )

    table_cell_center = ParagraphStyle(
        "TableCellCenter",
        parent=table_cell_style,
        alignment=1 # Center
    )

    table_cell_num = ParagraphStyle(
        "TableCellNum",
        parent=table_cell_style,
        alignment=2 # Right
    )

    story = []

    # 1. ENCABEZADO Y LOGO INGEAP
    estado_viaje = "RETORNADO" if viaje_data.get("fecha_r") else "EN CURSO / SALIDA"
    badge_bg = colors.HexColor("#10b981") if viaje_data.get("fecha_r") else colors.HexColor(COLOR_PRIMARY_RED)

    logo_path = Path(__file__).resolve().parent / "assets" / "logo_ingeap.png"
    logo_flowable = None
    if logo_path.exists():
        try:
            logo_flowable = RLImage(str(logo_path), width=1.4*inch, height=0.5*inch)
        except Exception as e_img:
            logger.warning(f"No se pudo cargar imagen de logo para PDF: {e_img}")

    if logo_flowable:
        header_table_data = [
            [
                logo_flowable,
                Paragraph("<b>INGEAP S.A.</b><br/><font size=9 color='#64748b'>Gestión de Inventario y Viajes</font>", title_style),
                Paragraph(f"<b>ESTADO: {estado_viaje}</b><br/><font size=8>Remito: {id_viaje[:12]}...</font>", header_badge_style)
            ]
        ]
        header_table = Table(header_table_data, colWidths=[110, 230, 200])
    else:
        header_table_data = [
            [
                Paragraph("<b>INGEAP S.A.</b><br/><font size=10 color='#64748b'>Gestión de Inventario y Viajes Multiproyecto</font>", title_style),
                Paragraph(f"<b>ESTADO: {estado_viaje}</b><br/><font size=8>Remito: {id_viaje[:12]}...</font>", header_badge_style)
            ]
        ]
        header_table = Table(header_table_data, colWidths=[340, 200])

    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (-1, 0), (-1, 0), "RIGHT"),
        ("BACKGROUND", (-1, 0), (-1, 0), badge_bg),
        ("BOTTOMPADDING", (-1, 0), (-1, 0), 6),
        ("TOPPADDING", (-1, 0), (-1, 0), 6),
        ("LEFTPADDING", (-1, 0), (-1, 0), 8),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 8),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor(COLOR_PRIMARY_RED), spaceAfter=12))

    # 2. METADATOS DEL VIAJE
    proyectos_lista = viaje_data.get("proyectos", [])
    if isinstance(proyectos_lista, str):
        proyectos_str = proyectos_lista
    elif isinstance(proyectos_lista, list):
        proyectos_str = ", ".join([p.get("denominacion", str(p)) if isinstance(p, dict) else str(p) for p in proyectos_lista])
    else:
        proyectos_str = "No especificado"

    meta_grid = [
        [
            Paragraph("Identificador de Viaje (UUID):", meta_label_style),
            Paragraph(id_viaje, meta_val_style),
            Paragraph("Proyectos Asignados:", meta_label_style),
            Paragraph(proyectos_str or "Sin proyectos asignados", meta_val_style)
        ],
        [
            Paragraph("Fecha y Hora Salida:", meta_label_style),
            Paragraph(str(viaje_data.get("fecha_s") or "-"), meta_val_style),
            Paragraph("Fecha y Hora Retorno:", meta_label_style),
            Paragraph(str(viaje_data.get("fecha_r") or "Pendiente de devolución"), meta_val_style)
        ],
        [
            Paragraph("Responsable Salida:", meta_label_style),
            Paragraph(str(viaje_data.get("user_s") or "-"), meta_val_style),
            Paragraph("Responsable Retorno:", meta_label_style),
            Paragraph(str(viaje_data.get("user_r") or "Pendiente"), meta_val_style)
        ]
    ]

    meta_table = Table(meta_grid, colWidths=[130, 140, 120, 150])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0"))
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # 3. TABLA DE ELEMENTOS RETIRADOS / LIQUIDADOS
    story.append(Paragraph("<b>DETALLE DE ELEMENTOS Y CONSUMO DE INVENTARIO</b>", meta_label_style))
    story.append(Spacer(1, 6))

    items = viaje_data.get("items", [])
    table_rows = [
        [
            Paragraph("Tipo", table_header_style),
            Paragraph("Elemento / Código", table_header_style),
            Paragraph("Proyecto", table_header_style),
            Paragraph("U. Medida", table_header_style),
            Paragraph("Unid. S", table_header_style),
            Paragraph("Unid. R", table_header_style),
            Paragraph("Dif.", table_header_style),
            Paragraph("Costo Tot.", table_header_style),
        ]
    ]

    total_liquidado = 0.0
    for it in items:
        u_s = float(it.get("unidad_s", 0) or 0)
        u_r = float(it.get("unidad_r", 0) or 0)
        diff = max(0.0, u_r - u_s) if viaje_data.get("fecha_r") else 0.0
        c_t = float(it.get("costo_t", 0) or 0)
        total_liquidado += c_t
        u_medida = str(it.get("unidad_medida") or "-")

        table_rows.append([
            Paragraph(str(it.get("tipo") or "-"), table_cell_style),
            Paragraph(str(it.get("elemento") or "-"), table_cell_style),
            Paragraph(str(it.get("proyecto") or "-"), table_cell_style),
            Paragraph(u_medida, table_cell_center),
            Paragraph(f"{u_s:,.1f}", table_cell_center),
            Paragraph(f"{u_r:,.1f}" if viaje_data.get("fecha_r") else "-", table_cell_center),
            Paragraph(f"{diff:,.1f}" if viaje_data.get("fecha_r") else "-", table_cell_center),
            Paragraph(f"${c_t:,.2f}" if viaje_data.get("fecha_r") else "-", table_cell_num)
        ])

    # Fila de totales si ya retornó
    if viaje_data.get("fecha_r"):
        table_rows.append([
            Paragraph("<b>TOTAL LIQUIDADO</b>", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph(f"<b>${total_liquidado:,.2f}</b>", table_cell_num)
        ])

    items_table = Table(table_rows, colWidths=[65, 140, 90, 60, 45, 45, 40, 55])

    items_table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_DARK_NAVY)),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]

    if viaje_data.get("fecha_r"):
        items_table_style.append(("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")))
        items_table_style.append(("SPAN", (0, -1), (6, -1)))

    items_table.setStyle(TableStyle(items_table_style))
    story.append(items_table)
    story.append(Spacer(1, 16))

    # 4. BLOQUE DE FIRMAS DIGITALES ESTAMPADAS
    firma_s_path = _resolve_signature_path(viaje_data.get("firma_s", ""))
    firma_r_path = _resolve_signature_path(viaje_data.get("firma_r", ""))

    def create_sig_cell(title: str, user_name: str, fecha_val: str, img_path: Optional[str]):
        content = [
            Paragraph(f"<b>{title}</b>", meta_label_style),
            Spacer(1, 4),
            Paragraph(f"Responsable: {user_name or 'No registrado'}", meta_val_style),
            Paragraph(f"Fecha: {fecha_val or '-'}", meta_val_style),
            Spacer(1, 6)
        ]
        if img_path and os.path.exists(img_path):
            try:
                # Mantener proporción adecuada para la firma
                content.append(RLImage(img_path, width=2.0 * inch, height=0.75 * inch))
            except Exception as e:
                logger.warning(f"No se pudo incrustar imagen de firma {img_path}: {e}")
                content.append(Paragraph("<i>[Firma Digital Registrada]</i>", meta_val_style))
        else:
            content.append(Spacer(1, 35))
            content.append(HRFlowable(width="80%", thickness=0.5, color=colors.HexColor(COLOR_CORPORATE_GRAY), spaceAfter=4))
            content.append(Paragraph("<i>Pendiente / Sin firma gráfica</i>", meta_val_style))
        return content

    col_salida = create_sig_cell("FIRMA DE RETIRO (SALIDA)", viaje_data.get("user_s", ""), str(viaje_data.get("fecha_s") or ""), firma_s_path)
    col_retorno = create_sig_cell("FIRMA DE RECEPCIÓN (RETORNO)", viaje_data.get("user_r", ""), str(viaje_data.get("fecha_r") or ""), firma_r_path)

    sig_table = Table([[col_salida, col_retorno]], colWidths=[265, 275])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(COLOR_CORPORATE_GRAY)),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))

    story.append(KeepTogether([sig_table]))
    story.append(Spacer(1, 14))

    # 5. PIE DE PÁGINA
    footer_text = f"Documento generado el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Ingeap S.A. Control de Operaciones y Movilidad."
    story.append(Paragraph(footer_text, subtitle_style))

    # Construir documento
    doc.build(story)
    logger.info(f"PDF generado exitosamente en {output_path}")
    return str(output_path)
