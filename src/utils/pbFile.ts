import pb from '../pb'

export function getFileUrl(collection: string, recordId: string, filename: string): string {
  return `${pb.baseUrl}/api/files/${collection}/${recordId}/${filename}`
}
