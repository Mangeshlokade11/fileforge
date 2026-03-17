'use strict';

const TOOLS = [
  // ═══════════════ PDF ══════════════════════════════════════════
  {
    id: 'compress-pdf', name: 'Compress PDF', category: 'pdf',
    description: 'Shrink PDF file size with quality presets',
    inputExts: ['.pdf'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'ghostscript', multi: false,
    options: [
      { key: 'quality', label: 'Quality preset', type: 'select', default: 'ebook',
        choices: [
          { value: 'screen',  label: 'Screen — smallest (72 dpi)' },
          { value: 'ebook',   label: 'eBook — balanced (150 dpi)' },
          { value: 'printer', label: 'Printer — high (300 dpi)' },
          { value: 'prepress',label: 'Prepress — maximum quality' }
        ] }
    ]
  },
  {
    id: 'merge-pdf', name: 'Merge PDFs', category: 'pdf',
    description: 'Combine 2 or more PDFs into one document',
    inputExts: ['.pdf'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'pdflib', multi: true, minFiles: 2, options: []
  },
  {
    id: 'split-pdf', name: 'Split PDF', category: 'pdf',
    description: 'Extract specific pages into a new PDF',
    inputExts: ['.pdf'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'pdflib', multi: false,
    options: [
      { key: 'pages', label: 'Pages to extract', type: 'text', default: '',
        placeholder: 'e.g. 1-3, 5, 7-9  (blank = all)' }
    ]
  },
  {
    id: 'pdf-to-word', name: 'PDF → Word', category: 'pdf',
    description: 'Convert PDF to editable DOCX format',
    inputExts: ['.pdf'], outputExt: '.docx',
    outputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    engine: 'libreoffice', multi: false, options: []
  },
  {
    id: 'pdf-to-jpg', name: 'PDF → JPG', category: 'pdf',
    description: 'Render PDF pages as high-quality JPG images',
    inputExts: ['.pdf'], outputExt: '.jpg', outputMime: 'image/jpeg',
    engine: 'imagemagick', multi: false,
    options: [
      { key: 'density', label: 'Resolution (DPI)', type: 'select', default: '150',
        choices: [
          { value: '72',  label: '72 dpi — screen / web' },
          { value: '96',  label: '96 dpi — standard screen' },
          { value: '150', label: '150 dpi — balanced (default)' },
          { value: '300', label: '300 dpi — print quality' }
        ] },
      { key: 'quality', label: 'JPEG quality', type: 'range', min: 50, max: 100, default: 90 }
    ]
  },
  {
    id: 'protect-pdf', name: 'Protect PDF', category: 'pdf',
    description: 'Add password protection with AES-128 encryption',
    inputExts: ['.pdf'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'ghostscript', multi: false,
    options: [
      { key: 'userPass',  label: 'User password (opens PDF)',    type: 'password', default: '', placeholder: 'Required to open file' },
      { key: 'ownerPass', label: 'Owner password (edit/print)',  type: 'password', default: '', placeholder: 'Required to edit/print' }
    ]
  },

  // ═══════════════ DOCUMENTS ════════════════════════════════════
  {
    id: 'word-to-pdf', name: 'Word → PDF', category: 'documents',
    description: 'Convert DOCX/DOC files to PDF format',
    inputExts: ['.docx', '.doc'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'libreoffice', multi: false, options: []
  },
  {
    id: 'excel-to-pdf', name: 'Excel → PDF', category: 'documents',
    description: 'Convert XLSX/XLS/CSV spreadsheets to PDF',
    inputExts: ['.xlsx', '.xls', '.csv'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'libreoffice', multi: false, options: []
  },
  {
    id: 'ppt-to-pdf', name: 'PowerPoint → PDF', category: 'documents',
    description: 'Convert PPTX/PPT presentations to PDF',
    inputExts: ['.pptx', '.ppt'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'libreoffice', multi: false, options: []
  },
  {
    id: 'html-to-pdf', name: 'HTML → PDF', category: 'documents',
    description: 'Convert HTML files to PDF documents',
    inputExts: ['.html', '.htm'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'libreoffice', multi: false, options: []
  },
  {
    id: 'txt-to-pdf', name: 'Text → PDF', category: 'documents',
    description: 'Convert plain text files to PDF format',
    inputExts: ['.txt'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'libreoffice', multi: false, options: []
  },
  {
    id: 'csv-to-xlsx', name: 'CSV → Excel', category: 'documents',
    description: 'Convert CSV data to Excel spreadsheet',
    inputExts: ['.csv'], outputExt: '.xlsx',
    outputMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    engine: 'libreoffice', multi: false, options: []
  },

  // ═══════════════ IMAGES ═══════════════════════════════════════
  {
    id: 'compress-image', name: 'Compress Image', category: 'images',
    description: 'Reduce image file size, control JPEG quality',
    inputExts: ['.jpg', '.jpeg', '.png', '.webp'], outputExt: '.jpg', outputMime: 'image/jpeg',
    engine: 'sharp', multi: false,
    options: [
      { key: 'quality', label: 'JPEG quality', type: 'range', min: 10, max: 95, default: 75,
        hint: 'Lower = smaller file. 75 is a good balance.' }
    ]
  },
  {
    id: 'resize-image', name: 'Resize Image', category: 'images',
    description: 'Resize by pixel dimensions or percentage scale',
    inputExts: ['.jpg', '.jpeg', '.png', '.webp', '.gif'], outputExt: '.jpg', outputMime: 'image/jpeg',
    engine: 'sharp', multi: false,
    options: [
      { key: 'resizeMode', label: 'Resize method', type: 'select', default: 'pixels',
        choices: [
          { value: 'pixels',  label: 'By width × height (pixels)' },
          { value: 'percent', label: 'By percentage scale' }
        ] },
      { key: 'width',   label: 'Width (px)',  type: 'number', default: '', placeholder: '800', min: 1, max: 8000, cond: 'resizeMode=pixels' },
      { key: 'height',  label: 'Height (px, optional)', type: 'number', default: '', placeholder: 'auto', min: 1, max: 8000, cond: 'resizeMode=pixels' },
      { key: 'percent', label: 'Scale (%)', type: 'range', min: 5, max: 200, default: 50, cond: 'resizeMode=percent' },
      { key: 'quality', label: 'Output quality', type: 'range', min: 50, max: 100, default: 85 }
    ]
  },
  {
    id: 'png-to-jpg', name: 'PNG → JPG', category: 'images',
    description: 'Convert PNG images to JPG with quality control',
    inputExts: ['.png'], outputExt: '.jpg', outputMime: 'image/jpeg',
    engine: 'sharp', multi: false,
    options: [
      { key: 'quality', label: 'JPEG quality', type: 'range', min: 50, max: 100, default: 90 }
    ]
  },
  {
    id: 'jpg-to-png', name: 'JPG → PNG', category: 'images',
    description: 'Convert JPG to lossless PNG format',
    inputExts: ['.jpg', '.jpeg'], outputExt: '.png', outputMime: 'image/png',
    engine: 'sharp', multi: false,
    options: [
      { key: 'compressionLevel', label: 'PNG compression (1=fast · 9=smallest)', type: 'range', min: 1, max: 9, default: 6 }
    ]
  },
  {
    id: 'jpg-to-webp', name: 'Image → WebP', category: 'images',
    description: 'Convert JPG/PNG to modern WebP format',
    inputExts: ['.jpg', '.jpeg', '.png'], outputExt: '.webp', outputMime: 'image/webp',
    engine: 'sharp', multi: false,
    options: [
      { key: 'quality',  label: 'WebP quality', type: 'range', min: 50, max: 100, default: 82 },
      { key: 'lossless', label: 'Lossless mode', type: 'checkbox', default: false }
    ]
  },
  {
    id: 'jpg-to-pdf', name: 'Image → PDF', category: 'images',
    description: 'Convert JPG/PNG images to PDF document',
    inputExts: ['.jpg', '.jpeg', '.png'], outputExt: '.pdf', outputMime: 'application/pdf',
    engine: 'imagemagick', multi: false,
    options: [
      { key: 'quality', label: 'JPEG quality in PDF', type: 'range', min: 50, max: 100, default: 90 }
    ]
  },

  // ═══════════════ VIDEO ════════════════════════════════════════
  {
    id: 'mp4-to-mp3', name: 'Video → MP3', category: 'video',
    description: 'Extract audio track from any video as MP3',
    inputExts: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv'], outputExt: '.mp3', outputMime: 'audio/mpeg',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'audioBitrate', label: 'MP3 bitrate', type: 'select', default: '192k',
        choices: [
          { value: '96k',  label: '96 kbps — small file' },
          { value: '128k', label: '128 kbps — standard' },
          { value: '192k', label: '192 kbps — high quality' },
          { value: '320k', label: '320 kbps — maximum' }
        ] }
    ]
  },
  {
    id: 'mp4-to-webm', name: 'MP4 → WebM', category: 'video',
    description: 'Convert MP4 to WebM for browser-native playback',
    inputExts: ['.mp4', '.avi', '.mov', '.mkv'], outputExt: '.webm', outputMime: 'video/webm',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'crf', label: 'Quality (CRF — lower = better)', type: 'range', min: 18, max: 52, default: 33,
        hint: 'CRF 33 is balanced. Lower = larger file but better quality.' }
    ]
  },
  {
    id: 'avi-to-mp4', name: 'Video → MP4', category: 'video',
    description: 'Convert AVI/MOV/MKV/FLV to modern H.264 MP4',
    inputExts: ['.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v'], outputExt: '.mp4', outputMime: 'video/mp4',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'crf', label: 'Quality (CRF)', type: 'range', min: 16, max: 36, default: 22,
        hint: 'CRF 22 is a good default. Lower = better quality but larger file.' },
      { key: 'preset', label: 'Encoding speed', type: 'select', default: 'fast',
        choices: [
          { value: 'ultrafast', label: 'Ultrafast — lower quality' },
          { value: 'fast',      label: 'Fast — recommended' },
          { value: 'medium',    label: 'Medium — balanced' },
          { value: 'slow',      label: 'Slow — best quality' }
        ] }
    ]
  },
  {
    id: 'compress-video', name: 'Compress Video', category: 'video',
    description: 'Reduce video file size using H.264 re-encoding',
    inputExts: ['.mp4', '.avi', '.mov', '.mkv', '.webm'], outputExt: '.mp4', outputMime: 'video/mp4',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'crf', label: 'Compression level (CRF)', type: 'range', min: 18, max: 40, default: 28,
        hint: 'Higher CRF = smaller file, lower quality. 28 is a good starting point.' },
      { key: 'audioBitrate', label: 'Audio bitrate', type: 'select', default: '128k',
        choices: [
          { value: '64k',  label: '64 kbps — small' },
          { value: '96k',  label: '96 kbps' },
          { value: '128k', label: '128 kbps — standard' },
          { value: '192k', label: '192 kbps — high' }
        ] }
    ]
  },

  // ═══════════════ AUDIO ════════════════════════════════════════
  {
    id: 'mp3-to-wav', name: 'Audio → WAV', category: 'audio',
    description: 'Convert MP3/OGG/FLAC/AAC to uncompressed WAV',
    inputExts: ['.mp3', '.ogg', '.flac', '.aac', '.m4a'], outputExt: '.wav', outputMime: 'audio/wav',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'sampleRate', label: 'Sample rate', type: 'select', default: '44100',
        choices: [
          { value: '22050', label: '22.05 kHz — small file' },
          { value: '44100', label: '44.1 kHz — CD quality (default)' },
          { value: '48000', label: '48 kHz — professional / video' }
        ] }
    ]
  },
  {
    id: 'wav-to-mp3', name: 'WAV → MP3', category: 'audio',
    description: 'Convert WAV/FLAC/AIFF audio to compressed MP3',
    inputExts: ['.wav', '.flac', '.aiff', '.ogg', '.aac'], outputExt: '.mp3', outputMime: 'audio/mpeg',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'audioBitrate', label: 'MP3 bitrate', type: 'select', default: '192k',
        choices: [
          { value: '96k',  label: '96 kbps — small' },
          { value: '128k', label: '128 kbps — standard' },
          { value: '192k', label: '192 kbps — high quality' },
          { value: '320k', label: '320 kbps — maximum' }
        ] }
    ]
  },
  {
    id: 'flac-to-mp3', name: 'FLAC → MP3', category: 'audio',
    description: 'Convert lossless FLAC audio to MP3',
    inputExts: ['.flac'], outputExt: '.mp3', outputMime: 'audio/mpeg',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'audioBitrate', label: 'MP3 bitrate', type: 'select', default: '320k',
        choices: [
          { value: '128k', label: '128 kbps — standard' },
          { value: '192k', label: '192 kbps — high quality' },
          { value: '256k', label: '256 kbps — very high' },
          { value: '320k', label: '320 kbps — maximum' }
        ] }
    ]
  },
  {
    id: 'compress-audio', name: 'Compress Audio', category: 'audio',
    description: 'Reduce audio file size with smart bitrate reduction',
    inputExts: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'], outputExt: '.mp3', outputMime: 'audio/mpeg',
    engine: 'ffmpeg', multi: false,
    options: [
      { key: 'audioBitrate', label: 'Target bitrate', type: 'select', default: '96k',
        choices: [
          { value: '48k',  label: '48 kbps — maximum compression' },
          { value: '64k',  label: '64 kbps — voice quality' },
          { value: '96k',  label: '96 kbps — balanced (default)' },
          { value: '128k', label: '128 kbps — good quality' }
        ] }
    ]
  }
];

const byId = {};
TOOLS.forEach(t => { byId[t.id] = t; });

module.exports = { TOOLS, byId };
