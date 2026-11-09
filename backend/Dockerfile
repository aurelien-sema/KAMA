# Construire depuis la racine du depot : docker build -f backend/Dockerfile -t kama-backend .
FROM python:3.11-slim

RUN useradd --create-home kama
WORKDIR /srv/kama/backend

COPY backend/requirements.txt backend/requirements-mt.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-mt.txt

COPY backend/app ./app
COPY backend/config ./config
COPY content-data /srv/kama/content-data

RUN mkdir -p /models && chown kama:kama /models

USER kama
ENV KAMA_ENV=prod KAMA_HOST=0.0.0.0 KAMA_MODELS_DIR=/models
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')" || exit 1
CMD ["python", "-m", "app"]
