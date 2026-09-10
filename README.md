# 慧行山海 — 基于 AI 与电子地图的一站式旅游规划导览平台

> 出发前，先看见真实的河山；出发后，不踩任何一个雷。

## 项目简介

慧行山海是一个基于 AI 与电子地图的一站式旅游规划导览平台，核心差异化：

- **看见河山**：720°全景漫游 + 多时段景观 + 3D 地球探索 + 实时天气 + 游客实拍墙
- **避雷避坑**：AI 避雷指数 + NLP 情感分析 + 宣传图 vs 实拍对比 + 时令适配推荐

## 已实现功能

### 前端（Next.js 14 + TypeScript + Tailwind CSS）
- **首页**：Hero 轮播、站内搜索、精选推荐
- **探索发现**：搜索（300ms 防抖 + 竞态防护）、省份/类型筛选、分页
- **景区详情**：图片轮播、景区实景环视（拖拽 + 时段光影）、实时天气、AI 避雷分析（基于真实评价数据）、游客评价、UGC 实拍墙（上传/点赞）、周边美食（高德 POI）、宣传视频（B站官方播放器+来源标注）、同省份推荐
- **游记社区**：游记/攻略发布（关联景区联想）、列表筛选排序、详情阅读与点赞、评论互动
- **旅游资讯**：实时聚合热门目的地天气（高德）、最新社区内容、最新评价与避雷提醒
- **避雷指南**：风险分级统计、避雷排行榜、避雷知识科普
- **智能规划**：LangGraph 多 Agent 工作流可视化（SSE 实时进度）、跨城交通方案、AI 行程输出渲染、导出/分享
- **AI 助手**：DeepSeek 驱动对话、多会话管理（本地持久化）、后端在线状态检测
- **3D 地球**：React Three Fiber 地球 + 景区标记（按避雷指数着色）+ 飞行路线
- **账号体系**：注册/登录（密码 + 验证码）/忘记密码，全站登录态展示与登出
- **监控面板**：工作流执行日志、质量评分统计
- SEO（sitemap/robots/OG 元信息/favicon）、全局错误与空状态、图片加载兜底

### 后端（FastAPI + SQLAlchemy + LangGraph）
- 景区 API：列表/筛选/分页/搜索/推荐/避雷指数
- 高德天气：地理编码 → 实时天气
- 认证：PBKDF2 密码哈希、会话 token、验证码（演示模式）
- AI：DeepSeek 对话、避雷情感分析、LangGraph 多 Agent 工作流（意图解析 → 4 路并行分析 → 行程汇聚 → 质量评估 → 自动修订）
- UGC：照片上传（类型白名单 + 大小限制 + 魔数校验）、评价、点赞
- 监控：工作流执行日志落库

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14、TypeScript、Tailwind CSS、React Three Fiber、Lucide |
| 后端 | FastAPI、SQLAlchemy、LangGraph、httpx、DeepSeek API |
| 地图 | 高德 JS API 2.0（地图/路线）、高德 Web API（天气） |
| 数据 | SQLite（开发）/ PostgreSQL（生产可配）、JSON 景区库 |

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+

### 1. 配置密钥

```bash
cd backend
cp .env.example .env   # 填入你自己的高德/DeepSeek 密钥
```

> ⚠️ 密钥只保存在 `backend/.env`（已被 .gitignore 排除），切勿提交到版本库或写入源码。

### 2. 一键启动（Windows）

双击 `start.bat`，或手动分别启动：

### 3. 手动启动

```bash
# 后端（端口 8000）
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端（端口 3000）
cd frontend
npm install
npm run dev
```

- 前端：http://localhost:3000
- 后端 API 文档：http://localhost:8000/docs
- 后端地址可通过 `frontend/.env.development` 的 `NEXT_PUBLIC_API_URL` 配置

### 演示账号

手机号 `13800138000` / 密码 `123456`（或自行注册；验证码为演示模式，会直接显示在页面上）

## API 接口一览

```
GET  /api/spots                      景区列表（分页/筛选）
GET  /api/spots/{id}                 景区详情
GET  /api/spots/search?q=            搜索
GET  /api/spots/{id}/avoid           避雷指数
GET  /api/spots/recommend            推荐
GET  /api/spots/{id}/food            周边美食（高德 POI）
GET  /api/food/city?city=            城市美食
GET  /api/news                       实时聚合旅游资讯
GET  /api/notes                      游记列表
POST /api/notes/submit               发布游记/攻略
GET  /api/notes/{id}                 游记详情
POST /api/notes/{id}/like            游记点赞
POST /api/notes/{id}/comments        游记评论
GET  /api/weather?city=              天气（高德）
GET  /api/stats                      统计信息
POST /api/auth/send-code             发送验证码
POST /api/auth/login                 密码登录
POST /api/auth/login/code            验证码登录
POST /api/auth/register              注册
POST /api/auth/reset-password        重置密码
GET  /api/auth/user                  当前用户
POST /api/auth/logout                登出
POST /api/chat                       AI 对话（DeepSeek）
POST /api/avoid/analyze              AI 避雷分析
GET  /api/avoid/batch                批量避雷分析结果
POST /api/workflow/plan              多 Agent 行程规划
POST /api/workflow/langgraph         LangGraph 工作流（等价）
POST /api/workflow/stream            工作流 SSE 流式进度
GET  /api/workflow/logs              工作流执行日志
POST /api/upload/photo               上传实拍（jpg/png/webp ≤10MB）
GET  /api/ugc/photos/{spot_id}       实拍列表
POST /api/ugc/like/{review_id}       点赞
POST /api/reviews/submit             提交评价
GET  /api/reviews/list/{spot_id}     评价列表
```

## 数据说明

- `data/scenic_spots.json`：350 个精品景区权威数据（全国 5A 覆盖 + 国际知名景区；坐标/评分/避雷指数），**为避免 LLM 输出趋同，avoid_index 以本文件为唯一权威**
- `data/scenic_videos.json`：92 条景区宣传视频元数据（B站官方播放器嵌入，标注来源与作者）
- `data/avoid_analysis.json`：DeepSeek 批量生成的避雷分析（关键词/标签/建议），数值字段与权威值对齐
- `backend/scripts/batch_avoid_analysis.py`：重跑批量分析（自动对齐权威值，不会反向覆盖）
- `frontend/lib/scenic_data.json`：前端本地副本（后端不可用时自动回退，保证纯静态部署可浏览）

> ⚠️ 根目录的 `慧行山海_中国景区信息库_v5_含详细介绍_Pexels图片.xlsx` 已因文本模式转存损坏
> （二进制字节被 UTF-8 替换符污染，无法修复）。核心 20 条数据已完整迁移至上述 JSON，不影响使用。

## 安全说明

- 所有密钥通过 `backend/.env` 注入，源码与 `.env.example` 中无真实密钥
- 密码使用 PBKDF2-SHA256 加盐哈希存储，旧明文数据在登录时自动透明升级
- 上传接口：扩展名白名单 + 10MB 上限 + 文件魔数校验 + 服务端生成文件名
- 所有列表接口分页参数有上下限，工作流反馈轮次限制 0-3（防 LLM 调用放大）
- CORS 白名单可配置（默认仅放行本地前端）
- 若密钥曾在历史版本中泄露过，请到各平台控制台重置

## 设计原则

1. **体验前置**：720° 全景与 3D 地球，未出发先看见
2. **AI 避雷**：结构化评估，一眼判断值不值得去
3. **真实可信**：不编造评价与数据——AI 分析基于真实输入，无数据时诚实提示
4. **分层解耦**：前后端分离，前端可静态导出并在无后端时优雅降级

## 许可证

MIT License
