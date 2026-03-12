# Base image
FROM python:3.12-slim

# Set working directory inside container
WORKDIR /app

# Ensure Python output is sent straight to terminal without buffering
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY outreach_agent/ ./outreach_agent/

# Copy env.json into /app
COPY env.json ./env.json

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI
CMD ["python", "-u", "outreach_agent/main.py"]