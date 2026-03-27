import { getFileUrl as directusFileUrl } from '../directus'

/**
 * In Directus, files are accessed via /assets/{fileId}.
 * The collection and recordId params are kept for backward compatibility
 * but only fileId (which is the field value) is needed.
 */
export function getFileUrl(_collection: string, _recordId: string, fileId: string): string {
  return directusFileUrl(fileId)
}
