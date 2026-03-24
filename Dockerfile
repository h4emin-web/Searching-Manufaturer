FROM python:3.12-slim

WORKDIR /app

RUN pip install uv --quiet

COPY backend/requirements.txt .
RUN uv pip install --system -r requirements.txt

COPY backend/ .

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8002}"]
