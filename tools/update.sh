#!/usr/bin/env bash
# Обновить сайт из свежей сборки игры.
# Использование: bash tools/update.sh [папка_с_игрой]   (по умолчанию /mnt/project-files/1993-game)
# Потом: git add -A && git commit -m "Сборка X.YY" && git push
set -euo pipefail
SRC="${1:-/mnt/project-files/1993-game}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="https://ptrls.github.io/1993/"
TITLE="1993"
DESC="Пошаговая пиксельная игра про осень 1993 года. Вы — Верховный Совет: удержите Белый дом. Играется прямо в браузере."

rm -rf "$ROOT/css" "$ROOT/js"
cp -r "$SRC/css" "$SRC/js" "$ROOT/"
cp "$SRC/SOURCES.md" "$ROOT/SOURCES.md"
# музыка (чужой трек) в публичную версию не идёт: папку music не копируем, тег убираем
python3 - "$SRC/index.html" "$ROOT/index.html" "$URL" "$TITLE" "$DESC" <<'PY'
import sys,re,html
src,dst,url,title,desc=sys.argv[1:]
s=open(src,encoding='utf-8').read()
s=re.sub(r'\s*<script src="music/music\.js"[^>]*></script>','',s)
d=html.escape(desc,quote=True)
meta=f'''
<meta name="description" content="{d}">
<meta name="theme-color" content="#07070a">
<meta name="author" content="Лосев Пётр">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{url}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content="@peterloss">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{url}og.png">
<meta name="twitter:image:alt" content="Пиксельный Белый дом в огне, баррикады на набережной">'''
s=re.sub(r'\s*<meta (name="description"|name="theme-color"|property="og:|name="twitter:|name="author")[^>]*>','',s)
s=s.replace('<title>',meta.lstrip('\n')+'\n<title>',1) if '<title>' in s else s
open(dst,'w',encoding='utf-8').write(s)
PY
test ! -e "$ROOT/music" || rm -rf "$ROOT/music"
grep -q "MUSIC_B64=" -r "$ROOT/js" && { echo "ОШИБКА: в js нашлась музыка"; exit 1; } || true
for f in "$ROOT"/js/*.js; do node --check "$f" || { echo "ОШИБКА: синтаксис в $f (сборка недописана?)"; exit 1; }; done
V=$(grep -o "VERSION='[^']*'" "$ROOT/js/data.js" | head -1)
echo "Готово: $V. Теперь: git add -A && git commit -m 'Сборка' && git push"
