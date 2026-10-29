# -*- coding: utf-8 -*-
"""把游戏打包成单文件 HTML（JS/CSS 全部内联），双击即可运行。

用法：python build_single.py
产物：
  docs/index.html      —— 单文件版（推荐直接双击 / 本地服务都用它）
  docs/game.js         —— 同步一份源码，方便调试
"""
import io
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC_HTML = os.path.join(BASE, "v2", "index.html")
SRC_JS = os.path.join(BASE, "v2", "game.js")
OUT_HTML = os.path.join(BASE, "docs", "index.html")
OUT_JS = os.path.join(BASE, "docs", "game.js")

TAG = '<script src="game.js"></script>'


def main():
    html = io.open(SRC_HTML, encoding="utf-8").read()
    js = io.open(SRC_JS, encoding="utf-8").read()

    assert TAG in html, "index.html 里找不到 <script src=\"game.js\">"

    # 防止 JS 里出现 </script> 提前闭合标签
    js_safe = js.replace("</script>", "<\\/script>")
    inline = "<script>\n" + js_safe + "\n</script>"
    out = html.replace(TAG, inline)

    os.makedirs(os.path.dirname(OUT_HTML), exist_ok=True)
    io.open(OUT_HTML, "w", encoding="utf-8").write(out)
    io.open(OUT_JS, "w", encoding="utf-8").write(js)

    print("built:", OUT_HTML, "%.1f KB" % (len(out.encode("utf-8")) / 1024))


if __name__ == "__main__":
    main()
