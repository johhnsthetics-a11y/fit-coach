export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function extractStoragePath(value, bucket) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized || !bucket) return ''
  if (!/^https?:\/\//i.test(normalized)) return normalized.replace(/^\/+/, '')

  try {
    const url = new URL(normalized)
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ]
    const marker = markers.find((candidate) => url.pathname.includes(candidate))
    return marker ? decodeURIComponent(url.pathname.split(marker)[1] || '').replace(/^\/+/, '') : ''
  } catch {
    return ''
  }
}

export function collectStorageObjects(rows = []) {
  const seen = new Set()
  const objects = []

  for (const row of Array.isArray(rows) ? rows : []) {
    const bucket = typeof row?.bucket_id === 'string' ? row.bucket_id.trim() : ''
    const path = extractStoragePath(row?.storage_value, bucket)
    const key = `${bucket}/${path}`
    if (!bucket || !path || seen.has(key)) continue
    seen.add(key)
    objects.push({ bucket, path })
  }

  return objects
}
