FROM python:3.12-slim

WORKDIR /app

# 시스템 의존성 (Playwright 제외 - 배포 환경에선 불필요)
RUN apt-get update && apt-get install -y \
    gcc libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway가 PORT 환경변수를 자동 주입
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8002}"]
