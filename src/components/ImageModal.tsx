'use client'

import { useState, useEffect } from 'react'
import { X, Download, Calendar, FileText, Camera, Video } from 'lucide-react'

interface Moment {
  id: string
  date: string
  title: string
  description: string
  mediaType: 'photo' | 'video'
  mediaUrl?: string // 兼容旧格式
  mediaUrls: string[] // 支持多图片
  uploadDate: string // 上传日期
  captureDate?: string // 拍照日期（从EXIF提取）
  exifData?: {
    camera?: string
    lens?: string
    iso?: number
    aperture?: string
    shutterSpeed?: string
  }
}

interface ImageModalProps {
  moment: Moment | null
  isOpen: boolean
  onClose: () => void
  onDownload?: (url: string, filename: string) => void
  canEdit?: boolean
  onEdit?: (moment: Moment) => void
  onDelete?: (moment: Moment) => void
}

export default function ImageModal({ 
  moment, 
  isOpen, 
  onClose, 
  onDownload, 
  canEdit = false,
  onEdit,
  onDelete 
}: ImageModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleDownload = async () => {
    if (!moment || !onDownload) return

    try {
      setIsLoading(true)
      // 使用第一个媒体文件作为主要下载文件
      const mediaUrl = (moment.mediaUrls?.length ? moment.mediaUrls[0] : null) || moment.mediaUrl
      if (!mediaUrl) {
        throw new Error('没有找到媒体文件URL')
      }
      
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      
      // 使用拍摄日期，如果没有则使用上传日期
      const displayDate = moment.captureDate || moment.uploadDate || moment.date
      a.download = `${moment.title}-${new Date(displayDate).toLocaleDateString('zh-CN')}.${moment.mediaType === 'video' ? 'mp4' : 'jpg'}`
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('下载失败:', error)
      alert('下载失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen || !moment) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-7xl max-h-full w-full">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
        >
          <X className="w-6 h-6" />
        </button>



        <div className="flex flex-col lg:flex-row max-h-full">
          {/* 图片/视频区域 */}
          <div className="flex-1 flex flex-col bg-black rounded-lg overflow-hidden">
            {/* 图片/视频主体 */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              {moment.mediaType === 'video' ? (
                <video
                  src={(moment.mediaUrls?.length ? moment.mediaUrls[0] : null) || moment.mediaUrl}
                  controls
                  className="max-w-full max-h-full"
                  autoPlay
                />
              ) : (
                // 显示多张图片的轮播或第一张图片
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={(moment.mediaUrls?.length ? moment.mediaUrls[0] : null) || moment.mediaUrl}
                    alt={moment.title}
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* 如果有多张图片，显示图片数量提示 */}
                  {(moment.mediaUrls?.length || 0) > 1 && (
                    <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                      {moment.mediaUrls?.length || 0} 张图片
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* 操作按钮组 - 居中显示在图片下方 */}
            <div className="flex justify-center p-4 bg-gradient-to-t from-black to-transparent">
              <div className="flex space-x-4">
                {/* 下载按钮 - 所有用户可见 */}
                {onDownload && (
                  <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-full transition-all disabled:opacity-50 flex items-center space-x-2"
                    title="下载"
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-sm font-medium">下载</span>
                  </button>
                )}

                {/* 管理员权限按钮组 */}
                {canEdit ? (
                  <>
                    {/* 编辑按钮 */}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(moment)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full transition-all flex items-center space-x-2"
                        title="修改"
                      >
                        <FileText className="w-5 h-5" />
                        <span className="text-sm font-medium">修改</span>
                      </button>
                    )}

                    {/* 删除按钮 */}
                    {onDelete && (
                      <button
                        onClick={() => {
                          if (confirm('确定要删除这条记录吗？此操作无法撤销。')) {
                            onDelete(moment)
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full transition-all flex items-center space-x-2"
                        title="删除"
                      >
                        <X className="w-5 h-5" />
                        <span className="text-sm font-medium">删除</span>
                      </button>
                    )}
                  </>
                ) : (
                  /* 普通用户删除按钮 */
                  <button
                    onClick={() => {
                      if (confirm('确定要删除这条记录吗？此操作无法撤销。')) {
                        onDelete?.(moment)
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full transition-all flex items-center space-x-2"
                    title="删除"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-sm font-medium">删除</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 信息面板 */}
          <div className="lg:w-80 bg-white rounded-lg p-6 m-4 lg:m-0 lg:rounded-l-none">
            <div className="space-y-4">
              {/* 类型标签 */}
              <div className="flex items-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  moment.mediaType === 'photo' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {moment.mediaType === 'photo' ? (
                    <><Camera className="w-4 h-4 mr-1" /> 照片</>
                  ) : (
                    <><Video className="w-4 h-4 mr-1" /> 视频</>
                  )}
                </span>
              </div>

              {/* 标题 */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{moment.title}</h2>
              </div>

              {/* 拍照日期 */}
              {moment.captureDate && (
                <div className="flex items-center text-gray-600">
                  <Camera className="w-4 h-4 mr-2" />
                  <span className="text-sm">
                    拍摄日期: {new Date(moment.captureDate).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              
              {/* 上传日期 */}
              <div className="flex items-center text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="text-sm">
                  上传日期: {new Date(moment.uploadDate).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* EXIF相机信息 */}
              {moment.exifData && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">相机信息</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    {moment.exifData.camera && (
                      <div>相机: {moment.exifData.camera}</div>
                    )}
                    {moment.exifData.lens && (
                      <div>镜头: {moment.exifData.lens}</div>
                    )}
                    {moment.exifData.iso && (
                      <div>ISO: {moment.exifData.iso}</div>
                    )}
                    {moment.exifData.aperture && (
                      <div>光圈: {moment.exifData.aperture}</div>
                    )}
                    {moment.exifData.shutterSpeed && (
                      <div>快门: {moment.exifData.shutterSpeed}</div>
                    )}
                  </div>
                </div>
              )}

              {/* 描述 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-700 text-sm leading-relaxed">{moment.description}</p>
              </div>

              {/* 图片信息 */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>ID: {moment.id}</div>
                <div>类型: {moment.mediaType}</div>
                <div>图片数量: {moment.mediaUrls?.length || 0}</div>
                {(moment.mediaUrls || []).map((url, index) => (
                  <div key={index}>URL {index + 1}: {url.substring(0, 30)}...</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}