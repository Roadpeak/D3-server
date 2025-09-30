# ==========================================
# SERVER DOCKERFILE (Node.js API)
# ==========================================
# Save this as: Dockerfile in your /server directory

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (adjust if your server uses a different port)
EXPOSE 4000

# Start the server
CMD ["node", "app.js"]