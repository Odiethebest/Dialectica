FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt 在根目录
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# backend 代码和前端 dist
COPY backend/ ./backend/
COPY frontend/dist ./frontend/dist

ENV PYTHONPATH=/app
ENV CHROMA_DB_PATH=/data/chroma_db
ENV BUILD_VERSION=2

EXPOSE 8000

CMD sh -c "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"