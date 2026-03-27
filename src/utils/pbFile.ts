import { assetUrl } from '../lib/api'

/**
 * Get a Directus asset URL. The collection/recordId params are kept
 * for backward compat but only fileId is needed.
 */
export function getFileUrl(_collection: string, _recordId: string, fileId: string): string {
  return assetUrl(fileId)
}
