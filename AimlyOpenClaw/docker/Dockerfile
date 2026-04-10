# AimlyOpenClaw/docker/Dockerfile
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && \
    apt install -y curl git openssl python3 python3-pip && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt install -y nodejs && \
    apt clean

RUN npm install -g openclaw@latest @larksuiteoapi/node-sdk

RUN pip3 install fastapi uvicorn

COPY onboard.sh /onboard.sh
COPY server.py /app/server.py
RUN chmod +x /onboard.sh

WORKDIR /app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["/onboard.sh"]