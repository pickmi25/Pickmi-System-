# --- STAGE 1: Build the Frontend ---
FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx expo export -p web

# --- STAGE 2: Build the Backend ---
FROM node:22-slim AS backend-builder
WORKDIR /app
# Install build tools needed for native modules like sqlite3
RUN apt-get update && apt-get install -y python3 g++ make && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./backend/
WORKDIR /app/backend
# Force sqlite3 to build from source for perfect compatibility with the container
RUN npm install && npm rebuild sqlite3 --build-from-source
COPY backend/ ./
# Bring in the frontend build from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# --- STAGE 3: Final Production Image ---
FROM node:22-slim
WORKDIR /app/backend

# Install runtime dependencies for Puppeteer (Chrome) and ffmpeg
RUN apt-get update && apt-get install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 libgbm1 ca-certificates fonts-liberation libappindicator1 \
    libnss3 lsb-release xdg-utils wget ffmpeg --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy only the necessary backend files from the builder stage
COPY --from=backend-builder /app/backend ./

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
