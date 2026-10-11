"""Собирает сайт в один HTML-файл (стили, скрипты и картинки внутри).

Запуск:  python3 tools/build_single.py OUT.html [--fragment]
--fragment — без <!doctype>/<html>/<head>/<body> (для публикации как Artifact).
"""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1])
fragment = "--fragment" in sys.argv

html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "assets/style.css").read_text(encoding="utf-8")
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
js = "\n".join((root / s).read_text(encoding="utf-8") for s in scripts)

def to_data_uri(m):
    p = root / m.group(1)
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
js = re.sub(r'(assets/img/[\w.-]+\.png)', to_data_uri, js)

title = re.search(r"<title>.*?</title>", html).group(0)
fonts = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', html).group(0)
body = re.search(r"<body>(.*?)<script", html, re.S).group(1).strip()
js = js.replace("</script", "<\\/script")

head = f"{title}\n{fonts}\n<style>\n{css}\n</style>"
page = f"{body}\n<script>\n{js}\n</script>"
if fragment:
    result = f"{head}\n{page}\n"
else:
    result = (f'<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
              f'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              f"{head}\n</head>\n<body>\n{page}\n</body>\n</html>\n")
out.write_text(result, encoding="utf-8")
print(out, f"{len(result) / 1024:.0f} KB")
