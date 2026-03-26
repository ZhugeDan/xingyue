'use client'

import { useState, useEffect } from 'react'
import { X, Download, Calendar, FileText, Camera, Video, Trash2, Edit3 } from 'lucide-react'

interface Moment {
  id: string
  date: string
  title: string
  description: string
  mediaType: 'photo' | 'video'
  mediaUrl?: string
  mediaUrls?: string[]
  uploadDate?: string
  captureDate?: string
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
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 })
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const mediaUrls = moment?.mediaUrls?.length ? moment.mediaUrls : (moment?.mediaUrl ? [moment.mediaUrl] : [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setCurrentImageIndex(0)
      setScale(1)
      setPosition({ x: 0, y: 0 })
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
      const mediaUrl = mediaUrls[currentImageIndex]
      if (!mediaUrl) throw new Error('没有找到媒体文件URL')
      
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      
      const displayDate = moment.captureDate || moment.uploadDate || moment.date
      const fileExtension = moment.mediaType === 'video' ? 'mp4' : 'jpg'
      const imageNumber = mediaUrls.length > 1 ? `_${currentImageIndex + 1}` : ''
      a.download = `${moment.title}${imageNumber}_${new Date(displayDate).toLocaleDateString('zh-CN').replace(/\//g, '-')}.${fileExtension}`
      
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

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1)
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }

  const goToNextImage = () => {
    if (currentImageIndex < mediaUrls.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPreviousImage()
    else if (e.key === 'ArrowRight') goToNextImage()
    else if (e.key === 'Escape') onClose()
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.ctrlKey) return
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, scale * delta))
    
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const imageX = (mouseX - position.x) / scale
    const imageY = (mouseY - position.y) / scale
    
    const newPositionX = mouseX - imageX * newScale
    const newPositionY = mouseY - imageY * newScale
    
    setScale(newScale)
    setPosition({ x: newPositionX, y: newPositionY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setLastPosition({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const imageContainer = e.currentTarget.parentElement
      const imageElement = imageContainer?.querySelector('img')
      if (!imageContainer || !imageElement) return
      
      const containerRect = imageContainer.getBoundingClientRect()
      const imageRect = imageElement.getBoundingClientRect()
      
      const scaledWidth = imageRect.width
      const scaledHeight = imageRect.height
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height
      
      const maxMoveX = Math.max(0, (scaledWidth - containerWidth) / 2)
      const maxMoveY = Math.max(0, (scaledHeight - containerHeight) / 2)
      
      const newX = e.clientX - lastPosition.x
      const newY = e.clientY - lastPosition.y
      
      const constrainedX = Math.max(-maxMoveX, Math.min(maxMoveX, newX))
      const constrainedY = Math.max(-maxMoveY, Math.min(maxMoveY, newY))
      
      setPosition({ x: constrainedX, y: constrainedY })
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > 50
    const isRightSwipe = distanceX < -50
    const isUpSwipe = distanceY > 50
    const isDownSwipe = distanceY < -50

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && currentImageIndex < mediaUrls.length - 1) goToNextImage()
      else if (isRightSwipe && currentImageIndex > 0) goToPreviousImage()
    } else if (scale === 1 && (isUpSwipe || isDownSwipe)) {
      setPosition({ x: 0, y: 0 })
    }
  }

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleDeleteClick = () => {
    if (!moment) return
    if (confirm('确定要删除这条记录吗？此操作无法撤销。')) {
      onDelete?.(moment)
    }
  }

  if (!isOpen || !moment) return null

  return (
    <div 
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="w-full h-full flex flex-col lg:flex-row">
        {/* 图片/视频区域 - 占据主要空间 */}
        <div className="flex-1 flex items-center justify-center relative bg-black min-h-[50vh] lg:min-h-full">
          {moment.mediaType === 'video' ? (
            <video
              src={mediaUrls[currentImageIndex]}
              controls
              className="max-w-full max-h-full"
              autoPlay
            />
          ) : (
            <div 
              className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-move"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={mediaUrls[currentImageIndex]}
                alt={`${moment.title} - 图片 ${currentImageIndex + 1}`}
                className="max-w-none transition-transform duration-200 select-none"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
              
              {/* 图片导航 */}
              {mediaUrls.length > 1 && (
                <>
                  {/* 顶部指示器 */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm">
                    {currentImageIndex + 1} / {mediaUrls.length}
                  </div>
                  
                  {/* 左右切换按钮 */}
                  {currentImageIndex > 0 && (
                    <button
                      onClick={goToPreviousImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {currentImageIndex < mediaUrls.length - 1 && (
                    <button
                      onClick={goToNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )}
              
              {/* 缩放提示 */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <span>{Math.round(scale * 100)}%</span>
                {scale !== 1 && (
                  <button 
                    onClick={resetZoom}
                    className="hover:text-blue-300 transition-colors"
                  >
                    重置
                  </button>
                )}
              </div>
              
              {/* 操作提示 */}
              <div className="absolute bottom-4 right-4 text-white/50 text-xs">
                滚轮缩放 · 拖拽移动
              </div>
            </div>
          )}
        </div>

        {/* 信息面板 - 更紧凑的设计 */}
        <div className="w-full lg:w-80 bg-white flex flex-col max-h-[50vh] lg:max-h-full overflow-hidden">
          {/* 滚动区域 */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* 类型标签 */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                moment.mediaType === 'photo' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-purple-50 text-purple-600'
              }`}>
                {moment.mediaType === 'photo' ? (
                  <><Camera className="w-3.5 h-3.5 mr-1.5" /> 照片</>
                ) : (
                  <><Video className="w-3.5 h-3.5 mr-1.5" /> 视频</>
                )}
              </span>
              {mediaUrls.length > 1 && (
                <span className="text-xs text-gray-400">
                  共 {mediaUrls.length} 张
                </span>
              )}
            </div>

            {/* 标题 */}
            <h2 className="text-xl font-bold text-gray-900 mb-4">{moment.title}</h2>

            {/* 日期信息 */}
            <div className="space-y-2 mb-4">
              {moment.captureDate && (
                <div className="flex items-center text-sm text-gray-600">
                  <Camera className="w-4 h-4 mr-2 text-gray-400" />
                  <span>拍摄于 {new Date(moment.captureDate).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
              )}
              
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span>上传于 {new Date(moment.uploadDate || moment.date).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
            </div>

            {/* 描述 */}
            {moment.description && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-gray-700 text-sm leading-relaxed">{moment.description}</p>
              </div>
            )}

            {/* EXIF相机信息 */}
            {moment.exifData && (moment.exifData.camera || moment.exifData.lens) && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">拍摄设备</h4>
                <div className="text-sm text-gray-600 space-y-1.5">
                  {moment.exifData.camera && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">相机</span>
                      <span>{moment.exifData.camera}</span>
                    </div>
                  )}
                  {moment.exifData.lens && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">镜头</span>
                      <span>{moment.exifData.lens}</span>
                    </div>
                  )}
                  {(moment.exifData.iso || moment.exifData.aperture || moment.exifData.shutterSpeed) && (
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100">
                      {moment.exifData.iso && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">ISO {moment.exifData.iso}</span>
                      )}
                      {moment.exifData.aperture && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{moment.exifData.aperture}</span>
                      )}
                      {moment.exifData.shutterSpeed && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{moment.exifData.shutterSpeed}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 底部操作按钮 */}
          <div className="border-t border-gray-100 p-4 space-y-2 bg-white">
            {/* 下载按钮 */}
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isLoading ? '下载中...' : '下载'}
            </button>

            {/* 管理员按钮组 */}
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(moment)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                编辑
              </button>
            )}

            {/* 删除按钮 */}
            <button
              onClick={handleDeleteClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
