'use client'

import './globals.css'
import { useState, useEffect } from 'react'
import { Plus, Camera, Video, Loader2, AlertCircle } from 'lucide-react'
import ImageModal from '../components/ImageModal'
import PermissionManager from '../components/PermissionManager'

// 类型定义
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

// 按月分组的数据结构
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
  const [isAdmin, setIsAdmin] = useState(false) // 管理员权限状态

  // 权限变化处理
  const handlePermissionChange = (adminStatus: boolean) => {
    setIsAdmin(adminStatus)
  }

  // 获取数据
  const fetchMoments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/moments')
      if (!response.ok) {
        throw new Error('获取数据失败')
      }
      const data = await response.json()
      setMoments(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }



  // 按月分组函数
  const groupMomentsByMonth = (moments: Moment[]): MonthGroup[] => {
    const groups: { [key: string]: Moment[] } = {}
    
    moments.forEach(moment => {
      // 优先使用拍摄日期，其次使用上传日期，最后使用原始日期
      const dateString = moment.captureDate || moment.uploadDate || moment.date
      const date = new Date(dateString)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(moment)
    })
    
    // 转换为 MonthGroup 数组，过滤掉无效的分组
    const monthGroups: MonthGroup[] = Object.keys(groups)
      .map(key => {
        const [year, month] = key.split('-').map(Number)
        const momentsInMonth = groups[key].sort((a, b) => {
          const dateA = new Date(a.captureDate || a.uploadDate || a.date)
          const dateB = new Date(b.captureDate || b.uploadDate || b.date)
          return dateA.getTime() - dateB.getTime() // 从早到晚排序，便于查看成长时间线
        })
        
        // 确保有有效的 moments
        if (momentsInMonth.length === 0) {
          return null
        }
        
        // 选择代表图片：优先选择第一个照片，如果没有照片则选择第一个视频
        const representativeImage = momentsInMonth.find(m => m.mediaType === 'photo') || momentsInMonth[0]
        
        // 确保代表图片有效
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
      .filter((group): group is MonthGroup => group !== null) // TypeScript类型守卫
    
    // 按时间倒序排列（最新的月份在前）
    return monthGroups.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }

  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([])

  useEffect(() => {
    fetchMoments()
  }, [])

  // 当 moments 数据更新时，重新分组
  useEffect(() => {
    if (moments.length > 0) {
      const grouped = groupMomentsByMonth(moments)
      setMonthGroups(grouped)
    }
  }, [moments])

  // 打开图片模态框
  const openImageModal = (moment: Moment) => {
    setSelectedMoment(moment)
    setIsModalOpen(true)
  }

  // 关闭图片模态框
  const closeImageModal = () => {
    setSelectedMoment(null)
    setIsModalOpen(false)
  }

  // 下载图片
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

  // 编辑记录 - 完整的编辑表单
  const handleEdit = (moment: Moment) => {
    // 创建一个自定义的编辑表单
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

    // 只有当用户输入了拍照日期时才更新
    if (newCaptureDateInput && newCaptureDateInput.trim() !== '') {
      updates.captureDate = new Date(newCaptureDateInput + 'T12:00:00Z').toISOString()
    }

    updateMoment(moment.id, updates)
  }

  // 更新记录
  const updateMoment = async (id: string, updates: Partial<Moment>) => {
    try {
      const response = await fetch(`/api/moments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('更新失败')
      }

      // 重新获取数据
      await fetchMoments()
      closeImageModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    }
  }

  // 删除记录
  const handleDelete = async (moment: Moment) => {
    try {
      const response = await fetch(`/api/moments/${moment.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      // 重新获取数据
      await fetchMoments()
      closeImageModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            🌟 成长日记 🌟
          </h1>
          <p className="text-gray-600 mb-6 text-lg">
            记录每一个珍贵的成长瞬间
          </p>
          
          {/* 权限管理 */}
          <div className="mb-6 flex justify-center">
            <PermissionManager onPermissionChange={handlePermissionChange} />
          </div>
          
          <button
            onClick={() => window.location.href = '/upload'}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            家人上传
          </button>
        </div>



        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* 加载状态 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">加载中...</span>
          </div>
        ) : (
          <>
            {/* 按月分组展示 */}
            <div className="space-y-12">
              {monthGroups.map((monthGroup) => (
                <div key={`${monthGroup.year}-${monthGroup.month}`} className="bg-white rounded-xl shadow-lg p-6">
                  {/* 月份标题和代表图片 */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div 
                         className="aspect-square w-24 h-24 rounded-lg overflow-hidden shadow-md cursor-pointer group"
                         onClick={() => openImageModal(monthGroup.representativeImage)}
                         title="点击查看大图"
                       >
                         <img 
                          src={(monthGroup.representativeImage.mediaUrls?.length ? monthGroup.representativeImage.mediaUrls[0] : null) || monthGroup.representativeImage.mediaUrl || '/placeholder-image.jpg'} 
                          alt={monthGroup.representativeImage.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 cursor-zoom-in"
                        />
                       </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800">{monthGroup.monthName}</h2>
                        <p className="text-gray-600">
                          共 {monthGroup.moments.length} 个珍贵瞬间
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        代表图片：{monthGroup.representativeImage.title}
                      </div>
                    </div>
                  </div>
                  
                  {/* 该月的所有时刻 */}
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {monthGroup.moments.map((moment) => (
                       <div 
                         key={moment.id} 
                         className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-all cursor-pointer group"
                         onClick={() => openImageModal(moment)}
                       >
                         <div className="aspect-video overflow-hidden rounded-md mb-3">
                           <img 
                            src={(moment.mediaUrls?.length ? moment.mediaUrls[0] : null) || moment.mediaUrl || '/placeholder-image.jpg'} 
                            alt={moment.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                         </div>
                        <h4 className="font-semibold text-gray-800 mb-1">{moment.title}</h4>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{moment.description}</p>
                        
                        {/* 日期信息显示 */}
                        <div className="space-y-1 mb-3">
                          {moment.captureDate && (
                            <div className="flex items-center text-xs text-blue-600">
                              <Camera className="w-3 h-3 mr-1" />
                              拍摄: {new Date(moment.captureDate).toLocaleDateString('zh-CN', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          )}
                          <div className="flex items-center text-xs text-gray-500">
                            <Plus className="w-3 h-3 mr-1" />
                            上传: {new Date(moment.uploadDate).toLocaleDateString('zh-CN', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {moment.exifData?.camera && (
                              <span className="text-gray-400">{moment.exifData.camera}</span>
                            )}
                          </span>
                          <div className="flex items-center space-x-2">
                            {(moment.mediaUrls?.length || 0) > 1 && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                {moment.mediaUrls?.length || 0}张
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              moment.mediaType === 'photo' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {moment.mediaType === 'photo' ? (
                                <><Camera className="w-3 h-3 mr-1" /> 照片</>
                              ) : (
                                <><Video className="w-3 h-3 mr-1" /> 视频</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 空状态 */}
            {moments.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">还没有记录</h3>
                <p className="text-gray-500">点击上方按钮添加第一个成长记录吧！</p>
              </div>
            )}
            
            {/* 月份分组空状态 */}
            {moments.length > 0 && monthGroups.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🗓️</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">加载中...</h3>
                <p className="text-gray-500">正在整理成长记录...</p>
              </div>
            )}
          </>
        )}

        {/* 项目配置 */}
        <div className="mt-12 bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">📊 项目配置</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="font-semibold text-gray-700">Next.js 16.1.1</div>
              <div className="text-sm text-gray-500">现代化框架</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🎨</div>
              <div className="font-semibold text-gray-700">Tailwind CSS v4</div>
              <div className="text-sm text-gray-500">样式框架</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📱</div>
              <div className="font-semibold text-gray-700">响应式设计</div>
              <div className="text-sm text-gray-500">移动端友好</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔧</div>
              <div className="font-semibold text-gray-700">TypeScript</div>
              <div className="text-sm text-gray-500">类型安全</div>
            </div>
          </div>
        </div>
      </div>

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