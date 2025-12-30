'use client'

import { useState } from 'react'
import { Upload, Image, AlertCircle } from 'lucide-react'

interface COSUploadProps {
  onUploadSuccess: (fileUrl: string, fileName: string) => void
  className?: string
  maxSize?: number // MB
  allowedTypes?: string[]
}

interface UploadState {
  uploading: boolean
  progress: number
  error: string
  success: string
}

const COSUpload: React.FC<COSUploadProps> = ({
  onUploadSuccess,
  className = '',
  maxSize = 10,
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi']
}) => {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: '',
    success: ''
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!allowedTypes.includes(file.type)) {
      setState(prev => ({
        ...prev,
        error: `不支持的文件类型。支持类型：${allowedTypes.join(', ')}`
      }))
      return
    }

    // 验证文件大小
    const maxSizeBytes = maxSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setState(prev => ({
        ...prev,
        error: `文件大小超过限制。最大允许 ${maxSize}MB`
      }))
      return
    }

    setSelectedFile(file)
    setState(prev => ({ ...prev, error: '', success: '' }))
  }

  const uploadToCOS = async (file: File): Promise<string> => {
    try {
      // 第一步：获取上传签名URL
      const response = await fetch(`/api/upload/auth?filename=${encodeURIComponent(file.name)}`)
      if (!response.ok) {
        throw new Error('获取上传链接失败')
      }

      const authData = await response.json()
      if (!authData.success) {
        throw new Error(authData.error || '获取上传链接失败')
      }

      const { uploadUrl, fileUrl } = authData

      // 第二步：使用 PUT 方法上传文件到 COS
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file
      })

      if (!uploadResponse.ok) {
        throw new Error('文件上传失败')
      }

      return fileUrl
    } catch (error) {
      console.error('COS 上传错误:', error)
      throw error
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setState(prev => ({ ...prev, error: '请先选择文件' }))
      return
    }

    setState(prev => ({ 
      ...prev, 
      uploading: true, 
      progress: 10,
      error: '', 
      success: '' 
    }))

    try {
      setState(prev => ({ ...prev, progress: 30 }))
      
      const fileUrl = await uploadToCOS(selectedFile)
      
      setState(prev => ({ ...prev, progress: 90 }))
      
      onUploadSuccess(fileUrl, selectedFile.name)
      
      setState(prev => ({ 
        ...prev, 
        progress: 100,
        uploading: false,
        success: '上传成功！' 
      }))

      // 3秒后清空成功消息
      setTimeout(() => {
        setState(prev => ({ ...prev, success: '' }))
      }, 3000)

    } catch (error) {
      setState(prev => ({
        ...prev,
        uploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : '上传失败'
      }))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm ${className}`}>
      <div className="space-y-4">
        {/* 文件选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            选择文件
          </label>
          <div className="relative">
            <input
              type="file"
              onChange={handleFileSelect}
              accept={allowedTypes.join(',')}
              className="hidden"
              id="cos-upload-input"
              disabled={state.uploading}
            />
            <label
              htmlFor="cos-upload-input"
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              } ${state.uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {selectedFile ? (
                <div className="text-center">
                  <Image className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    点击选择文件或拖拽到此处
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    支持图片和视频，最大 {maxSize}MB
                  </p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* 上传按钮 */}
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={state.uploading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              state.uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {state.uploading ? '上传中...' : '开始上传到云端'}
          </button>
        )}

        {/* 进度条 */}
        {state.uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">上传进度</span>
              <span className="text-gray-600">{state.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 状态消息 */}
        {state.error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        {state.success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{state.success}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default COSUpload