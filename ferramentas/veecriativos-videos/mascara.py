# Recorte da pessoa (pro texto ficar ATRAS da Vee) no estilo-gp.mjs.
# Uso: python mascara.py <pasta_quadros_png> <pasta_mascaras>  (mesmo nome de arquivo, PNG em tons de cinza)
import os, sys
from PIL import Image, ImageFilter
from rembg import new_session, remove

ent, sai = sys.argv[1], sys.argv[2]
os.makedirs(sai, exist_ok=True)
sessao = new_session("u2net_human_seg")
arqs = sorted(f for f in os.listdir(ent) if f.endswith(".png"))
for i, f in enumerate(arqs):
    m = remove(Image.open(os.path.join(ent, f)).convert("RGB"), session=sessao, only_mask=True)
    # o canvas recorta pelo ALFA (destination-in): a mascara vira o canal alfa de uma imagem branca
    out = Image.new("RGBA", m.size, (255, 255, 255, 255))
    out.putalpha(m.filter(ImageFilter.GaussianBlur(1.2)))
    out.save(os.path.join(sai, f))
    if i % 50 == 0:
        print(f"mascara {i + 1}/{len(arqs)}", flush=True)
