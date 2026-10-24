FROM python:3.12-slim

# Install system dependencies (build tools, libgomp for faiss)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirement files first for layer caching
COPY web/backend/requirements.txt /app/requirements.txt

# Install python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy engine and backend code
COPY reroute /app/reroute
COPY web/backend /app/web/backend

WORKDIR /app/web/backend

# Default port: 7860 (Hugging Face Spaces default) or read from $PORT (Render/Cloud Run)
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
