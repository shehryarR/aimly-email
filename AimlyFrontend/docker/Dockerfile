FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build check — fails here if React/TypeScript has errors
# Increased heap to prevent OOM during tsc + vite build
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

EXPOSE 8501

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8501"]