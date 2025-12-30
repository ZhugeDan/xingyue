'use client'

import { useState, useRef } from 'react'
import { Upload, Image, Video, Lock, Check, AlertCircle } from 'lucide-react'

interface UploadState {
  file: File | null
  fileUrl: string
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
    file: null,
    fileUrl: '',
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setState(prev => ({ ...prev, file, error: '', success: '' }))
    }
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





  const submitMoment = async (mediaUrl: string) => {
    try {
      setState(prev => ({ ...prev, uploadingToAPI: true, error: '' }))

      const response = await fetch('/api/moments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: state.title || '未命名记录',
          description: state.description || `上传于 ${new Date().toLocaleString('zh-CN')}`,
          mediaType: state.file?.type.startsWith('video/') ? 'video' : 'photo',
          mediaUrl: mediaUrl,
          date: new Date().toISOString()
        }),
      })

      if (!response.ok) {
        throw new Error('保存记录失败')
      }

      // 如果已经设置了本地存储成功消息，就不覆盖
      const successMessage = state.usingLocalStorage 
        ? '记录上传成功！文件已保存到本地存储。'
        : '记录上传成功！'

      setState(prev => ({
        ...prev,
        uploadingToAPI: false,
        success: successMessage,
        file: null,
        fileUrl: '',
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

    if (!state.file) {
      setState(prev => ({ ...prev, error: '请选择要上传的文件' }))
      return
    }

    // 标题和描述都是可选的，不需要验证

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

      let mediaUrl: string
      let usedLocalStorage = false

      try {
        // 步骤1: 首先尝试上传到腾讯云COS
        mediaUrl = await uploadToCOS(state.file)
        setState(prev => ({ ...prev, uploadingToCOS: false, fileUrl: mediaUrl }))
      } catch (cosError) {
        console.error('COS上传失败，切换到本地存储:', cosError)
        
        // COS上传失败，切换到本地存储
        setState(prev => ({ 
          ...prev, 
          uploadingToCOS: false,
          uploadingToLocal: true,
          usingLocalStorage: true
        }))
        
        try {
          mediaUrl = await uploadToLocal(state.file)
          setState(prev => ({ ...prev, uploadingToLocal: false, fileUrl: mediaUrl }))
          usedLocalStorage = true
        } catch (localError) {
          console.error('本地存储也失败了:', localError)
          throw new Error('云端和本地存储都失败了，请稍后重试')
        }
      }
      
      // 步骤2: 保存到moments.json
      setState(prev => ({ ...prev, uploadingToAPI: true }))
      await submitMoment(mediaUrl)

      // 显示存储位置信息
      if (usedLocalStorage) {
        setState(prev => ({ 
          ...prev, 
          success: '记录上传成功！文件已保存到本地存储。'
        }))
      }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📸 上传成长记录
          </h1>
          <p className="text-gray-600">
            分享珍贵的成长瞬间
          </p>
        </div>

        {/* 上传表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 文件选择 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              选择照片或视频
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-pink-400 transition-colors"
            >
              {state.file ? (
                <div className="space-y-3">
                  {state.file.type.startsWith('image/') ? (
                    <div className="relative">
                      <img
                        src={URL.createObjectURL(state.file)}
                        alt="预览"
                        className="w-full h-48 object-cover rounded-lg shadow-md"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Video className="w-12 h-12 text-blue-500 mx-auto" />
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        视频文件
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">
                      {state.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(state.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-500">
                    点击选择文件
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 说明信息 */}
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
            disabled={state.uploading}
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
                <span>上传记录</span>
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