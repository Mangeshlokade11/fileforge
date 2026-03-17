# FileForge v2.0

**26-tool professional file conversion platform** — PDF, Documents, Images, Video, Audio.  
Node.js · Express · MongoDB · FFmpeg · LibreOffice · Ghostscript · Sharp · pdf-lib  
Google OAuth · Nodemailer · JWT Auth · AWS/Docker ready

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
nano .env          # Fill in MAIL_*, GOOGLE_*, JWT_SECRET

# 3. Start (requires MongoDB running locally)
npm start          # → http://localhost:3000

# Dev mode with auto-reload
npm run dev
```

---

## Docker (recommended)

```bash
cp .env.example .env && nano .env
docker compose up -d
# → http://localhost:3000
```

---

## AWS EC2 Deployment

### One-command setup (Ubuntu 22.04)

```bash
# 1. Launch EC2: Ubuntu 22.04, t3.medium, 30 GB gp3
#    Security group: 22, 80, 443 open

# 2. Paste ec2-userdata.sh into "User data" at launch — OR run manually:
ssh ubuntu@YOUR-IP
curl -fsSL https://raw.githubusercontent.com/YOUR/repo/main/deploy.sh | sudo bash

# 3. Copy your files
scp -r ./fileforge/* ubuntu@YOUR-IP:/home/ubuntu/fileforge/

# 4. Configure and start
cd /home/ubuntu/fileforge
cp .env.example .env && nano .env
npm install && npm rebuild sharp
pm2 start backend/server.js --name fileforge
pm2 save && pm2 startup
```

### Add HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
# Update APP_URL in .env → https://yourdomain.com
pm2 restart fileforge
```

---

## Google OAuth Setup

1. [console.cloud.google.com](https://console.cloud.google.com) → New project
2. **APIs & Services → OAuth consent screen** → External
   - App name: `FileForge`
   - Authorised domains: `yourdomain.com`
3. **Credentials → Create OAuth 2.0 Client ID** → Web application
   - Authorised redirect URIs:
     ```
     http://localhost:3000/api/auth/google/callback
     https://yourdomain.com/api/auth/google/callback
     ```
4. Copy **Client ID** and **Client Secret** to `.env`:
   ```env
   GOOGLE_CLIENT_ID=1234-xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxx
   APP_URL=https://yourdomain.com
   ```
5. `pm2 restart fileforge` — Google button appears automatically

---

## Gmail SMTP Setup

1. Use (or create) `noreply.fileforge@gmail.com`
2. Enable **2-Factor Authentication**
3. [myaccount.google.com](https://myaccount.google.com) → **Security → App Passwords**
4. Create App Password → copy 16-char code (no spaces)
5. `.env`:
   ```env
   MAIL_USER=noreply.fileforge@gmail.com
   MAIL_PASS=abcdabcdabcdabcd
   ```

### Email triggers

| Event | Subject |
|---|---|
| Sign up | `Hi [Name], welcome to FileForge! 🚀` |
| Login | `Hi [Name], you just signed in to FileForge` |
| Conversion done | `Hi [Name], your [Tool] conversion is ready` |

---

## All 26 Tools

| # | Tool | Engine | Options |
|---|---|---|---|
| 1 | Compress PDF | Ghostscript | Quality preset (screen/ebook/printer/prepress) |
| 2 | Merge PDFs | pdf-lib | Multi-file, 2+ PDFs |
| 3 | Split PDF | pdf-lib | Page ranges (e.g. 1-3, 5, 7-9) |
| 4 | PDF → Word | LibreOffice | — |
| 5 | PDF → JPG | ImageMagick | DPI (72/96/150/300), JPEG quality |
| 6 | Protect PDF | Ghostscript | User password, owner password |
| 7 | Word → PDF | LibreOffice | — |
| 8 | Excel → PDF | LibreOffice | — |
| 9 | PowerPoint → PDF | LibreOffice | — |
| 10 | HTML → PDF | LibreOffice | — |
| 11 | Text → PDF | LibreOffice | — |
| 12 | CSV → Excel | LibreOffice | — |
| 13 | Compress Image | Sharp | JPEG quality (10–95) |
| 14 | Resize Image | Sharp | px dimensions OR % scale + quality |
| 15 | PNG → JPG | Sharp | JPEG quality |
| 16 | JPG → PNG | Sharp | Compression level (1–9) |
| 17 | Image → WebP | Sharp | Quality + lossless toggle |
| 18 | Image → PDF | ImageMagick | JPEG quality |
| 19 | Video → MP3 | FFmpeg | Audio bitrate (96k–320k) |
| 20 | MP4 → WebM | FFmpeg | CRF (18–52) |
| 21 | Video → MP4 | FFmpeg | CRF (16–36) + encoding preset |
| 22 | Compress Video | FFmpeg | CRF (18–40) + audio bitrate |
| 23 | Audio → WAV | FFmpeg | Sample rate (22/44/48 kHz) |
| 24 | WAV → MP3 | FFmpeg | Audio bitrate |
| 25 | FLAC → MP3 | FFmpeg | Audio bitrate (up to 320k) |
| 26 | Compress Audio | FFmpeg | Target bitrate (48k–128k) |

---

## System Requirements

| Tool | Install |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| MongoDB 6+ | [mongodb.com](https://mongodb.com) |
| FFmpeg | `apt install ffmpeg` |
| LibreOffice | `apt install libreoffice-headless` |
| Ghostscript | `apt install ghostscript` |
| ImageMagick | `apt install imagemagick` |

---

## PM2 Commands

```bash
pm2 status                    # View process
pm2 logs fileforge            # Stream logs
pm2 logs fileforge --lines 50 # Last 50 lines
pm2 restart fileforge         # Restart after .env changes
pm2 monit                     # Interactive monitor
```

---

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `NODE_ENV` | Yes | `development` |
| `PORT` | No | `3000` |
| `APP_URL` | Yes | `http://localhost:3000` |
| `MONGODB_URI` | Yes | local MongoDB |
| `JWT_SECRET` | Yes | — |
| `SESSION_SECRET` | Yes | — |
| `MAIL_HOST` | Email | `smtp.gmail.com` |
| `MAIL_USER` | Email | — |
| `MAIL_PASS` | Email | — |
| `GOOGLE_CLIENT_ID` | OAuth | — |
| `GOOGLE_CLIENT_SECRET` | OAuth | — |
| `FREE_MONTHLY_LIMIT` | No | `10` |
| `MAX_FILE_SIZE_FREE` | No | `524288000` (500 MB) |
| `TEMP_FILE_TTL` | No | `2` (hours) |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
