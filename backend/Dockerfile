# Construire depuis la racine du depot : docker build -f backend/Dockerfile -t kama-backend .
FROM python:3.11-slim

RUN useradd --create-home kama
WORKDIR /srv/kama/backend

COPY backend/requirements.txt backend/requirements-mt.txt backend/requirements-voice.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-mt.txt
# Voix et LLM CPU : WITH_VOICE=1 ajoute les moteurs vocaux et compile llama-cpp-python.
# Le build C++ est sequentiel pour limiter le pic memoire sur le VPS.
ARG WITH_VOICE=0
RUN if [ "$WITH_VOICE" = "1" ]; then \
      apt-get update && apt-get install -y --no-install-recommends build-essential cmake git && rm -rf /var/lib/apt/lists/* && \
      CMAKE_ARGS="-DGGML_NATIVE=OFF" CMAKE_BUILD_PARALLEL_LEVEL=1 pip install --no-cache-dir -r requirements-voice.txt; \
    fi

COPY backend/app ./app
COPY backend/config ./config
COPY content-data /srv/kama/content-data

RUN mkdir -p /models && chown kama:kama /models

USER kama
ENV KAMA_ENV=prod KAMA_HOST=0.0.0.0 KAMA_MODELS_DIR=/models
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')" || exit 1
CMD ["python", "-m", "app"]
