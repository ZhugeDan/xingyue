'use client'

import { useState, useEffect } from 'react'
import { Settings, Shield, User } from 'lucide-react'

interface PermissionManagerProps {
  onPermissionChange?: (isAdmin: boolean) => void
}

export default function PermissionManager({ onPermissionChange }: PermissionManagerProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // 管理员密码（简单实现，实际应该用更安全的方案）
  const ADMIN_PASSWORD = 'xingyue2025' // 建议后续改为环境变量

  useEffect(() => {
    const savedAdminStatus = localStorage.getItem('isAdmin') === 'true'
    setIsAdmin(savedAdminStatus)
    if (onPermissionChange) {
      onPermissionChange(savedAdminStatus)
    }
  }, [])

  const handlePermissionToggle = () => {
    if (isAdmin) {
      // 如果是管理员，直接降级为普通用户
      setIsAdmin(false)
      localStorage.setItem('isAdmin', 'false')
      if (onPermissionChange) {
        onPermissionChange(false)
      }
    } else {
      // 如果是普通用户，需要输入密码
      setShowPassword(true)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true)
      localStorage.setItem('isAdmin', 'true')
      setShowPassword(false)
      setPassword('')
      if (onPermissionChange) {
        onPermissionChange(true)
      }
      alert('管理员权限已开启')
    } else {
      alert('密码错误')
      setPassword('')
    }
  }

  const getPermissionText = () => {
    if (isAdmin) {
      return '管理员模式'
    } else {
      return '普通用户模式'
    }
  }

  const getPermissionDescription = () => {
    if (isAdmin) {
      return '可以编辑、删除所有记录'
    } else {
      return '可以查看和下载所有记录'
    }
  }

  return (
    <div className="relative">
      {/* 权限状态指示器 */}
      <div 
        className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-all ${
          isAdmin 
            ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100' 
            : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
        }`}
        onClick={handlePermissionToggle}
        title="点击切换权限模式"
      >
        {isAdmin ? (
          <Shield className="w-5 h-5" />
        ) : (
          <User className="w-5 h-5" />
        )}
        <div>
          <div className="text-sm font-medium">{getPermissionText()}</div>
          <div className="text-xs opacity-75">{getPermissionDescription()}</div>
        </div>
      </div>

      {/* 密码输入模态框 */}
      {showPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">输入管理员密码</h3>
              <button
                onClick={() => setShowPassword(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  管理员密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入管理员密码"
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPassword(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  确认
                </button>
              </div>
            </form>
            
            <div className="mt-4 text-xs text-gray-500">
              <p>提示：管理员密码请联系系统管理员获取</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}