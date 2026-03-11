// Generate VAPID key pair for Web Push
// Run: node scripts/generate-vapid.mjs
// Then add the keys as Cloudflare Worker secrets:
//   wrangler secret put VAPID_PRIVATE_KEY
//   wrangler secret put VAPID_PUBLIC_KEY

import crypto from 'node:crypto'

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
})

const rawPublic = publicKey.export({ type: 'spki', format: 'der' })
// SPKI for P-256 has 26-byte header, raw key is last 65 bytes
const rawPublicBytes = rawPublic.slice(-65)
const publicKeyBase64url = Buffer.from(rawPublicBytes)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')

const rawPrivate = privateKey.export({ type: 'pkcs8', format: 'der' })
// PKCS8 for P-256: the 32-byte private key scalar starts at offset 36
const privateKeyBytes = rawPrivate.slice(36, 68)
const privateKeyBase64url = Buffer.from(privateKeyBytes)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')

console.log('VAPID Key Pair Generated')
console.log('========================')
console.log()
console.log('Public Key (base64url, use in frontend + worker):')
console.log(publicKeyBase64url)
console.log()
console.log('Private Key (base64url, keep secret — worker only):')
console.log(privateKeyBase64url)
console.log()
console.log('Add to Cloudflare Worker:')
console.log('  cd workers/push')
console.log('  wrangler secret put VAPID_PRIVATE_KEY   # paste private key')
console.log('  wrangler secret put VAPID_PUBLIC_KEY     # paste public key')
console.log()
console.log('Add public key to PocketBase app_settings:')
console.log('  vapid_public_key = ' + publicKeyBase64url)
