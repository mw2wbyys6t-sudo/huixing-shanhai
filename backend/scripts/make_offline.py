# -*- coding: utf-8 -*-
"""
离线便携包构建：把 Next.js 静态导出（out/）处理成 file:// 双击可用的离线站点
1. 复制 out/ → 完成作品/
2. HTML 内绝对路径（/_next、/icons、/textures）改写为相对路径；站内链接改写为 xxx.html
3. JS chunk 的 publicPath 修补为页面相对；CSS 内资源路径改写
4. 嵌套目录复制 _next 资源副本（二级页面的 chunk 相对加载）
5. 打包为 完成作品.zip
"""
import re
import shutil
import zipfile
from pathlib import Path

FRONT_OUT = Path(__file__).resolve().parent.parent.parent / "frontend" / "out"
PKG = Path(r"C:\Users\admin\Desktop\计算机比赛") / "完成作品"
ZIP_PATH = Path(r"C:\Users\admin\Desktop\计算机比赛") / "完成作品.zip"

TEMPLATE_HINTS = ["主题展厅", "游客中心→常设", "具有代表性的", "待管理方确认", "待核实"]


def html_files(root: Path):
    return sorted(root.rglob("*.html"))


def rel_prefix(file: Path, root: Path) -> str:
    depth = len(file.parent.relative_to(root).parts)
    return "./" if depth == 0 else "../" * depth


def rel_link(file: Path, root: Path, target: Path) -> str:
    import os
    return os.path.relpath(target, file.parent).replace(os.sep, "/")


def main():
    if not FRONT_OUT.exists():
        print("未找到 out/，请先 npm run build")
        sys.exit(1)
    if PKG.exists():
        shutil.rmtree(PKG)
    shutil.copytree(FRONT_OUT, PKG)
    print("已复制静态导出 →", PKG)

    # 路由映射：/explore → explore.html 等
    route_map = {}
    for f in html_files(PKG):
        rel = f.relative_to(PKG).as_posix()
        if rel.endswith("index.html"):
            route = "/" + rel[: -len("index.html")]
            route = route.rstrip("/") or "/"
        else:
            route = "/" + rel[: -len(".html")]
        route_map[route] = rel

    # 1) HTML 改写
    n_files = 0
    for f in html_files(PKG):
        rel = rel_prefix(f, PKG)
        text = f.read_text(encoding="utf-8", errors="ignore")
        orig = text

        text = text.replace('"/_next/', f'"{rel}_next/')
        text = text.replace("'/_next/", f"'{rel}_next/")
        text = text.replace('"/icons/', f'"{rel}icons/')
        text = text.replace('"/textures/', f'"{rel}textures/')
        text = text.replace('"/logo', f'"{rel}logo')
        text = text.replace('"/favicon', f'"{rel}favicon')

        def link_sub(m):
            route, query = m.group(1), m.group(2) or ""
            target = route_map.get(route) or route_map.get(route.rstrip("/"))
            if target is None:
                return m.group(0)
            return f'href="{rel_link(f, PKG, PKG / target)}{query}"'

        text = re.sub(r'href="(/[a-zA-Z0-9\-/]+)(\?[^"]*)?"', link_sub, text)

        if text != orig:
            f.write_text(text, encoding="utf-8")
            n_files += 1
    print(f"HTML 改写: {n_files} 个文件")

    # 2) JS chunk publicPath 修补：'/_next/' → '_next/'（页面相对）
    n_js = 0
    for js in (PKG / "_next").rglob("*.js"):
        text = js.read_text(encoding="utf-8", errors="ignore")
        if "/_next/" in text:
            patched = text.replace('"/_next/', '"_next/').replace("'/_next/", "'_next/")
            if patched != text:
                js.write_text(patched, encoding="utf-8")
                n_js += 1
    print(f"JS publicPath 修补: {n_js} 个文件")

    # 3) CSS 资源路径修补
    n_css = 0
    for css in (PKG / "_next").rglob("*.css"):
        text = css.read_text(encoding="utf-8", errors="ignore")
        if "/_next/" in text:
            css.write_text(text.replace("/_next/", "../"), encoding="utf-8")
            n_css += 1
    print(f"CSS 修补: {n_css} 个文件")

    # 4) 嵌套目录复制 _next 副本
    dirs_with_html = {f.parent for f in html_files(PKG) if len(f.parent.relative_to(PKG).parts) >= 2}
    for d in sorted(dirs_with_html):
        dst = d / "_next"
        if not dst.exists():
            shutil.copytree(PKG / "_next", dst)
            print("  资源副本 →", d.relative_to(PKG).as_posix())

    # 5) 打包
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in sorted(PKG.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(PKG))
    size = ZIP_PATH.stat().st_size
    print(f"✓ 完成作品.zip 已生成: {size/1024/1024:.1f} MB → {ZIP_PATH}")


import sys  # noqa: E402

if __name__ == "__main__":
    main()
