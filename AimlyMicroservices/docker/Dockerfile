FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .
COPY database.py .
COPY email_read_router.py .
COPY email_optout_router.py .
COPY content/ .

# Create data directory
RUN mkdir -p /data

# Default fallbacks — overridden by .env passed via docker-compose
ENV MICROSERVICE_DB_PATH=/data/email_microservice.db
ENV MICROSERVICE_PORT=8001
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8001

# Run the application
CMD ["python", "main.py"]