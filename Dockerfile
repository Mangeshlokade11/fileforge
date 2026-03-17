# ================================================================
#  FileForge — Production Dockerfile
#  Includes: FFmpeg · LibreOffice · Ghostscript · ImageMagick · Sharp
#  Base: node:20-slim  (Debian bullseye under the hood)
# ================================================================
FROM node:20-slim AS base

# ── System packages ───────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
      # Video / Audio
      ffmpeg \
      # Document conversion (PDF ↔ Word / Excel / PPT)
      libreoffice-headless \
      libreoffice-writer \
      libreoffice-calc \
      libreoffice-impress \
      # PDF ops
      ghostscript \
      # Image processing
      imagemagick \
      # Sharp native deps
      libvips-dev \
      # Fonts for LibreOffice rendering
      fonts-liberation \
      fonts-dejavu-core \
      fontconfig \
      # Utils
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

# Fix ImageMagick: allow PDF operations
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF"/<policy domain="coder" rights="read|write" pattern="PDF"/' \
      /etc/ImageMagick-6/policy.xml 2>/dev/null || true

# ── App ───────────────────────────────────────────────────────
WORKDIR /app

# Install deps first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev \
    && npm rebuild sharp \
    && npm cache clean --force

# Copy source
COPY . .

# Runtime directories
RUN mkdir -p uploads temp logs \
    && chmod 755 uploads temp logs

# Non-root user
RUN groupadd -r fileforge \
    && useradd  -r -g fileforge -d /app -s /bin/sh fileforge \
    && chown -R fileforge:fileforge /app
USER fileforge

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "backend/server.js"]
