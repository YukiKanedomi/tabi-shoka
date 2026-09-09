# 写真の下ごしらえ: private/photos/<tripId>/ の画像を、EXIF（位置情報など）を落として
# 長辺 1600px の本体と 480px のサムネにして private/photos_out/<tripId>/ に書き出す。
#   python tools/prep-photos.py            … 全旅
#   python tools/prep-photos.py 2026-10-nara
# 出力は build-data.mjs が暗号化して data/img/ に置く。
# index.json には撮影日時と撮影位置（EXIF から）も書く。これは private/ に留まり公開されない。
# build-data.mjs が「どの日のどの行の写真か」を自動で決めるのに使う。
import io, os, sys, json, hashlib
from PIL import Image, ImageOps
from PIL.ExifTags import Base as ExifTag, GPS as GpsTag

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'private', 'photos')
OUT = os.path.join(ROOT, 'private', 'photos_out')
only = sys.argv[1] if len(sys.argv) > 1 else None

# HEIC は pillow-heif があれば読める（無ければ skip される）
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    pass

def dms(v, ref):
    try:
        d = float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
        return -d if ref in ('S', 'W') else d
    except Exception:
        return None

def meta_of(im):
    """撮影日時 'YYYY-MM-DDTHH:MM' と位置 (lat, lng) を EXIF から。無ければ None"""
    taken = lat = lng = None
    try:
        ex = im.getexif()
        exif = ex.get_ifd(0x8769)  # Exif IFD
        dt = exif.get(ExifTag.DateTimeOriginal) or exif.get(ExifTag.DateTimeDigitized) or ex.get(ExifTag.DateTime)
        if dt and len(dt) >= 16:
            taken = dt[0:4] + '-' + dt[5:7] + '-' + dt[8:10] + 'T' + dt[11:16]
        gps = ex.get_ifd(0x8825)
        if gps and GpsTag.GPSLatitude in gps and GpsTag.GPSLongitude in gps:
            lat = dms(gps[GpsTag.GPSLatitude], gps.get(GpsTag.GPSLatitudeRef, 'N'))
            lng = dms(gps[GpsTag.GPSLongitude], gps.get(GpsTag.GPSLongitudeRef, 'E'))
    except Exception:
        pass
    return taken, lat, lng

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
        taken, lat, lng = meta_of(im)
        if not taken:  # EXIF が無ければファイルの更新時刻で代用（書き出し時に印を付ける）
            import datetime
            taken = datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%dT%H:%M'); taken_src = 'mtime'
        else:
            taken_src = 'exif'
        im = ImageOps.exif_transpose(im)  # 向きだけ反映してから EXIF を捨てる
        im = im.convert('RGB')
        w, h = im.size
        pid = hashlib.sha1(name.encode('utf-8')).hexdigest()[:10]
        for tag, size in [('full', 1600), ('thumb', 480)]:
            s = min(1.0, size / max(w, h))
            r = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
            r.save(os.path.join(odir, f'{pid}-{tag}.jpg'), quality=82 if tag == 'full' else 78, optimize=True)  # exif は付けない
        rec = {'id': pid, 'file': name, 'w': w, 'h': h, 'taken': taken, 'takenSrc': taken_src}
        if lat is not None and lng is not None: rec['lat'] = round(lat, 5); rec['lng'] = round(lng, 5)
        index.append(rec)
        print(f'  {name} -> {pid} ({w}x{h}) {taken}{"" if taken_src == "exif" else "(mtime)"}{" gps" if lat is not None else ""}')
    index.sort(key=lambda x: x['taken'])
    io.open(os.path.join(odir, 'index.json'), 'w', encoding='utf-8').write(json.dumps(index, ensure_ascii=False, indent=2))
    return index

if not os.path.isdir(SRC): print('private/photos がありません'); sys.exit(0)
for trip in sorted(os.listdir(SRC)):
    if only and trip != only: continue
    if os.path.isdir(os.path.join(SRC, trip)):
        print(trip); process(trip)
