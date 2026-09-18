import json
import base64
from fastapi.testclient import TestClient
from backend.main_api import app

client = TestClient(app)

def test_api_pipeline():
    print("=== TEST COMPLETO DE ENDPOINTS FASTAPI ===")
    
    # 1. GET /api/estado
    res = client.get("/api/estado")
    print(f"1. GET /api/estado -> {res.status_code}")
    assert res.status_code == 200
    data_estado = res.json()
    print(f"   Estado: {data_estado['estado']}, SQLite: {data_estado['local_db_ok']}")

    # 2. GET /api/catalogos
    res = client.get("/api/catalogos")
    print(f"2. GET /api/catalogos -> {res.status_code}")
    assert res.status_code == 200
    data_cat = res.json()
    print(f"   Origen: {data_cat['origen']}, Categorías: {len(data_cat['categorias'])}")

    # 3. POST /api/viajes/salida
    fake_sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    salida_payload = {
        "proyectos_ids": ["PROJ-ALTO-MAIPO", "PROJ-PELAMBRES"],
        "items": [
            {
                "id": "ITEM-MOV-01",
                "categoria": "Movilidad",
                "codigo_interno": "MOV-01",
                "nombre": "Camioneta Ranger 4x4",
                "numero_serie": "AB123CD",
                "unidad_s": 85400.0,
                "costo_u": 0.50
            },
            {
                "id": "ITEM-INS-02",
                "categoria": "Instrumental",
                "codigo_interno": "INS-02",
                "nombre": "Estación Total Leica",
                "numero_serie": "SN-987654",
                "unidad_s": 1.0,
                "costo_u": 25.0
            }
        ],
        "user_s": "Ing. Roberto Díaz",
        "firma_s_base64": fake_sig,
        "fecha_s": "2026-09-17 09:00:00"
    }
    res = client.post("/api/viajes/salida", json=salida_payload)
    print(f"3. POST /api/viajes/salida -> {res.status_code}")
    assert res.status_code == 200
    salida_data = res.json()
    id_viaje = salida_data["id_viaje"]
    print(f"   Viaje creado con éxito. UUID: {id_viaje}, Filas: {salida_data['filas_registradas']}")

    # 4. GET /api/viajes/activos
    res = client.get("/api/viajes/activos")
    print(f"4. GET /api/viajes/activos -> {res.status_code}")
    assert res.status_code == 200
    activos = res.json()
    print(f"   Viajes activos en lista: {len(activos)}")
    assert any(v["id_viaje"] == id_viaje for v in activos)

    # 5. POST /api/viajes/retorno (Test validación estricta 100%)
    # Primero probamos con suma incorrecta (debe dar 400)
    retorno_invalido = {
        "id_viaje": id_viaje,
        "items": [{"elemento": "[MOV-01] Camioneta Ranger 4x4", "unidad_r": 85700.0}],
        "prorrateo": [
            {"id_proyecto": "PROJ-ALTO-MAIPO", "porcentaje": 40.0},
            {"id_proyecto": "PROJ-PELAMBRES", "porcentaje": 40.0} # Suma 80% != 100%
        ],
        "user_r": "Lic. Marcela Soto",
        "firma_r_base64": fake_sig
    }
    res_bad = client.post("/api/viajes/retorno", json=retorno_invalido)
    print(f"5a. POST /api/viajes/retorno (con 80% incorrecto) -> {res_bad.status_code} (esperado 400)")
    assert res_bad.status_code == 400

    # Ahora probamos con suma exacta 100% (70% / 30%)
    retorno_valido = {
        "id_viaje": id_viaje,
        "items": [
            {"elemento": "[MOV-01] Camioneta Ranger 4x4", "unidad_r": 85700.0}, # +300 km
            {"elemento": "[INS-02] Estación Total Leica", "unidad_r": 4.0}        # +3 días
        ],
        "prorrateo": [
            {"id_proyecto": "PROJ-ALTO-MAIPO", "porcentaje": 70.0},
            {"id_proyecto": "PROJ-PELAMBRES", "porcentaje": 30.0}
        ],
        "user_r": "Lic. Marcela Soto",
        "firma_r_base64": fake_sig,
        "fecha_r": "2026-09-17 18:30:00"
    }
    res_ok = client.post("/api/viajes/retorno", json=retorno_valido)
    print(f"5b. POST /api/viajes/retorno (con 100% exacto) -> {res_ok.status_code}")
    assert res_ok.status_code == 200
    ret_data = res_ok.json()
    print(f"   Retorno liquidado con éxito. Filas actualizadas: {ret_data['filas_actualizadas']}")

    # 6. GET /api/viajes/{id_viaje}/pdf
    res_pdf = client.get(f"/api/viajes/{id_viaje}/pdf")
    print(f"6. GET /api/viajes/{id_viaje}/pdf -> {res_pdf.status_code}")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert len(res_pdf.content) > 1000
    print(f"   Remito PDF generado correctamente: {len(res_pdf.content)} bytes")

    print("\n=== TODOS LOS ENDPOINTS Y REGLAS DE NEGOCIO VERIFICADOS EXITOSAMENTE ===")

if __name__ == "__main__":
    test_api_pipeline()
