import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

export interface UploadResult { storagePath: string; storageUrl: string }

/**
 * Uploads a file to Firebase Storage under documents/{uid}/{timestamp}_{filename}.
 * Calls onProgress(0-100) during upload.
 */
export function uploadVaultFile(
  uid: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const storagePath = `documents/${uid}/${Date.now()}_${file.name}`
    const task = uploadBytesResumable(ref(storage, storagePath), file)
    task.on(
      'state_changed',
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        const storageUrl = await getDownloadURL(task.snapshot.ref)
        resolve({ storagePath, storageUrl })
      }
    )
  })
}

/** Deletes a file from Firebase Storage by its storagePath. */
export async function deleteVaultFile(storagePath: string): Promise<void> {
  await deleteObject(ref(storage, storagePath))
}
