const DB_NAME = 'moviezon-offline-v1'
const STORE = 'videos'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

function opfsSupported(): boolean {
  return typeof navigator.storage?.getDirectory === 'function'
}

async function opfsFile(id: string): Promise<FileSystemFileHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getFileHandle(`${id}.mp4`, { create: true })
}

export async function saveOfflineVideo(id: string, blob: Blob): Promise<void> {
  if (opfsSupported()) {
    try {
      const handle = await opfsFile(id)
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch {
      // fall through to IndexedDB
    }
  }

  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(blob, id)
  })
  db.close()
}

/** Stream response body to offline storage without holding the full file in RAM. */
export async function saveOfflineVideoFromResponse(
  id: string,
  response: Response,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const body = response.body
  const contentType = response.headers.get('Content-Type') || 'video/mp4'
  const total = Number(response.headers.get('Content-Length') || 0)

  if (!body) {
    const blob = await response.blob()
    await saveOfflineVideo(id, blob)
    onProgress?.(100)
    return blob
  }

  const reader = body.getReader()
  let received = 0

  const report = () => {
    if (total > 0) {
      onProgress?.(Math.min(100, Math.round((received / total) * 100)))
    }
  }

  if (opfsSupported()) {
    try {
      const handle = await opfsFile(id)
      const writable = await handle.createWritable()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          await writable.write(value)
          received += value.length
          report()
        }
      }
      await writable.close()
      onProgress?.(100)
      return handle.getFile()
    } catch {
      // fall through to IndexedDB blob
    }
  }

  const chunks: BlobPart[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      report()
    }
  }
  const blob = new Blob(chunks, { type: contentType })
  await saveOfflineVideo(id, blob)
  onProgress?.(100)
  return blob
}

export async function getOfflineVideo(id: string): Promise<Blob | null> {
  if (opfsSupported()) {
    try {
      const root = await navigator.storage.getDirectory()
      const handle = await root.getFileHandle(`${id}.mp4`)
      const file = await handle.getFile()
      return file
    } catch {
      // not in OPFS
    }
  }

  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(id)
    request.onsuccess = () => resolve((request.result as Blob) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return blob
}

export async function deleteOfflineVideo(id: string): Promise<void> {
  if (opfsSupported()) {
    try {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(`${id}.mp4`)
    } catch {
      // not in OPFS
    }
  }

  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
  db.close()
}
