import sharp from 'sharp'
import { mkdir } from 'fs/promises'

await mkdir('public/icons', { recursive: true })

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="80" fill="#1A3766"/>
  <text x="256" y="340" font-family="Arial" font-size="220" font-weight="bold" fill="#F97316" text-anchor="middle">TS</text>
</svg>`

await sharp(Buffer.from(svg)).resize(192, 192).toFile('public/icons/icon-192.png')
await sharp(Buffer.from(svg)).resize(512, 512).toFile('public/icons/icon-512.png')
console.log('Icons generated: public/icons/icon-192.png + icon-512.png')
