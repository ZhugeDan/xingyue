'use client'

import { useState, useRef } from 'react'
import { Upload, Image, Video, Lock, Check, AlertCircle, X, Camera, Calendar } from 'lucide-react'
import { readExifData, extractCaptureDate, extractCameraInfo } from '@/lib/exif-reader'

interface FileWithExif {
  file: File
  exifData: any
  captureDate: string | null
  cameraInfo: any
  previewUrl: string
  uploadUrl: string | null
}

interface UploadState {
  files: FileWithExif[]
  uploading: boolean
  uploadingToCOS: boolean
  uploadingToAPI: boolean
  uploadingToLocal: boolean
  usingLocalStorage: boolean
  error: string
  success: string
  securityCode: string
  title: string
  description: string
}

export default function UploadPage() {
  const [state, setState] = useState<UploadState>({
    files: [],
    uploading: false,
    uploadingToCOS: false,
    uploadingToAPI: false,
    uploadingToLocal: false,
    usingLocalStorage: false,
    error: '',
    success: '',
    securityCode: '',
    title: '',
    description: ''
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const filePromises = Array.from(files).map(async (file) => {
        const exifData = await readExifData(file)
        const captureDate = extractCaptureDate(exifData)
        const cameraInfo = extractCameraInfo(exifData)
        
        return {
          file,
          exifData,
          captureDate,
          cameraInfo,
          previewUrl: URL.createObjectURL(file),
          uploadUrl: null
        } as FileWithExif
      })

      try {
        const filesWithExif = await Promise.all(filePromises)
        setState(prev => ({ 
          ...prev, 
          files: [...prev.files, ...filesWithExif], 
          error: '', 
          success: '' 
        }))
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          error: '读取文件信息失败' 
        }))
      }
    }
  }

  const removeFile = (index: number) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }))
  }

  const getMediaType = (file: File): 'photo' | 'video' => {
    return file.type.startsWith('video/') ? 'video' : 'photo'
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
      try {
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
            'Access-Control-Allow-Origin': '*',
          },
          body: file,
          mode: 'cors' // 显式设置CORS模式
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('COS上传响应错误:', errorText)
          throw new Error(`COS上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`)
        }
      } catch (fetchError) {
        console.error('COS网络请求错误:', fetchError)
        if (fetchError instanceof TypeError && fetchError.message.includes('CORS')) {
          throw new Error('COS存储桶CORS配置问题，请检查腾讯云控制台设置')
        }
        throw fetchError
      }

      return fileUrl
    } catch (error) {
      console.error('COS 签名上传错误:', error)
      throw new Error('云端签名上传失败')
    }
  }

  const uploadToLocal = async (file: File): Promise<string> => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/local', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('本地上传失败')
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || '本地上传失败')
      }

      return data.fileUrl
    } catch (error) {
      console.error('本地上传错误:', error)
      throw new Error('本地存储上传失败')
    }
  }

  const submitMoment = async (mediaUrls: string[]) => {
    try {
      setState(prev => ({ ...prev, uploadingToAPI: true, error: '' }))

      const mainFile = state.files[0]
      const mediaType = getMediaType(mainFile.file)
      const uploadDate = new Date().toISOString()

      // 构建请求数据
      const momentData = {
        title: state.title || '未命名记录',
        description: state.description || `上传于 ${new Date().toLocaleString('zh-CN')}`,
        mediaType,
        mediaUrls,
        uploadDate,
        captureDate: mainFile.captureDate || undefined,
        exifData: mainFile.cameraInfo || undefined
      }

      const response = await fetch('/api/moments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(momentData),
      })

      if (!response.ok) {
        throw new Error('保存记录失败')
      }

      // 如果已经设置了本地存储成功消息，就不覆盖
      const successMessage = state.usingLocalStorage 
        ? `成功上传 ${state.files.length} 个文件！记录已保存到本地存储。`
        : `成功上传 ${state.files.length} 个文件！记录保存成功。`

      setState(prev => ({
        ...prev,
        uploadingToAPI: false,
        success: successMessage,
        files: [],
        title: '',
        description: '',
        securityCode: '',
        usingLocalStorage: false
      }))

      // 清空文件选择
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        uploadingToAPI: false,
        error: error instanceof Error ? error.message : '未知错误'
      }))
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    // 安全验证
    if (state.securityCode !== '127') {
      setState(prev => ({ ...prev, error: '暗号错误，请重新输入' }))
      return
    }

    if (state.files.length === 0) {
      setState(prev => ({ ...prev, error: '请选择要上传的文件' }))
      return
    }

    try {
      setState(prev => ({ 
        ...prev, 
        uploading: true, 
        uploadingToCOS: true,
        uploadingToAPI: false,
        uploadingToLocal: false,
        usingLocalStorage: false,
        error: '', 
        success: '' 
      }))

      const mediaUrls: string[] = []
      let usedLocalStorage = false

      // 上传所有文件
      for (let i = 0; i < state.files.length; i++) {
        const fileWithExif = state.files[i]
        let mediaUrl: string

        try {
          // 步骤1: 首先尝试上传到腾讯云COS
          mediaUrl = await uploadToCOS(fileWithExif.file)
        } catch (cosError) {
          console.error(`文件 ${i + 1} COS上传失败，切换到本地存储:`, cosError)
          
          // COS上传失败，切换到本地存储
          if (i === 0) {
            setState(prev => ({ 
              ...prev, 
              uploadingToCOS: false,
              uploadingToLocal: true,
              usingLocalStorage: true
            }))
          }
          
          try {
            mediaUrl = await uploadToLocal(fileWithExif.file)
            usedLocalStorage = true
          } catch (localError) {
            console.error(`文件 ${i + 1} 本地存储也失败了:`, localError)
            throw new Error(`文件 ${fileWithExif.file.name} 上传失败`)
          }
        }

        mediaUrls.push(mediaUrl)
        
        // 更新已上传的文件状态
        setState(prev => ({
          ...prev,
          files: prev.files.map((f, index) => 
            index === i ? { ...f, uploadUrl: mediaUrl } : f
          )
        }))
      }
      
      // 步骤2: 保存到moments.json
      setState(prev => ({ ...prev, uploadingToAPI: true }))
      await submitMoment(mediaUrls)

    } catch (error) {
      setState(prev => ({
        ...prev,
        uploading: false,
        uploadingToCOS: false,
        uploadingToAPI: false,
        uploadingToLocal: false,
        error: error instanceof Error ? error.message : '上传失败'
      }))
    }
  }

  const getUploadProgress = () => {
    if (!state.uploading) return 0
    if (state.uploadingToCOS) return 25
    if (state.uploadingToLocal) return 50
    if (state.uploadingToAPI) return 90
    return 100
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '未知'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📸 上传成长记录
          </h1>
          <p className="text-gray-600">
            支持多图片上传，自动识别拍摄日期和相机信息
          </p>
        </div>

        {/* 上传表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 文件选择 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              选择照片或视频 <span className="text-gray-400">(可选择多个文件)</span>
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-pink-400 transition-colors"
            >
              {state.files.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {state.files.map((fileWithExif, index) => (
                    <div key={index} className="relative group">
                      <div className="relative">
                        {fileWithExif.file.type.startsWith('image/') ? (
                          <img
                            src={fileWithExif.previewUrl}
                            alt={`预览 ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg shadow-md"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Video className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(index)
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-xs space-y-1">
                        <p className="truncate text-gray-900" title={fileWithExif.file.name}>
                          {fileWithExif.file.name}
                        </p>
                        <p className="text-gray-500">{formatFileSize(fileWithExif.file.size)}</p>
                        {fileWithExif.captureDate && (
                          <p className="text-blue-600 flex items-center">
                            <Camera className="w-3 h-3 mr-1" />
                            拍摄: {formatDate(fileWithExif.captureDate)}
                          </p>
                        )}
                        {fileWithExif.cameraInfo.camera && (
                          <p className="text-gray-600">{fileWithExif.cameraInfo.camera}</p>
                        )}
                        {fileWithExif.uploadUrl && (
                          <p className="text-green-600">✓ 已上传</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center hover:border-pink-400 transition-colors">
                    <div className="text-center text-gray-400">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">添加更多</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-500">
                    点击选择文件（支持多选）
                  </p>
                  <p className="text-xs text-gray-400">
                    支持 JPG, PNG, HEIC, MP4 等格式
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />
          </div>

          {/* EXIF信息说明 */}
          {state.files.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-medium text-blue-800">EXIF数据信息</h3>
              </div>
              <p className="text-xs text-blue-700 mb-2">
                系统将自动读取图片的拍摄日期和相机信息，帮助您更好地整理记录。
              </p>
              {state.files.some(f => f.captureDate) && (
                <div className="text-xs text-blue-600">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  已识别到拍摄日期信息
                </div>
              )}
            </div>
          )}

          {/* 存储信息 */}
          <div className={`border rounded-xl p-4 ${
            state.usingLocalStorage 
              ? 'bg-orange-50 border-orange-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              {state.usingLocalStorage ? (
                <Image className="w-5 h-5 text-orange-600" />
              ) : (
                <Image className="w-5 h-5 text-blue-600" />
              )}
              <h3 className={`text-sm font-medium ${
                state.usingLocalStorage 
                  ? 'text-orange-800' 
                  : 'text-blue-800'
              }`}>
                {state.usingLocalStorage ? '本地存储模式' : '直接云端存储'}
              </h3>
            </div>
            <p className={`text-xs ${
              state.usingLocalStorage 
                ? 'text-orange-700' 
                : 'text-blue-700'
            }`}>
              {state.usingLocalStorage 
                ? '文件将保存到应用服务器的本地存储中。如果云端存储不可用，系统会自动切换到本地存储。'
                : '文件将直接上传到腾讯云COS，不经过应用服务器，确保更快更稳定的上传体验。'
              }
            </p>
          </div>

          {/* 标题输入 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              记录标题 <span className="text-gray-400">(可选)</span>
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => setState(prev => ({ ...prev, title: e.target.value }))}
              placeholder="例如：第一次学会走路"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          {/* 描述输入 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              记录描述 <span className="text-gray-400">(可选)</span>
            </label>
            <textarea
              value={state.description}
              onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
              placeholder="记录这个特殊时刻的点点滴滴..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 暗号输入 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Lock className="w-4 h-4 inline mr-1" />
              上传暗号
            </label>
            <input
              type="password"
              value={state.securityCode}
              onChange={(e) => setState(prev => ({ ...prev, securityCode: e.target.value }))}
              placeholder="请输入上传暗号"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              需要正确的暗号才能上传记录
            </p>
          </div>

          {/* 进度条 */}
          {state.uploading && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  上传进度
                </span>
                <span className="text-sm text-gray-500">
                  {getUploadProgress()}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-pink-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getUploadProgress()}%` }}
                />
              </div>
              <div className="mt-2 space-y-1">
                {state.uploadingToCOS && (
                  <p className="text-xs text-blue-600">正在上传到腾讯云COS...</p>
                )}
                {state.uploadingToLocal && (
                  <p className="text-xs text-orange-600">正在保存到本地存储...</p>
                )}
                {state.uploadingToAPI && (
                  <p className="text-xs text-green-600">正在保存记录...</p>
                )}
                {getUploadProgress() === 100 && !state.uploadingToAPI && !state.uploadingToCOS && !state.uploadingToLocal && (
                  <p className="text-xs text-green-600">上传完成！</p>
                )}
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {state.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          {/* 成功提示 */}
          {state.success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700">{state.success}</p>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={state.uploading || state.files.length === 0}
            className="w-full bg-gradient-to-r from-pink-500 to-blue-500 text-white font-medium py-4 px-6 rounded-xl hover:from-pink-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {state.uploading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>上传中...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>上传记录 {state.files.length > 0 ? `(${state.files.length}个文件)` : ''}</span>
              </div>
            )}
          </button>
        </form>

        {/* 返回按钮 */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span>←</span>
            <span>返回首页</span>
          </a>
        </div>
      </div>
    </div>
  )
}