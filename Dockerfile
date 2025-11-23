FROM node:20-alpine

WORKDIR /app

# Install dependencies for build tools (python, make, g++, etc. if needed)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install root dependencies (this might trigger postinstall, so we need frontend files)
# But we haven't copied frontend source yet. 
# To be safe, we'll use --ignore-scripts first, then copy source, then build.
RUN npm install --ignore-scripts

# Copy source code
COPY . .

# Install frontend dependencies and build
RUN cd frontend && npm install && npm run build

# Rebuild native modules if any (optional, but good practice)
# RUN npm rebuild bcryptjs --build-from-source

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
