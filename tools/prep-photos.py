# 写真の下ごしらえ: private/photos/<tripId>/ の画像を、EXIF（位置情報など）を落として
# 長辺 1600px の本体と 480px のサムネにして private/photos_out/<tripId>/ に書き出す。
#   python tools/prep-photos.py            … 全旅
#   python tools/prep-photos.py 2026-10-nara
# 出力は build-data.mjs が暗号化して data/img/ に置く。
import io, os, sys, json, hashlib
from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'private', 'photos')
OUT = os.path.join(ROOT, 'private', 'photos_out')
only = sys.argv[1] if len(sys.argv) > 1 else None

def process(trip):
    sdir = os.path.join(SRC, trip); odir = os.path.join(OUT, trip)
    os.makedirs(odir, exist_ok=True)
    index = []
    for name in sorted(os.listdir(sdir)):
        if not name.lower().endswith(('.jpg', '.jpeg', '.png', '.heic', '.webp')): continue
        path = os.path.join(sdir, name)
        try:
            im = Image.open(path)
        except Exception as e:
            print('  skip', name, e); continue
        im = ImageOps.exif_transpose(im)  # 向きだけ反映してから EXIF を捨てる
        im = im.convert('RGB')
        w, h = im.size
        pid = hashlib.sha1(name.encode('utf-8')).hexdigest()[:10]
        for tag, size in [('full', 1600), ('thumb', 480)]:
            s = min(1.0, size / max(w, h))
            r = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
            r.save(os.path.join(odir, f'{pid}-{tag}.jpg'), quality=82 if tag == 'full' else 78, optimize=True)  # exif は付けない
        index.append({'id': pid, 'file': name, 'w': w, 'h': h})
        print(f'  {name} -> {pid} ({w}x{h})')
    io.open(os.path.join(odir, 'index.json'), 'w', encoding='utf-8').write(json.dumps(index, ensure_ascii=False, indent=2))
    return index

if not os.path.isdir(SRC): print('private/photos がありません'); sys.exit(0)
for trip in sorted(os.listdir(SRC)):
    if only and trip != only: continue
    if os.path.isdir(os.path.join(SRC, trip)):
        print(trip); process(trip)
