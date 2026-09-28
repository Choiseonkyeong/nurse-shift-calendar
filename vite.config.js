import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// 근무표 사진 인식(Tesseract.js) 엔진·언어 데이터를 앱에 함께 포함한다.
// CDN 에 의존하지 않아 네이티브 앱/오프라인에서도 동작하고, 저장소에 바이너리를 커밋하지 않는다.
const OCR_ASSETS = {
  'ocr/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'ocr/core/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'ocr/core/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ocr/lang/kor.traineddata.gz': 'node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz',
  'ocr/lang/eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'
}

function ocrAssets() {
  return {
    name: 'ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '')
        const src = OCR_ASSETS[key]
        if (!src) return next()
        res.setHeader('Content-Type', key.endsWith('.js') ? 'application/javascript' : 'application/octet-stream')
        fs.createReadStream(path.resolve(src)).pipe(res)
      })
    },
    generateBundle() {
      for (const [fileName, src] of Object.entries(OCR_ASSETS)) {
        this.emitFile({ type: 'asset', fileName, source: fs.readFileSync(path.resolve(src)) })
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), ocrAssets()],
})
