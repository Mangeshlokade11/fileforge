#!/usr/bin/env bash
# ============================================================
#  FileForge v2.0 — One-Command Setup Script
#  Usage: bash setup.sh
# ============================================================
set -e

GREEN='\033[0;32m'; TEAL='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${TEAL}[FileForge]${NC} $1"; }
ok()    { echo -e "${GREEN}  ✅  $1${NC}"; }
warn()  { echo -e "${YELLOW}  ⚠️   $1${NC}"; }
error() { echo -e "${RED}  ❌  $1${NC}"; exit 1; }

echo ""
echo -e "${TEAL}╔══════════════════════════════════════════════╗"
echo -e "║       FileForge v2.0 — Setup                 ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Node.js ──────────────────────────────────────────────────
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node.js 18+ from https://nodejs.org"
fi
NODE_MAJOR=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>&1 && echo ok || echo old)
if [ "$NODE_MAJOR" = "old" ]; then
  error "Node.js 18+ required. Current: $(node -v). Update from https://nodejs.org"
fi
ok "Node.js $(node -v)"

# ── MongoDB ───────────────────────────────────────────────────
info "Checking MongoDB..."
if command -v mongod &>/dev/null; then
  ok "MongoDB found: $(mongod --version | head -1)"
  if ! mongosh --quiet --eval "db.adminCommand('ping')" &>/dev/null 2>&1; then
    warn "MongoDB not running. Trying to start..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      brew services start mongodb-community 2>/dev/null || true
    else
      sudo systemctl start mongod 2>/dev/null || sudo service mongod start 2>/dev/null || true
    fi
  else
    ok "MongoDB is running"
  fi
else
  warn "MongoDB not found. Options:"
  echo ""
  echo "   macOS:  brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community"
  echo "   Ubuntu: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/"
  echo "   Docker: docker run -d -p 27017:27017 --name mongo mongo:7"
  echo "   Cloud:  https://cloud.mongodb.com (free tier) — update MONGODB_URI in .env"
  echo ""
  read -p "   Press ENTER to continue anyway..." _
fi

# ── Conversion tools ──────────────────────────────────────────
info "Checking conversion tools..."
command -v ffmpeg      &>/dev/null && ok "FFmpeg found"       || warn "FFmpeg missing — video/audio conversions will fail\n       Install: sudo apt install ffmpeg  OR  brew install ffmpeg"
command -v libreoffice &>/dev/null && ok "LibreOffice found"  || warn "LibreOffice missing — document conversions will fail\n       Install: sudo apt install libreoffice-headless  OR  brew install --cask libreoffice"
command -v gs          &>/dev/null && ok "Ghostscript found"  || warn "Ghostscript missing — PDF operations will fail\n       Install: sudo apt install ghostscript  OR  brew install ghostscript"
(command -v magick &>/dev/null || command -v convert &>/dev/null) && ok "ImageMagick found" || warn "ImageMagick missing — Install: sudo apt install imagemagick"

# ── .env ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Creating .env from template..."
  cp .env.example .env
  ok ".env created — edit it to add your MAIL_USER / MAIL_PASS and MongoDB URI"
else
  ok ".env already exists"
fi

# ── npm install ───────────────────────────────────────────────
info "Installing Node.js dependencies..."
npm install
ok "Dependencies installed"

# ── Rebuild Sharp ─────────────────────────────────────────────
info "Rebuilding sharp for your platform..."
npm rebuild sharp 2>/dev/null && ok "sharp rebuilt" || warn "sharp rebuild skipped (image compression may be affected)"

# ── Directories ───────────────────────────────────────────────
mkdir -p uploads temp logs
touch uploads/.gitkeep temp/.gitkeep logs/.gitkeep
ok "Directories ready"

# ── Migration ─────────────────────────────────────────────────
info "Running database migration (creating indexes)..."
node database/migrate.js 2>/dev/null && ok "Migration complete" || warn "Migration failed — run manually after starting MongoDB: node database/migrate.js"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗"
echo -e "║   ✅  FileForge is ready!                            ║"
echo -e "║                                                      ║"
echo -e "║   Start server:  npm start                           ║"
echo -e "║   Dev mode:      npm run dev                         ║"
echo -e "║   Open browser:  http://localhost:3000               ║"
echo -e "╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "   1. Edit .env  → add MAIL_USER + MAIL_PASS for email delivery"
echo "   2. npm start  → server starts at http://localhost:3000"
echo "   3. Sign up at /signup and start converting files"
echo ""
