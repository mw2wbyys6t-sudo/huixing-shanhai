# -*- coding: utf-8 -*-
"""
参赛文档同步：把 350 景区 / 游记社区 / 旅游资讯 / 跨城交通 等新内容同步进
设计说明书与作品小结（作品情况表超链接已填，无需改动）
"""
import copy
from pathlib import Path

from docx import Document
from docx.shared import Cm

BASE = Path(r"C:\Users\admin\Desktop\计算机比赛\作品填报")
DESIGN = BASE / "设计说明书——非多媒体类.docx"
SUMMARY = BASE / "作品小结.docx"


def replace_in_paragraphs(doc, pairs):
    """段落级子串替换（保留段落样式，重建首 run）"""
    count = 0
    for par in doc.paragraphs:
        text = par.text
        hit = False
        for old, new in pairs:
            if old in text:
                text = text.replace(old, new)
                hit = True
        if hit:
            for r in list(par.runs)[1:]:
                r._r.getparent().remove(r._r)
            if par.runs:
                par.runs[0].text = text
            else:
                par.add_run(text)
            count += 1
    # 表格内也替换
    for t in doc.tables:
        seen = set()
        for row in t.rows:
            for cell in row.cells:
                if id(cell._tc) in seen:
                    continue
                seen.add(id(cell._tc))
                for par in cell.paragraphs:
                    text = par.text
                    hit = False
                    for old, new in pairs:
                        if old in text:
                            text = text.replace(old, new)
                            hit = True
                    if hit and par.runs:
                        par.runs[0].text = text
                        for r in list(par.runs)[1:]:
                            r._r.getparent().remove(r._r)
                        count += 1
    return count


def insert_par_after(par, text, doc, style_name=None, center=False):
    new = doc.add_paragraph()
    if style_name:
        try:
            new.style = doc.styles[style_name]
        except KeyError:
            pass
    new.add_run(text)
    if center:
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        new.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par._p.addnext(new._p)
    return new


def fill_cell(cell, text):
    if cell.paragraphs and cell.paragraphs[0].runs:
        cell.paragraphs[0].runs[0].text = text
        for r in list(cell.paragraphs[0].runs)[1:]:
            r._r.getparent().remove(r._r)
    else:
        cell.paragraphs[0].add_run(text)


# ============================================================
# 一、设计说明书
# ============================================================
def update_design():
    doc = Document(str(DESIGN))
    pairs = [
        ("92 个国内外精选景区的结构化信息库", "350 个国内外精品景区的结构化信息库（覆盖全国 31 个省区市的 5A 精品与世界五大洲知名景区）"),
        ("92 个国内外景区的结构化数据库（每条含 260-390 字详细描述", "350 个国内外景区的结构化数据库（每条含 80-390 字详细描述"),
        ("建成 92 个国内外景区的结构化数据库", "建成 350 个国内外景区的结构化数据库"),
        ("92 个景区覆盖国内全部省份的 5A 精品与世界五大洲的知名景区", "350 个景区覆盖国内全部省份的 5A 精品与世界五大洲的知名景区，317 家 5A 与 21 处世界遗产"),
        ("92 个景区详情页在构建期预渲染", "350 个景区详情页在构建期预渲染"),
        ("（1）表现层（frontend/）：九个页面模块（首页、3D 地球、探索发现、景区详情、智能规划、AI 助手、避雷指南、登录注册、关于我们/隐私条款）",
         "（1）表现层（frontend/）：十一个页面模块（首页、3D 地球、探索发现、景区详情、智能规划、AI 助手、避雷指南、游记社区、旅游资讯、登录注册、关于我们/隐私条款）"),
        ("main.py 组织约 25 个 REST/SSE 端点", "main.py 组织约 30 个 REST/SSE 端点"),
        ("（3）数据层：models/ 定义五张 ORM 数据表", "（3）数据层：models/ 定义七张 ORM 数据表（含游记与游记评论表）"),
        ("数据库存储用户、评价、实拍、工作流日志与用户偏好五张表", "数据库存储用户、评价、实拍、工作流日志、用户偏好、游记与游记评论七张表"),
        ("系统使用 SQLite 3 关系数据库（经 SQLAlchemy 2.0 ORM 访问），共五张数据表：users（用户表）、reviews（评价表）、ugc_photos（用户实拍表）、workflow_logs（规划工作流日志表）、user_prefs（用户偏好表）。",
         "系统使用 SQLite 3 关系数据库（经 SQLAlchemy 2.0 ORM 访问），共七张数据表：users（用户表）、reviews（评价表）、ugc_photos（用户实拍表）、workflow_logs（规划工作流日志表）、user_prefs（用户偏好表）、travel_notes（游记表）、note_comments（游记评论表）。其中 users 与 reviews、ugc_photos 通过外键 user_id 构成一对多关系，travel_notes 与 note_comments 通过外键 note_id 构成一对多关系。"),
        ("data/scenic_spots.json：景区数据库（92 条记录）", "data/scenic_spots.json：景区数据库（350 条记录）"),
        ("data/avoid_analysis.json：批量避雷分析结果（92 条）", "data/avoid_analysis.json：AI 批量避雷分析结果（60 条），接口层动态合并景区内置避雷数据覆盖全部 350 个景区"),
        ("49 项后端冒烟测试与 30 项全链路连通性检查全部通过，TypeScript 全量类型检查零错误",
         "55 项后端冒烟测试与 30 项全链路连通性检查全部通过，TypeScript 全量类型检查零错误"),
        ("49 项后端冒烟测试与 30 项全链路连通性检查全部通过，TypeScript 全量类型检查零错误，附带一键部署配置",
         "55 项后端冒烟测试与 30 项全链路连通性检查全部通过，TypeScript 全量类型检查零错误，附带 GitHub Pages 与 Render 双平台一键部署配置"),
    ]

    pairs += [
        ("朱新可负责数据建设与质量保障，包括 92 个景区数据库的采集整理", "朱新可负责数据建设与质量保障，包括 350 个景区数据库的采集整理"),
        ("8 月完成前端九大页面开发、AI 能力接入（规划工作流、避雷分析、AI 助手）、景区库扩充至 92 个（新增 32 个国际景区）",
         "8 月完成前端页面开发、AI 能力接入（规划工作流、避雷分析、AI 助手）、景区库扩充至 92 个（新增 32 个国际景区）；9 月进一步扩充至 350 个（新增 258 家国内 5A）并上线游记社区与旅游资讯，"),
        ("92 个景区按真实经纬度标注", "350 个景区按真实经纬度标注"),
        ("批量离线脚本一次性预生成 92 个景区的指数供列表页使用", "批量离线脚本预生成头部景区指数，接口层动态合并景区内置避雷数据覆盖全部 350 个景区"),
        ("将 92 个景区名按长度降序构建匹配序列", "将 350 个景区名按长度降序构建匹配序列"),
    ]
    # 兜底：剩余段落的 "92 个" 一律替换为 "350 个"（保留历史表述"扩充至 92 个"）
    n = 0
    for par in doc.paragraphs:
        if "92 个" in par.text and "扩充至 92 个" not in par.text and "60 个国内 5A 景区起步" not in par.text:
            text = par.text.replace("92 个", "350 个")
            for r in list(par.runs)[1:]:
                r._r.getparent().remove(r._r)
            if par.runs:
                par.runs[0].text = text
            else:
                par.add_run(text)
            n += 1
    n = replace_in_paragraphs(doc, pairs)
    print(f"设计说明书 段落替换 {n} 处")

    # 功能说明：追加（四）内容社区层
    for par in doc.paragraphs:
        if par.text.strip().startswith("（三）用户与社区层。"):
            insert_par_after(par,
                "（四）内容与资讯层。游记社区：发布游记与攻略（标题/类型/正文/关联景区联想），列表按类型与热度筛选，详情页支持点赞与评论互动；"
                "旅游资讯：实时聚合热门目的地实时天气（高德数据）、最新社区内容、最新评价与高风险避雷提醒，10 分钟缓存自动更新。社区请求经 authFetch 自动携带登录态，"
                "发布与评论接口实施限流保护。", doc)
            break

    # 主要功能页面：追加两页
    for par in doc.paragraphs:
        if par.text.strip().startswith("避雷指南（/avoid）："):
            anchor = par
            anchor = insert_par_after(anchor, "游记社区（/community）：UGC 内容社区，支持游记与攻略的发布、浏览、点赞与评论，发布页支持关联景区联想，是平台 UGC 生态的内容生产端。", doc, style_name="Normal Indent")
            anchor = insert_par_after(anchor, "旅游资讯（/news）：实时聚合页，按「天气动态 / 社区热文 / 最新评价 / 避雷提醒」四类分组展示平台实时数据，一键刷新。", doc, style_name="Normal Indent")
            break

    # 关键功能/算法设计：补 资讯聚合 与 社区
    for par in doc.paragraphs:
        if par.text.strip().startswith("4. 景区名自动链接算法。"):
            anchor = par
            anchor = insert_par_after(anchor,
                "5. 跨城交通方案生成。行程规划提示词强制要求输出独立的跨城交通方案段：给出出发城市至目的地的高铁/航班/大巴参考时长与票价（用户未说明出发地时按北京、上海、广州、成都四个枢纽城市分别简述），并附目的地市内交通接驳建议，使行程规划从「落地之后」前移到「如何抵达」。",
                doc, style_name="Normal Indent")
            anchor = insert_par_after(anchor,
                "6. 实时资讯聚合。/api/news 端点将热门目的地实时天气（高德数据，串行调用规避 QPS 限制）、最新社区内容、最新评价与高风险避雷提醒聚合为统一资讯流，10 分钟缓存兼顾实时性与上游配额。",
                doc, style_name="Normal Indent")
            break

    # 数据字典：追加 表6 travel_notes、表7 note_comments
    t5 = None
    for t in doc.tables:
        if "user_prefs" in t.rows[0].cells[0].text:
            t5 = t
            break
    if t5 is not None:
        anchor_el = t5._tbl
        extra = [
            ("表6 travel_notes（游记表）数据字典", [
                ("字段名称", "字段描述", "数据类型", "长度", "是否允许空", "缺省值", "备注"),
                ("id", "游记ID", "INTEGER", "-", "N", "自增", "主键"),
                ("title", "标题", "varchar", "100", "N", "NULL", ""),
                ("content", "正文", "text", "-", "N", "NULL", ""),
                ("type", "类型", "varchar", "10", "N", "游记", "游记/攻略"),
                ("spot_id", "关联景区", "varchar", "50", "Y", "NULL", "索引"),
                ("spot_name", "景区名称", "varchar", "100", "Y", "NULL", ""),
                ("user_id", "作者用户ID", "INTEGER", "-", "Y", "NULL", "登录发布时记录"),
                ("user_name", "作者昵称", "varchar", "50", "N", "NULL", ""),
                ("views", "阅读量", "INTEGER", "-", "N", "0", ""),
                ("likes", "点赞数", "INTEGER", "-", "N", "0", ""),
                ("created_at", "发布时间", "datetime", "-", "N", "当前时间", ""),
            ]),
            ("表7 note_comments（游记评论表）数据字典", [
                ("字段名称", "字段描述", "数据类型", "长度", "是否允许空", "缺省值", "备注"),
                ("id", "评论ID", "INTEGER", "-", "N", "自增", "主键"),
                ("note_id", "游记ID", "INTEGER", "-", "N", "NULL", "索引，外键 travel_notes.id"),
                ("user_id", "评论者用户ID", "INTEGER", "-", "Y", "NULL", ""),
                ("user_name", "评论者昵称", "varchar", "50", "N", "NULL", ""),
                ("content", "评论内容", "varchar", "500", "N", "NULL", ""),
                ("created_at", "评论时间", "datetime", "-", "N", "当前时间", ""),
            ]),
        ]
        for title, rows in extra:
            cap = doc.add_paragraph()
            try:
                cap.style = doc.styles["Normal Indent"]
            except KeyError:
                pass
            cap.add_run(title)
            anchor_el.addnext(cap._p)
            tbl = doc.add_table(rows=len(rows), cols=7)
            try:
                tbl.style = t5.style
            except Exception:
                pass
            for ri, row_data in enumerate(rows):
                for ci, val in enumerate(row_data):
                    fill_cell(tbl.rows[ri].cells[ci], val)
            cap._p.addnext(tbl._tbl)
            anchor_el = tbl._tbl
        print("数据字典 表6/表7 已追加")

    # 接口清单：补社区与资讯端点
    for par in doc.paragraphs:
        if par.text.strip().startswith("社区域："):
            insert_par_after(par,
                "内容社区域：POST /api/notes/submit（发布游记/攻略，限流 10 次/小时）、GET /api/notes（列表，支持类型/景区筛选与排序分页）、GET /api/notes/{id}（详情，阅读量自增）、POST /api/notes/{id}/like（点赞）、POST /api/notes/{id}/comments 与 GET /api/notes/{id}/comments（评论）；资讯域：GET /api/news（实时聚合热门目的地天气、社区动态、评价与避雷提醒，10 分钟缓存）。",
                doc, style_name="Normal Indent")
            break

    # 存储数据 intro 段的「五张表」已在替换对里处理；接口说明补 news 已在社区域后追加
    doc.save(str(DESIGN))
    print("设计说明书 ✓")


# ============================================================
# 二、作品小结
# ============================================================
def update_summary():
    doc = Document(str(SUMMARY))
    pairs = [
        ("平台建成了覆盖国内外的 92 个景区结构化数据库（详细描述、避雷指数、真实图片与标注来源的宣传视频）",
         "平台建成了覆盖国内外 31 个省区市与五大洲的 350 个景区结构化数据库（详细介绍、避雷指数、Commons 真实图片与标注来源的宣传视频）"),
        ("智能规划引擎基于 LangGraph 多智能体工作流，经「意图解析→天气分析→景点推荐→预算规划→质量评估」五阶段并支持多轮反思，产出含逐日行程与预算明细的高质量方案；",
         "智能规划引擎基于 LangGraph 多智能体工作流，经「意图解析→天气分析→景点推荐→预算规划→质量评估」五阶段并支持多轮反思，输出含跨城交通方案、逐日行程与预算明细的高质量方案；"),
        ("同时提供 3D 地球导览、景区周边美食（高德实时 POI）、SSE 流式 AI 助手、全景环视与收藏足迹云同步等功能。",
         "同时提供 3D 地球导览、景区周边美食（高德实时 POI）、游记攻略社区（发布/评论/点赞）、实时聚合旅游资讯、SSE 流式 AI 助手、全景环视与收藏足迹云同步等功能。"),
        ("系统采用 Next.js + FastAPI 前后端分离架构，配套限流、加密存储等安全工程与 49+30 项自动化测试，质量可靠、开箱即用。",
         "系统采用 Next.js + FastAPI 前后端分离架构，配套限流、加密存储等安全工程与 55+30 项自动化测试，支持 GitHub Pages 与 Render 双平台部署，质量可靠、开箱即用。"),
        ("（1）景区信息库：92 个国内外景区，含 260-390 字详细描述、Commons 真实图片、经纬度与避雷数据；",
         "（1）景区信息库：350 个国内外景区（国内 318 + 国际 32），含 80-390 字详细描述、Commons 真实图片、经纬度与避雷数据；"),
        ("（7）用户社区：注册登录、收藏足迹云同步、UGC 实拍上传、评价与点赞。",
         "（7）用户社区：注册登录、收藏足迹云同步、UGC 实拍上传、评价与点赞；（8）游记攻略社区：发布、列表筛选、点赞与评论互动；（9）实时资讯：聚合热门目的地天气、社区动态、评价与避雷提醒。"),
        ("49 项后端冒烟测试与 30 项全链路连通性检查全部通过，TypeScript 全量类型检查零错误，支持 Render 一键云部署。",
         "55 项后端冒烟测试与 30 项全链路连通性检查全部通过，TypeScript 全量类型检查零错误，支持 GitHub Pages 与 Render 双平台部署。"),
        ("安全设计与自动化测试（49 项冒烟测试、30 项连通性检查全部通过）",
         "安全设计与自动化测试（55 项冒烟测试、30 项连通性检查全部通过）"),
    ]
    pairs += [
        ("图2  3D 地球导览（92 个景区真实坐标标注）", "图2  3D 地球导览（350 个景区真实坐标标注）"),
        ("数据体系覆盖国内外 92 个景区且每条信息均有可靠来源", "数据体系覆盖国内外 350 个景区且每条信息均有可靠来源"),
    ]
    n = 0
    for par in doc.paragraphs:
        text = par.text
        hit = False
        for old, new in pairs:
            if old in text:
                text = text.replace(old, new)
                hit = True
        if hit:
            for r in list(par.runs)[1:]:
                r._r.getparent().remove(r._r)
            if par.runs:
                par.runs[0].text = text
            n += 1
    print(f"作品小结 段落更新 {n} 处")
    doc.save(str(SUMMARY))
    print("作品小结 ✓")


if __name__ == "__main__":
    update_design()
    update_summary()
    print("\n文档同步完成")
