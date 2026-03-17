'use strict';
const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const BIN_FF = process.env.FFMPEG_PATH      || 'ffmpeg';
const BIN_LO = process.env.LIBREOFFICE_PATH || 'libreoffice';
const BIN_GS = process.env.GHOSTSCRIPT_PATH || 'gs';
const BIN_IM = process.env.IMAGEMAGICK_PATH || 'convert';

// ── runProcess ────────────────────────────────────────────────
function run(bin, args, ms) {
  ms = ms || 150000;
  return new Promise(function(resolve, reject) {
    var proc;
    try { proc = spawn(bin, args, { stdio: ['ignore','pipe','pipe'] }); }
    catch(e) { return reject(new Error('"' + bin + '" could not launch — is it installed? (' + e.message + ')')); }

    var stderr = '';
    proc.stderr.on('data', function(d) { stderr += d.toString(); });
    var timer = setTimeout(function() {
      try { proc.kill('SIGKILL'); } catch {}
      reject(new Error('Timed out after ' + Math.round(ms/1000) + 's'));
    }, ms);
    proc.on('close', function(code) {
      clearTimeout(timer);
      if (code === 0) return resolve(stderr);
      reject(new Error(path.basename(bin) + ' exited ' + code + ': ' + stderr.slice(-600)));
    });
    proc.on('error', function(e) {
      clearTimeout(timer);
      reject(new Error('"' + path.basename(bin) + '" not found in PATH — install it first. (' + e.message + ')'));
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function clamp(v, lo, hi, def) {
  var n = parseInt(v);
  return isNaN(n) ? def : Math.min(hi, Math.max(lo, n));
}

function validPreset(v) {
  var ok = ['ultrafast','superfast','veryfast','faster','fast','medium','slow','slower','veryslow'];
  return ok.includes(v) ? v : 'fast';
}

// ── PDF lib helpers ───────────────────────────────────────────
async function getPDFLib() {
  try { return require('pdf-lib'); }
  catch { return null; }
}

// ── PDF: merge ────────────────────────────────────────────────
async function mergePdf(inputPaths, outputPath) {
  var PDFLib = await getPDFLib();
  if (PDFLib) {
    var merged = await PDFLib.PDFDocument.create();
    for (var i = 0; i < inputPaths.length; i++) {
      var bytes = fs.readFileSync(inputPaths[i]);
      var doc   = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      var pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(function(p) { merged.addPage(p); });
    }
    fs.writeFileSync(outputPath, await merged.save());
  } else {
    // GS fallback
    await run(BIN_GS, ['-sDEVICE=pdfwrite','-dNOPAUSE','-dBATCH','-dQUIET',
      '-sOutputFile=' + outputPath].concat(inputPaths), 120000);
  }
}

// ── PDF: split ────────────────────────────────────────────────
async function splitPdf(inputPath, outputPath, opts) {
  var pagesStr = String(opts.pages || '').trim();
  var outDir   = path.dirname(outputPath);
  var base     = path.basename(outputPath, '.pdf');

  var PDFLib = await getPDFLib();
  if (PDFLib) {
    var bytes = fs.readFileSync(inputPath);
    var src   = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    var total = src.getPageCount();

    // Parse page ranges (1-indexed)
    var idx = [];
    if (pagesStr) {
      pagesStr.split(',').forEach(function(part) {
        part = part.trim();
        var m = part.match(/^(\d+)-(\d+)$/);
        if (m) {
          for (var n = parseInt(m[1]); n <= parseInt(m[2]) && n <= total; n++) {
            if (n >= 1) idx.push(n - 1);
          }
        } else if (/^\d+$/.test(part)) {
          var n = parseInt(part);
          if (n >= 1 && n <= total) idx.push(n - 1);
        }
      });
      if (!idx.length) throw new Error('No valid pages in range "' + pagesStr + '" (PDF has ' + total + ' pages)');
    } else {
      for (var i = 0; i < total; i++) idx.push(i);
    }

    var doc   = await PDFLib.PDFDocument.create();
    var pages = await doc.copyPages(src, idx);
    pages.forEach(function(p) { doc.addPage(p); });
    fs.writeFileSync(outputPath, await doc.save());
  } else {
    // GS split — produce first page as output
    var pattern = path.join(outDir, base + '_%04d.pdf');
    await run(BIN_GS, ['-sDEVICE=pdfwrite','-dNOPAUSE','-dBATCH','-dQUIET',
      '-sOutputFile=' + pattern, inputPath], 120000);
    var pages2 = fs.readdirSync(outDir)
      .filter(function(f) { return f.startsWith(base + '_') && f.endsWith('.pdf'); }).sort();
    if (!pages2.length) throw new Error('GS produced no split pages');
    fs.copyFileSync(path.join(outDir, pages2[0]), outputPath);
  }
}

// ── PDF: compress ─────────────────────────────────────────────
async function compressPdf(inputPath, outputPath, opts) {
  var preset = ['screen','ebook','printer','prepress'].includes(opts.quality) ? opts.quality : 'ebook';
  await run(BIN_GS, [
    '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=/' + preset, '-dNOPAUSE', '-dBATCH', '-dQUIET',
    '-sOutputFile=' + outputPath, inputPath
  ], 120000);
}

// ── PDF: protect ──────────────────────────────────────────────
async function protectPdf(inputPath, outputPath, opts) {
  var up = String(opts.userPass  || '');
  var op = String(opts.ownerPass || 'owner_' + Date.now());
  await run(BIN_GS, [
    '-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH', '-dQUIET',
    '-sOwnerPassword=' + op, '-sUserPassword=' + up,
    '-dEncryptionR=3', '-dKeyLength=128',
    '-sOutputFile=' + outputPath, inputPath
  ], 120000);
}

// ── LibreOffice ───────────────────────────────────────────────
async function loConvert(inputPath, outDir, fmt) {
  await run(BIN_LO, [
    '--headless', '--norestore', '--nofirststartwizard',
    '--convert-to', fmt, '--outdir', outDir, inputPath
  ], 120000);
}

// ── ImageMagick ───────────────────────────────────────────────
async function imConvert(inputPath, outputPath, toolId, opts) {
  var args;
  if (toolId === 'pdf-to-jpg') {
    var dens = String(parseInt(opts.density) || 150);
    var qual = String(clamp(opts.quality, 50, 100, 90));
    args = ['-density', dens, inputPath + '[0]', '-quality', qual, outputPath];
  } else if (toolId === 'jpg-to-pdf') {
    args = [inputPath, '-quality', String(clamp(opts.quality, 50, 100, 90)), outputPath];
  } else {
    args = [inputPath, outputPath];
  }
  await run(BIN_IM, args, 60000);
}

// ── Sharp ─────────────────────────────────────────────────────
async function sharpConvert(inputPath, outputPath, toolId, opts) {
  var sharp;
  try { sharp = require('sharp'); }
  catch { throw new Error('sharp not installed — run: npm install sharp'); }

  var img = sharp(inputPath);

  if (toolId === 'compress-image') {
    var q = clamp(opts.quality, 10, 95, 75);
    await img.jpeg({ quality: q }).toFile(outputPath);

  } else if (toolId === 'resize-image') {
    var mode = opts.resizeMode === 'percent' ? 'percent' : 'pixels';
    var outQ = clamp(opts.quality, 50, 100, 85);
    if (mode === 'percent') {
      var pct  = clamp(opts.percent, 5, 200, 50);
      var meta = await img.metadata();
      var nw   = Math.max(1, Math.round((meta.width  || 800) * pct / 100));
      var nh   = Math.max(1, Math.round((meta.height || 600) * pct / 100));
      await img.resize(nw, nh).jpeg({ quality: outQ }).toFile(outputPath);
    } else {
      var w = clamp(opts.width, 1, 8000, 800);
      var h = opts.height ? clamp(opts.height, 1, 8000, null) : null;
      await img.resize(w, h || undefined, { fit: 'inside', withoutEnlargement: true })
               .jpeg({ quality: outQ }).toFile(outputPath);
    }

  } else if (toolId === 'png-to-jpg') {
    await img.jpeg({ quality: clamp(opts.quality, 50, 100, 90) }).toFile(outputPath);

  } else if (toolId === 'jpg-to-png') {
    await img.png({ compressionLevel: clamp(opts.compressionLevel, 1, 9, 6) }).toFile(outputPath);

  } else if (toolId === 'jpg-to-webp') {
    var wq = clamp(opts.quality, 50, 100, 82);
    var ll = opts.lossless === true || opts.lossless === 'true';
    await img.webp({ quality: wq, lossless: ll }).toFile(outputPath);

  } else {
    await img.jpeg({ quality: 85 }).toFile(outputPath);
  }
}

// ── FFmpeg ────────────────────────────────────────────────────
async function ffmpegConvert(inputPath, outputPath, toolId, opts) {
  var args;

  if (toolId === 'mp4-to-mp3') {
    var ab = opts.audioBitrate || '192k';
    args = ['-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', ab, '-y', outputPath];

  } else if (toolId === 'mp4-to-webm') {
    var crf = clamp(opts.crf, 18, 52, 33);
    args = ['-i', inputPath, '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0',
            '-c:a', 'libopus', '-y', outputPath];

  } else if (toolId === 'avi-to-mp4') {
    var crf2   = clamp(opts.crf, 16, 36, 22);
    var preset = validPreset(opts.preset);
    args = ['-i', inputPath, '-c:v', 'libx264', '-preset', preset, '-crf', String(crf2),
            '-c:a', 'aac', '-movflags', '+faststart', '-y', outputPath];

  } else if (toolId === 'compress-video') {
    var crf3 = clamp(opts.crf, 18, 40, 28);
    var ab2  = opts.audioBitrate || '128k';
    args = ['-i', inputPath, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf3),
            '-c:a', 'aac', '-b:a', ab2, '-y', outputPath];

  } else if (toolId === 'mp3-to-wav') {
    var sr = ['22050','44100','48000'].includes(String(opts.sampleRate)) ? opts.sampleRate : '44100';
    args = ['-i', inputPath, '-acodec', 'pcm_s16le', '-ar', sr, '-y', outputPath];

  } else if (toolId === 'wav-to-mp3' || toolId === 'flac-to-mp3') {
    var ab3 = opts.audioBitrate || '192k';
    args = ['-i', inputPath, '-acodec', 'libmp3lame', '-b:a', ab3, '-y', outputPath];

  } else if (toolId === 'compress-audio') {
    var ab4 = opts.audioBitrate || '96k';
    args = ['-i', inputPath, '-acodec', 'libmp3lame', '-b:a', ab4, '-y', outputPath];

  } else {
    args = ['-i', inputPath, '-y', outputPath];
  }

  await run(BIN_FF, args, 180000);
}

// ── Master dispatch ───────────────────────────────────────────
async function convert(arg) {
  var toolId     = arg.toolId;
  var inputPath  = arg.inputPath;
  var inputPaths = arg.inputPaths;
  var outputPath = arg.outputPath;
  var opts       = arg.options || {};

  var tool = require('../utils/tools').byId[toolId];
  if (!tool) throw new Error('Unknown toolId: "' + toolId + '"');

  var outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  if (tool.engine === 'pdflib') {
    if (toolId === 'merge-pdf') {
      var files = (inputPaths && inputPaths.length >= 2) ? inputPaths : [inputPath];
      await mergePdf(files, outputPath);
    } else if (toolId === 'split-pdf') {
      await splitPdf(inputPath, outputPath, opts);
    } else {
      throw new Error('Unknown pdflib tool: ' + toolId);
    }

  } else if (tool.engine === 'ghostscript') {
    if (toolId === 'compress-pdf')      await compressPdf(inputPath, outputPath, opts);
    else if (toolId === 'protect-pdf')  await protectPdf(inputPath, outputPath, opts);
    else await compressPdf(inputPath, outputPath, opts);

  } else if (tool.engine === 'libreoffice') {
    var fmtMap = {
      'word-to-pdf': 'pdf', 'excel-to-pdf': 'pdf', 'ppt-to-pdf': 'pdf',
      'html-to-pdf': 'pdf', 'txt-to-pdf':   'pdf',
      'pdf-to-word': 'docx', 'csv-to-xlsx': 'xlsx'
    };
    var fmt = fmtMap[toolId] || 'pdf';
    await loConvert(inputPath, outDir, fmt);
    var base2   = path.basename(inputPath, path.extname(inputPath));
    var created = path.join(outDir, base2 + '.' + fmt);
    if (created !== outputPath) {
      if (fs.existsSync(created)) fs.renameSync(created, outputPath);
      else throw new Error('LibreOffice did not produce: ' + created);
    }

  } else if (tool.engine === 'imagemagick') {
    await imConvert(inputPath, outputPath, toolId, opts);

  } else if (tool.engine === 'sharp') {
    await sharpConvert(inputPath, outputPath, toolId, opts);

  } else if (tool.engine === 'ffmpeg') {
    await ffmpegConvert(inputPath, outputPath, toolId, opts);

  } else {
    throw new Error('No engine handler for: "' + tool.engine + '"');
  }

  if (!fs.existsSync(outputPath))
    throw new Error('Output file was not created at: ' + outputPath);

  return outputPath;
}

module.exports = { convert };
