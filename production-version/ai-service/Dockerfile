# ─────────────────────────────────────────────────────────────────
# FaceVoxAI AI Service — Dockerfile
# Python 3.11 slim with dlib, resemblyzer, FastAPI
# Note: dlib requires cmake & build tools
# ─────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# Build deps for dlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libsm6 \
    libxext6 \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
