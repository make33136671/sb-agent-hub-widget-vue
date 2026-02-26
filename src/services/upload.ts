import { getConfig } from '../config'

export interface UploadResponse {
  fileName: string
  absfileName: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  type: string
  data: T
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${getConfig().baseURL}/api/Upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`上传失败: HTTP ${response.status}`)
  }

  const result: ApiResponse<UploadResponse> = await response.json()

  if (result.code !== 0) {
    throw new Error(result.message || '上传失败')
  }

  return result.data
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      reject(new Error('无法读取图片尺寸'))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

export default {
  uploadFile,
  getImageDimensions,
}
