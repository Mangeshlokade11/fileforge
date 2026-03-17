# Use official Node.js image
FROM node:20

# Install all binaries
RUN apt-get update && \
    apt-get install -y ffmpeg ghostscript libreoffice imagemagick && \
    apt-get clean

# Copy backend files
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Expose port
EXPOSE 10000
CMD ["node", "server.js"]