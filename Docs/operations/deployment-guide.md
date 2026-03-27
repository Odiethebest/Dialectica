# Dialectica — Railway 部署文档

前后端合并部署到 Railway 单个服务，FastAPI 同时承担 API 和静态文件服务，ChromaDB 挂载 Railway 持久化卷。

---

## 最终架构

```
Railway Service: dialectica
  ├── FastAPI (backend)          → /dialectica/* API 路由
  ├── Static files (frontend)   → /* 所有其他请求
  └── Volume: /data/chroma_db   → ChromaDB 持久化
```

用户访问 `odieyang.com/dialectica` → Cloudflare Pages 代理 `/dialectica/*` → Railway

---

## 第一步：项目结构调整

Railway 部署前需要调整目录结构，前端 build 产物由 FastAPI 直接托管。

```
dialectica/
├── backend/
│   ├── app/
│   │   ├── main.py           ← 新增静态文件托管
│   │   ├── config.py
│   │   ├── graph/
│   │   ├── rag/
│   │   └── tools/
│   ├── data/corpus/
│   ├── requirements.txt
│   └── Dockerfile            ← 新建
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── railway.json              ← 新建
```

---

## 第二步：FastAPI 托管前端静态文件

修改 `backend/app/main.py`，在 API 路由之后挂载前端 build 产物：

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os

app = FastAPI()

# --- API 路由（保持不变）---
# app.include_router(dialectica_router, prefix="/dialectica")

# --- 静态文件托管 ---
# 前端 build 产物在 /app/frontend/dist
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    # 托管静态资源（JS、CSS、图片等）
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    # 所有非 API 路由返回 index.html（支持前端路由）
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = FRONTEND_DIST / "index.html"
        return FileResponse(index)
```

---

## 第三步：Dockerfile

在 `backend/` 目录下创建 `Dockerfile`，构建时同时编译前端：

```dockerfile
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS backend
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV PYTHONPATH=/app
ENV CHROMA_DB_PATH=/data/chroma_db

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

注意 `Dockerfile` 放在项目根目录，不是 `backend/` 里，因为它需要同时 COPY 前后端：

```
dialectica/
├── Dockerfile    ← 根目录
├── backend/
└── frontend/
```

---

## 第四步：railway.json

在项目根目录创建 `railway.json`：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

同时在 `main.py` 加一个健康检查端点：

```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## 第五步：ChromaDB 持久化卷配置

### 5.1 在 Railway Dashboard 挂载卷

1. 打开 Railway 项目 → 选择 dialectica service
2. 点击 **Volumes** → **Add Volume**
3. 配置：
    - Mount Path: `/data/chroma_db`
    - Size: 1GB（足够存储哲学语料库的向量索引）
4. 保存，Railway 会自动重新部署

### 5.2 更新 config.py

```python
# backend/app/config.py
import os

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
DEFAULT_MODEL   = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")
SYNTHESIS_MODEL = os.getenv("SYNTHESIS_MODEL", "gpt-4o")
MAX_ROUNDS      = int(os.getenv("MAX_ROUNDS", "2"))
CORS_ORIGINS    = os.getenv("CORS_ORIGINS", "https://odieyang.com").split(",")
PORT            = int(os.getenv("PORT", "8000"))
```

### 5.3 一次性构建知识库

知识库只需要构建一次。部署后通过 Railway 控制台执行：

```bash
# Railway Dashboard → Service → Shell
python backend/rag/build_index.py
```

构建完成后 `/data/chroma_db` 目录会持久化，重新部署不会丢失。

---

## 第六步：环境变量

在 Railway Dashboard → Service → Variables 中添加：

```
OPENAI_API_KEY        = sk-...
TAVILY_API_KEY        = tvly-...
CHROMA_DB_PATH        = /data/chroma_db
DEFAULT_MODEL         = gpt-4o-mini
SYNTHESIS_MODEL       = gpt-4o
MAX_ROUNDS            = 2
CORS_ORIGINS          = https://odieyang.com,https://www.odieyang.com
```

**不要**把 API key 写进代码或 Dockerfile。Railway 的环境变量在构建时和运行时都可用。

---

## 第七步：前端 Vite 配置

前端 build 之前需要把 API base URL 指向 Railway 服务：

```js
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    // 本地开发时代理到本地 FastAPI
    proxy: {
      '/dialectica': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

前端代码中 API 调用使用相对路径，生产环境和开发环境都能工作：

```js
// 不要写死 Railway URL
fetch('/dialectica/start', { ... })  // ✓ 相对路径
fetch('https://xxx.railway.app/dialectica/start', { ... })  // ✗ 硬编码
```

---

## 第八步：odieyang.com 接入

Dialectica 部署到 Railway 后，odieyang.com（Cloudflare Pages）需要将 `/dialectica/*` 流量代理过去。

### 8.1 获取 Railway 服务 URL

Railway Dashboard → Service → Settings → Domains

格式类似：`dialectica-production.up.railway.app`

### 8.2 Cloudflare Pages 反向代理

在 odieyang.com 的 Cloudflare Pages 项目中添加 `_redirects` 文件（放在 `public/` 目录）：

```
/dialectica/*  https://dialectica-production.up.railway.app/:splat  200
```

`200` 表示代理转发而不是 301/302 重定向，用户 URL 保持 `odieyang.com/dialectica`，不会跳转到 Railway 域名。

### 8.3 CORS 配置确认

Railway 服务的 CORS_ORIGINS 必须包含 `https://odieyang.com`，否则浏览器会拦截跨域请求。已在第六步环境变量中配置。

---

## 第九步：部署流程

### 首次部署

```bash
# 1. 安装 Railway CLI
npm install -g @railway/cli

# 2. 登录
railway login

# 3. 在项目根目录初始化
railway init

# 4. 推送部署
railway up

# 5. 部署完成后，通过 Shell 构建知识库（只需一次）
railway shell
python backend/rag/build_index.py
exit
```

### 后续更新

```bash
# 推送代码到 GitHub，Railway 自动触发重新部署
git push origin main

# 或者手动触发
railway up
```

---

## 第十步：部署后验证

按顺序检查：

```bash
# 1. 健康检查
curl https://dialectica-production.up.railway.app/health
# 期望：{"status": "ok"}

# 2. 前端是否正常加载
curl -I https://dialectica-production.up.railway.app/
# 期望：HTTP/2 200, content-type: text/html

# 3. API 是否可访问
curl -X POST https://dialectica-production.up.railway.app/dialectica/start \
  -H "Content-Type: application/json" \
  -d '{"claim": "test", "lang": "en"}'
# 期望：SSE stream 开始

# 4. 通过 odieyang.com 访问
curl -I https://odieyang.com/dialectica
# 期望：HTTP/2 200
```

---

## 常见问题

**Q: Railway 免费 tier 够用吗？**
每月 $5 免费额度，单个轻量服务日常流量完全够用。ChromaDB 卷 1GB 额外计费但很便宜。

**Q: 冷启动延迟？**
Railway 免费 tier 不会像 Render 那样休眠，服务持续运行，没有冷启动问题。

**Q: ChromaDB 数据会丢失吗？**
不会。持久化卷独立于服务生命周期，重新部署、回滚都不影响 `/data/chroma_db` 的数据。

**Q: 前端更新需要重新构建知识库吗？**
不需要。知识库只在 `build_index.py` 执行时写入，前端改动只触发 Vite build，不影响 ChromaDB。

**Q: 本地开发怎么处理？**
本地运行 `uvicorn backend.app.main:app --reload`，前端 `npm run dev`，Vite proxy 自动转发 API 请求，不需要改任何代码。