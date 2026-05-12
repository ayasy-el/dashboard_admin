FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY ingestion_service/requirements.txt /app/ingestion_service/requirements.txt

RUN pip install --upgrade pip && pip install -r /app/ingestion_service/requirements.txt

COPY ingestion_service /app/ingestion_service
WORKDIR /app
ENV PYTHONPATH=/app

ENV PORT=8001

COPY docker/ingestion_service/entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "ingestion_service.app:app", "--host", "0.0.0.0", "--port", "8001"]
