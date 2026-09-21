import os
from PIL import Image, ImageDraw, ImageFont

def crear_icono_inventario(size=512):
    scale = 2
    dim = size * scale
    img = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = 32 * scale
    radius = 64 * scale

    red_corp = (200, 30, 43, 255)       # #c81e2b
    white = (255, 255, 255, 255)

    # 1. Base cuadrada redondeada roja corporativa
    draw.rounded_rectangle(
        [pad, pad, dim - pad, dim - pad],
        radius=radius,
        fill=red_corp
    )

    # 2. Dibujar silueta de caja / inventario estilizada en blanco
    cx = dim // 2
    cy = dim // 2
    box_w = 180 * scale
    box_h = 160 * scale

    # Caja central
    draw.rounded_rectangle(
        [cx - box_w, cy - box_h // 2, cx + box_w, cy + box_h // 2],
        radius=20 * scale,
        outline=white,
        width=24 * scale
    )

    # Cinta vertical de la caja
    draw.rectangle(
        [cx - 24 * scale, cy - box_h // 2, cx + 24 * scale, cy + box_h // 2],
        fill=white
    )

    # Tapa superior
    draw.line(
        [(cx - box_w - 20 * scale, cy - box_h // 2), (cx + box_w + 20 * scale, cy - box_h // 2)],
        fill=white,
        width=24 * scale
    )

    # Letra "I" de Ingeap en el centro
    # Círculo blanco central superior
    draw.ellipse(
        [cx - 36 * scale, cy - 36 * scale, cx + 36 * scale, cy + 36 * scale],
        fill=red_corp,
        outline=white,
        width=12 * scale
    )

    return img.resize((size, size), Image.Resampling.LANCZOS)

def generar_ico():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ruta_assets = os.path.join(base_dir, "assets")
    os.makedirs(ruta_assets, exist_ok=True)

    img = crear_icono_inventario(512)
    ruta_png = os.path.join(ruta_assets, "icon.png")
    ruta_ico = os.path.join(ruta_assets, "app.ico")
    ruta_ico2 = os.path.join(ruta_assets, "icon.ico")

    img.save(ruta_png)
    tamanos = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ruta_ico, format="ICO", sizes=tamanos)
    img.save(ruta_ico2, format="ICO", sizes=tamanos)
    print(f"Iconos generados exitosamente en: {ruta_assets}")

if __name__ == "__main__":
    generar_ico()
