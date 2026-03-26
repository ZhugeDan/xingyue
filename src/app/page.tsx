'use client'

import './globals.css'
import { useState, useEffect } from 'react'
import { Plus, Camera, Video, Loader2, AlertCircle, Heart } from 'lucide-react'
import ImageModal from '../components/ImageModal'
import PermissionManager from '../components/PermissionManager'

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

interface MonthGroup {
  year: number
  month: number
  monthName: string
  representativeImage: Moment
  moments: Moment[]
}

export default function Home() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const handlePermissionChange = (adminStatus: boolean) => {
    setIsAdmin(adminStatus)
  }

  const fetchMoments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/moments')
      if (!response.ok) throw new Error('获取数据失败')
      const data = await response.json()
      setMoments(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const groupMomentsByMonth = (moments: Moment[]): MonthGroup[] => {
    const groups: { [key: string]: Moment[] } = {}
    
    moments.forEach(moment => {
      const dateString = moment.captureDate || moment.uploadDate || moment.date
      const date = new Date(dateString)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!groups[key]) groups[key] = []
      groups[key].push(moment)
    })
    
    const monthGroups: MonthGroup[] = Object.keys(groups)
      .map(key => {
        const [year, month] = key.split('-').map(Number)
        const momentsInMonth = groups[key].sort((a, b) => {
          const dateA = new Date(a.captureDate || a.uploadDate || a.date)
          const dateB = new Date(b.captureDate || b.uploadDate || b.date)
          return dateA.getTime() - dateB.getTime()
        })
        
        if (momentsInMonth.length === 0) return null
        
        const representativeImage = momentsInMonth.find(m => m.mediaType === 'photo') || momentsInMonth[0]
        
        if (!representativeImage || (!representativeImage.mediaUrls?.length && !representativeImage.mediaUrl)) {
          return null
        }
        
        return {
          year,
          month,
          monthName: new Date(year, month - 1).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
          representativeImage,
          moments: momentsInMonth
        }
      })
      .filter((group): group is MonthGroup => group !== null)
    
    return monthGroups.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }

  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([])

  useEffect(() => {
    fetchMoments()
  }, [])

  useEffect(() => {
    if (moments.length > 0) {
      const grouped = groupMomentsByMonth(moments)
      setMonthGroups(grouped)
    }
  }, [moments])

  const openImageModal = (moment: Moment) => {
    setSelectedMoment(moment)
    setIsModalOpen(true)
  }

  const closeImageModal = () => {
    setSelectedMoment(null)
    setIsModalOpen(false)
  }

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (error) {
      console.error('下载失败:', error)
      alert('下载失败，请重试')
    }
  }

  const handleEdit = (moment: Moment) => {
    const newTitle = prompt('编辑标题:', moment.title)
    if (newTitle === null || newTitle.trim() === '') return

    const newDescription = prompt('编辑描述:', moment.description)
    if (newDescription === null || newDescription.trim() === '') return

    const uploadDate = moment.uploadDate || moment.date
    const currentUploadDate = new Date(uploadDate).toISOString().split('T')[0]
    const newUploadDate = prompt('编辑上传日期 (YYYY-MM-DD):', currentUploadDate)
    if (newUploadDate === null || newUploadDate.trim() === '') return

    const captureDate = moment.captureDate
    const currentCaptureDate = captureDate ? new Date(captureDate).toISOString().split('T')[0] : ''
    const newCaptureDateInput = prompt(
      '📸 拍摄日期编辑：\n\n这是照片实际拍摄的日期（不是上传日期）\n格式：YYYY-MM-DD\n当前：' + (currentCaptureDate || '未设置') + '\n\n直接回车保持不变，输入新日期覆盖：', 
      currentCaptureDate
    )
    
    const updates: any = {
      title: newTitle.trim(),
      description: newDescription.trim(),
      date: new Date(newUploadDate + 'T12:00:00Z').toISOString(),
      uploadDate: new Date(newUploadDate + 'T12:00:00Z').toISOString()
    }

    if (newCaptureDateInput && newCaptureDateInput.trim() !== '') {
      updates.captureDate = new Date(newCaptureDateInput + 'T12:00:00Z').toISOString()
    }

    updateMoment(moment.id, updates)
  }

  const updateMoment = async (id: string, updates: Partial<Moment>) => {
    try {
      const response = await fetch(`/api/moments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('更新失败')
      await fetchMoments()
      closeImageModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    }
  }

  const handleDelete = async (moment: Moment) => {
    try {
      const response = await fetch(`/api/moments/${moment.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('删除失败')
      await fetchMoments()
      closeImageModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-blue-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-rose-500 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                成长日记
              </span>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-3">
              <PermissionManager onPermissionChange={handlePermissionChange} />
              <button
                onClick={() => window.location.href = '/upload'}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
                记录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 欢迎语 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            记录成长的每一个瞬间
          </h1>
          <p className="text-gray-500 text-lg">
            已保存 <span className="font-semibold text-pink-500">{moments.length}</span> 个珍贵时刻
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* 加载状态 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
            <span className="mt-4 text-gray-500">加载中...</span>
          </div>
        ) : (
          <>
            {/* 按月分组展示 */}
            <div className="space-y-8">
              {monthGroups.map((monthGroup) => (
                <section key={`${monthGroup.year}-${monthGroup.month}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* 月份标题 */}
                  <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-pink-200 transition-all"
                        onClick={() => openImageModal(monthGroup.representativeImage)}
                      >
                        <img 
                          src={(monthGroup.representativeImage.mediaUrls?.length ? monthGroup.representativeImage.mediaUrls[0] : null) || monthGroup.representativeImage.mediaUrl || '/placeholder-image.jpg'} 
                          alt={monthGroup.representativeImage.title}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{monthGroup.monthName}</h2>
                        <p className="text-sm text-gray-500">
                          {monthGroup.moments.length} 个瞬间
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 该月的所有时刻 */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {monthGroup.moments.map((moment) => (
                        <div 
                          key={moment.id} 
                          className="group bg-gray-50 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300"
                          onClick={() => openImageModal(moment)}
                        >
                          {/* 图片区域 */}
                          <div className="aspect-[4/3] overflow-hidden relative">
                            <img 
                              src={(moment.mediaUrls?.length ? moment.mediaUrls[0] : null) || moment.mediaUrl || '/placeholder-image.jpg'} 
                              alt={moment.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            {/* 类型标签 */}
                            <div className="absolute top-3 right-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                                moment.mediaType === 'photo' 
                                  ? 'bg-white/90 text-blue-600' 
                                  : 'bg-white/90 text-purple-600'
                              }`}>
                                {moment.mediaType === 'photo' ? (
                                  <><Camera className="w-3 h-3 mr-1" /> 照片</>
                                ) : (
                                  <><Video className="w-3 h-3 mr-1" /> 视频</>
                                )}
                              </span>
                            </div>
                            {/* 多张图片标记 */}
                            {(moment.mediaUrls?.length || 0) > 1 && (
                              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs">
                                {moment.mediaUrls?.length} 张
                              </div>
                            )}
                          </div>
                          
                          {/* 信息区域 */}
                          <div className="p-4">
                            <h4 className="font-semibold text-gray-900 mb-1 truncate">{moment.title}</h4>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{moment.description}</p>
                            
                            {/* 日期信息 */}
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              {moment.captureDate && (
                                <span className="flex items-center">
                                  <Camera className="w-3 h-3 mr-1" />
                                  {new Date(moment.captureDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Plus className="w-3 h-3 mr-1" />
                                {new Date(moment.uploadDate || moment.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>

            {/* 空状态 */}
            {moments.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Camera className="w-10 h-10 text-pink-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有记录</h3>
                <p className="text-gray-500 mb-6">开始记录宝宝的成长瞬间吧</p>
                <button
                  onClick={() => window.location.href = '/upload'}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-medium transition-all"
                >
                  <Plus className="w-5 h-5" />
                  添加第一条记录
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 图片预览模态框 */}
      <ImageModal
        moment={selectedMoment}
        isOpen={isModalOpen}
        onClose={closeImageModal}
        onDownload={handleDownload}
        canEdit={isAdmin}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
