import os
import sys
import base64
from pathlib import Path
from PIL import Image, ImageDraw

# Crear imagen base64 de prueba simulando firma
def generate_sample_signature_b64() -> str:
    img = Image.new("RGBA", (300, 100), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    # Dibujar trazo simulando firma
    draw.line([(20, 60), (60, 20), (100, 80), (140, 30), (200, 70), (280, 40)], fill="#cc3333", width=3)
    draw.text((20, 80), "Firma Test", fill="#999999")
    
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

def run_tests():
    print("=== INICIANDO PRUEBAS DE BACKEND ===")
    from backend.database import init_db, get_viaje_by_id_local, get_viajes_activos_local
    from backend.google_service import google_service
    from backend.pdf_service import generate_remito_pdf

    # 1. Base de datos
    print("1. Inicializando SQLite local...")
    init_db()

    # 2. Registrar Salida de prueba
    print("2. Probando registro de salida...")
    sig_b64 = generate_sample_signature_b64()
    firma_url, local_path = google_service.upload_signature(sig_b64, filename_prefix="test_salida")
    print(f"   Firma guardada en: {firma_url} (Local: {local_path})")

    id_viaje = "test-viaje-uuid-12345"
    proyectos = [
        {"id_proyecto": "PROJ-01", "denominacion": "Proyecto Minera Los Pelambres"},
        {"id_proyecto": "PROJ-02", "denominacion": "Proyecto Central Hidroeléctrica"}
    ]
    items = [
        {"categoria": "Movilidad", "nombre": "Camioneta Hilux 4x4", "codigo_interno": "MOV-01", "unidad_s": 120500.0, "costo_u": 0.45},
        {"categoria": "Instrumental", "nombre": "Multímetro Fluke 87V", "codigo_interno": "INS-14", "unidad_s": 1.0, "costo_u": 15.0}
    ]

    filas = google_service.registrar_salida(
        id_viaje=id_viaje,
        proyectos=proyectos,
        items=items,
        user_s="Ing. Carlos Mendoza",
        firma_s=firma_url,
        fecha_s="2026-09-17 08:30:00"
    )
    print(f"   Filas generadas: {len(filas)} (esperadas 4: 2 ítems x 2 proyectos)")
    assert len(filas) == 4, f"Se esperaban 4 filas, se obtuvieron {len(filas)}"

    # 3. Consultar viajes activos
    print("3. Comprobando viajes activos...")
    activos = google_service.get_viajes_activos()
    print(f"   Viajes activos encontrados: {len(activos)}")
    assert any(v["id_viaje"] == id_viaje for v in activos), "El viaje de prueba no aparece en activos"

    # 4. Probar Retorno con Prorrateo Porcentual (60% / 40%)
    print("4. Probando registro de retorno y prorrateo (60% / 40%)...")
    sig_retorno_b64 = generate_sample_signature_b64()
    firma_r_url, _ = google_service.upload_signature(sig_retorno_b64, filename_prefix="test_retorno")

    items_retorno = [
        {"elemento": "[MOV-01] Camioneta Hilux 4x4", "unidad_r": 120850.0}, # +350 km
        {"elemento": "[INS-14] Multímetro Fluke 87V", "unidad_r": 3.0}       # +2 días/usos
    ]
    prorrateos = [
        {"id_proyecto": "PROJ-01", "porcentaje": 60.0},
        {"id_proyecto": "PROJ-02", "porcentaje": 40.0}
    ]

    filas_ret = google_service.registrar_retorno(
        id_viaje=id_viaje,
        items_retorno=items_retorno,
        prorrateos=prorrateos,
        user_r="Lic. Ana García",
        firma_r=firma_r_url,
        fecha_r="2026-09-17 17:45:00"
    )
    print(f"   Filas actualizadas en retorno: {len(filas_ret)}")

    # 5. Generar PDF con ReportLab
    print("5. Probando compilación de Remito en PDF con firmas estampadas...")
    viaje_final = get_viaje_by_id_local(id_viaje)
    pdf_path = generate_remito_pdf(viaje_final)
    print(f"   PDF generado con éxito en: {pdf_path}")
    assert os.path.exists(pdf_path), "El archivo PDF no fue generado"
    assert os.path.getsize(pdf_path) > 1000, "El archivo PDF parece estar vacío o corrupto"

    print("=== TODAS LAS PRUEBAS DE BACKEND PASARON CON ÉXITO ===")

if __name__ == "__main__":
    run_tests()
