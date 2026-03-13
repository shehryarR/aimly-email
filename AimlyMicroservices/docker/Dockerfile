FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY database.py .
COPY email_read_router.py .
COPY email_optout_router.py .
COPY content/ .

# Data directory — same as backend pattern
RUN mkdir -p /app/data

ENV MICROSERVICE_DB_PATH=./data/email_microservice.db
ENV MICROSERVICE_PORT=8001
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["python", "main.py"]