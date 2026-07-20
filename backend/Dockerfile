# BrainStack API — also the Celery worker image (compose overrides command).
FROM python:3.12-slim

WORKDIR /app

# System deps for pymupdf/onnxruntime wheels are bundled; keep the image lean.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY eval ./eval

EXPOSE 8000
# Migrations run once at boot, then serve. The worker service overrides this
# with: celery -A app.worker worker
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
