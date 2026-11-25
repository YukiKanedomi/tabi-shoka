# キャラクター素材の下ごしらえ: 透明地の PNG の余白を切り詰め、正方形 240px にそろえて private/chars/01.png… に置く。
#   python tools/prep-chars.py <素材フォルダ>     （e403_icon-0NN-透明_v01.png が入ったフォルダ）
# 絵は再配布できない素材なので、平文は private/ にだけ置く。公開されるのは build-data.mjs が暗号化した束の中身だけ。
import glob, os, re, sys
from PIL import Image

SIZE, MARGIN = 240, 0.04
src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'private', 'chars')
os.makedirs(out, exist_ok=True)
files = sorted(f for f in glob.glob(os.path.join(src, '*.png')) if re.search(r'icon-\d{3}-透明', os.path.basename(f)))
if not files: sys.exit('透明地の PNG が見つかりません: ' + src)
for f in files:
    n = int(re.search(r'icon-(\d{3})', os.path.basename(f)).group(1))
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    side = round(max(im.size) / (1 - MARGIN * 2))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    # 白と黒と透明だけの絵なので、縮小でできた中間色を 16 色に丸めて軽くする
    sq = sq.resize((SIZE, SIZE), Image.LANCZOS).quantize(16, method=Image.FASTOCTREE)
    sq.save(os.path.join(out, f'{n:02d}.png'), optimize=True)
print(f'{len(files)} 体 → private/chars/')
