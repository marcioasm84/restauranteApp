import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads')
const LOGO_DIR = path.join(UPLOAD_ROOT, 'logos')
fs.mkdirSync(LOGO_DIR, { recursive: true })

// SVG is deliberately excluded — it can carry inline <script>, which would
// run with this app's origin if a logo URL is ever opened directly.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

export const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: LOGO_DIR,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      cb(new Error('Formato de imagem não suportado (use PNG, JPG ou WEBP)'))
      return
    }
    cb(null, true)
  },
}).single('logo')
