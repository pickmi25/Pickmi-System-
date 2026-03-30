# Use a modern node base image (Node 22 Bookworm)
FROM node:22-slim

# Install dependencies for puppeteer (Chrome) and ffmpeg for audio
RUN apt-get update && apt-get install -y \
    python3 g++ make \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 libgbm1 ca-certificates fonts-liberation libappindicator1 \
    libnss3 lsb-release xdg-utils wget ffmpeg --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set up the working directory
WORKDIR /app

# Step 1: Build the Frontend (Web)
# Copy root package files and install frontend dependencies
COPY package*.json ./
RUN npm install

# Copy all source files and build the frontend (creates /app/dist)
COPY . .
RUN npx expo export -p web

# Step 2: Set up the Backend
# Move to backend folder
WORKDIR /app/backend

# Install backend dependencies
RUN npm install

# Move the built frontend files into the backend's dist folder for serving
RUN rm -rf dist && cp -r /app/dist ./dist

# Set environment variables for production
ENV PORT=3000
ENV NODE_ENV=production

# Expose the server port
EXPOSE 3000

# Start the unified server (Express + static Frontend)
CMD ["npm", "start"]
