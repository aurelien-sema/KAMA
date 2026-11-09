# Construire depuis la racine du depot : docker build -f backend/Dockerfile -t kama-backend .
FROM python:3.11-slim

RUN useradd --create-home kama
WORKDIR /srv/kama/backend

COPY backend/requirements.txt backend/requirements-mt.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-mt.txt

COPY backend/app ./app
COPY backend/config ./config
COPY content-data /srv/kama/content-data

USER kama
ENV KAMA_ENV=prod KAMA_HOST=0.0.0.0 KAMA_MODELS_DIR=/models
EXPOSE 8000
CMD ["python", "-m", "app"]
