# 部署指南

## 部署前必读

- 所有密钥只放在 `backend/.env`，已在 `.gitignore` 排除；**上线前请确认历史代码中的密钥已在各平台重置**
- 首次部署后请立即修改/删除演示账号（`backend/app/main.py` 中 `MOCK_USERS`）

## 场景一：本地 / 局域网演示（最简单）

```bash
# 1. 配置密钥
cd backend
cp .env.example .env    # 填入高德 / DeepSeek 密钥

# 2. 启动后端（生产模式，多 worker）
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

# 3. 启动前端
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://<你的局域网IP>:8000 npm run dev
# 或生产模式：NEXT_PUBLIC_API_URL=http://<IP>:8000 npm run build && npm start
```

同一局域网的访问者打开 `http://<你的IP>:3000` 即可使用。

## 场景二：云服务器部署（公网可访问）

### 架构

```
浏览器 → 前端静态站(Nginx/对象存储) → 后端 API(uvicorn :8000, Nginx 反代 + HTTPS)
```

### 1. 后端

```bash
cd backend
pip install -r requirements.txt
# .env 中配置 CORS 白名单（放行你的前端域名）
#   FRONTEND_URL=https://你的域名
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
```

建议用 systemd 守护：

```ini
# /etc/systemd/system/huixing.service
[Unit]
Description=Huixing Backend
After=network.target

[Service]
WorkingDirectory=/path/to/huixing-shanhai/backend
ExecStart=/path/to/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

Nginx 反代示例（API + 上传文件同域，避免跨域）：

```nginx
server {
    listen 443 ssl;
    server_name api.你的域名.com;
    # ssl_certificate ...;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        client_max_body_size 12m;   # 照片上传上限 10MB + 余量
    }
}
```

### 2. 前端（静态导出）

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.你的域名.com NEXT_PUBLIC_BASE_PATH= npm run build
# 产物在 out/ 目录，整体部署到任意静态托管（Nginx / Vercel / OSS+CDN）
```

Nginx 托管示例：

```nginx
server {
    listen 443 ssl;
    server_name 你的域名.com;
    root /path/to/out;
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }
}
```

### 3. 环境变量速查

| 变量 | 位置 | 说明 |
|---|---|---|
| `AMAP_KEY` / `AMAP_SECURITY_CODE` | backend/.env | ⚠️ 天气/地理编码功能需要**「Web服务」类型** Key（网页地图用的 JS API 类型 Key 会报 10009 平台不匹配）；地图显示用 JS API 类型 Key |
| `DEEPSEEK_API_KEY` | backend/.env | AI 对话/避雷分析/工作流 |
| `MEITUAN_ACCESS_TOKEN` | backend/.env | 可选，评价聚合 |
| `FRONTEND_URL` | backend/.env | CORS 白名单 |
| `SECRET_KEY` | backend/.env | 会话签名密钥（多 worker/重启不掉线），部署时必须更换 |
| `NEXT_PUBLIC_API_URL` | 前端构建时 | 后端 API 地址（如 `https://api.xxx.com`，不带 /api 后缀） |
| `NEXT_PUBLIC_BASE_PATH` | 前端构建时 | 子路径部署前缀（根路径部署设为空） |

> ⚠️ `NEXT_PUBLIC_*` 是构建时注入，改了必须重新 `npm run build`。

## 上线检查清单

- [ ] 运行 `python scripts/connectivity_check.py --full` 全链路连通性检查（覆盖后端全部端点、高德天气、DeepSeek 真实调用、前端产物），全部通过后再上线
- [ ] 所有第三方密钥已在平台重置，新密钥只写入服务器上的 `.env`
- [ ] CORS 白名单只放行自己的前端域名
- [ ] 演示账号 `13800138000` 已删除或改密
- [ ] `huixing_shanhai.db` 已备份策略（SQLite 定期 copy，或配置 `DATABASE_URL` 换 PostgreSQL）
- [ ] 后端用 systemd/supervisor 守护，非 `--reload` 开发模式
- [ ] Nginx 已配 HTTPS 与 `client_max_body_size 12m`
- [ ] 前端 `npm run build` 无报错，`out/` 产物完整（build 会自动重新生成 sitemap/robots，注意传入 `NEXT_PUBLIC_SITE_URL` 为线上域名）
- [ ] 高德控制台已为 JS API Key 绑定线上域名白名单；`AMAP_KEY`（REST）需为「Web服务」类型
- [ ] DeepSeek 账户余额充足（AI 功能按量计费）

## 已知边界（如实告知用户）

- 景区库为 20 条精选 5A 数据（权威数据源为 `data/scenic_spots.json`），扩展需补数据文件
- 验证码为演示模式（明文回显），接入真实短信前不要开放公网注册
- AI 生成的行程与避雷分析仅供参考，已在界面标注免责说明
