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
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 })
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // 多张图片的URL列表
  const mediaUrls = moment?.mediaUrls?.length ? moment.mediaUrls : (moment?.mediaUrl ? [moment.mediaUrl] : [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // 重置图片索引
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
      // 使用当前图片索引的媒体文件
      const mediaUrl = mediaUrls[currentImageIndex]
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
      const fileExtension = moment.mediaType === 'video' ? 'mp4' : 'jpg'
      const imageNumber = mediaUrls.length > 1 ? `_${currentImageIndex + 1}` : ''
      a.download = `${moment.title}-${imageNumber}-${new Date(displayDate).toLocaleDateString('zh-CN')}.${fileExtension}`
      
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

  // 切换到上一张图片
  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1)
      // 重置缩放和位置
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }

  // 切换到下一张图片
  const goToNextImage = () => {
    if (currentImageIndex < mediaUrls.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
      // 重置缩放和位置
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }

  // 键盘导航支持
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPreviousImage()
    } else if (e.key === 'ArrowRight') {
      goToNextImage()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // 防止Ctrl+滚轮缩放浏览器
    if (e.ctrlKey) {
      return
    }
    
    // 计算新的缩放比例
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, scale * delta))
    
    // 获取鼠标相对于图片的位置
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // 转换为图片坐标
    const imageX = (mouseX - position.x) / scale
    const imageY = (mouseY - position.y) / scale
    
    // 计算新的位置，使鼠标位置保持不变
    const newPositionX = mouseX - imageX * newScale
    const newPositionY = mouseY - imageY * newScale
    
    setScale(newScale)
    setPosition({ x: newPositionX, y: newPositionY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // 左键拖拽
      setIsDragging(true)
      setLastPosition({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      // 获取图片容器和图片元素
      const imageContainer = e.currentTarget.parentElement
      const imageElement = imageContainer?.querySelector('img')
      
      if (!imageContainer || !imageElement) return
      
      const containerRect = imageContainer.getBoundingClientRect()
      const imageRect = imageElement.getBoundingClientRect()
      
      // 计算图片在缩放后的实际尺寸
      const scaledWidth = imageRect.width
      const scaledHeight = imageRect.height
      
      // 计算容器尺寸
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height
      
      // 计算最大允许的移动范围
      const maxMoveX = Math.max(0, (scaledWidth - containerWidth) / 2)
      const maxMoveY = Math.max(0, (scaledHeight - containerHeight) / 2)
      
      // 计算新位置
      const newX = e.clientX - lastPosition.x
      const newY = e.clientY - lastPosition.y
      
      // 应用边界限制
      const constrainedX = Math.max(-maxMoveX, Math.min(maxMoveX, newX))
      const constrainedY = Math.max(-maxMoveY, Math.min(maxMoveY, newY))
      
      setPosition({
        x: constrainedX,
        y: constrainedY
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // 触摸事件支持
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > 50
    const isRightSwipe = distanceX < -50
    const isUpSwipe = distanceY > 50
    const isDownSwipe = distanceY < -50

    // 如果是水平滑动，切换图片
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && currentImageIndex < mediaUrls.length - 1) {
        goToNextImage()
      } else if (isRightSwipe && currentImageIndex > 0) {
        goToPreviousImage()
      }
    }
    // 如果是垂直滑动且缩放为1，则重置位置
    else if (scale === 1) {
      if (isUpSwipe || isDownSwipe) {
        setPosition({ x: 0, y: 0 })
      }
    }
  }

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
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
      onKeyDown={handleKeyDown}
      tabIndex={0}
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
                  src={mediaUrls[currentImageIndex]}
                  controls
                  className="max-w-full max-h-full"
                  autoPlay
                />
              ) : (
                // 显示多张图片的轮播
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
                    className="max-w-none transition-transform duration-200"
                    style={{
                      transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    draggable={false}
                  />
                  
                  {/* 图片导航按钮 */}
                  {mediaUrls.length > 1 && (
                    <>
                      {/* 轮播指示器 */}
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm flex items-center space-x-2">
                        <span>{currentImageIndex + 1} / {mediaUrls.length}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-300">使用左右箭头或拖拽切换</span>
                      </div>
                      
                      {/* 上一张按钮 */}
                      {currentImageIndex > 0 && (
                        <button
                          onClick={goToPreviousImage}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-80 text-white p-3 rounded-full hover:bg-opacity-100 transition-all border border-gray-600 shadow-lg z-10"
                          title="上一张 ←"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}
                      
                      {/* 下一张按钮 */}
                      {currentImageIndex < mediaUrls.length - 1 && (
                        <button
                          onClick={goToNextImage}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-80 text-white p-3 rounded-full hover:bg-opacity-100 transition-all border border-gray-600 shadow-lg z-10"
                          title="下一张 →"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                  
                  {/* 缩放控制提示 */}
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                    <span>{Math.round(scale * 100)}%</span>
                    <button 
                      onClick={resetZoom}
                      className="hover:bg-white hover:bg-opacity-20 rounded px-2 py-1 transition-all"
                      title="重置缩放"
                    >
                      🔄
                    </button>
                  </div>
                  
                  {/* 图片索引提示 */}
                  {mediaUrls.length > 1 && (
                    <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                      {currentImageIndex + 1} / {mediaUrls.length}
                    </div>
                  )}
                  
                  {/* 操作提示 */}
                  <div className="absolute bottom-4 right-4 text-white text-xs opacity-60">
                    滚轮/双指缩放 • 拖拽移动 • 左右滑动切换
                  </div>
                </div>
              )}
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

              {/* 操作按钮组 */}
              <div className="pt-6 border-t border-gray-200 space-y-3">
                {/* 下载按钮 - 所有用户可见 */}
                {onDownload && (
                  <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2 border border-gray-600"
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
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-all flex items-center justify-center space-x-2"
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
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-all flex items-center justify-center space-x-2"
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
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-all flex items-center justify-center space-x-2"
                    title="删除"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-sm font-medium">删除</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}