# 星月家庭相册 - 技术文档

## 📋 项目概述

**星月家庭相册**是一个基于Next.js开发的现代化家庭照片/视频分享平台，支持直接上传到腾讯云COS存储，具备权限管理、图片预览、编辑删除等完整功能。

### 🎯 核心特性

- 📱 响应式设计，支持移动端和桌面端
- ☁️ 直接上传到腾讯云COS，无需通过服务器
- 🔐 管理员权限控制
- 🖼️ 图片点击放大预览
- 💾 本地存储备份机制
- ✏️ 照片信息编辑功能
- 🗑️ 照片删除功能
- 📊 按月分组展示
- 🎨 现代化UI设计

## 🛠️ 技术栈

### 前端技术
- **Next.js 16.1.1** - React框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **React 19** - 用户界面库

### 后端技术
- **Next.js API Routes** - 后端API
- **Node.js** - 运行时环境
- **File System** - JSON文件存储

### 云服务
- **腾讯云COS** - 对象存储服务
- **腾讯云SDK** - COS JavaScript SDK

### 开发工具
- **ESLint** - 代码检查
- **PostCSS** - CSS处理
- **Turbopack** - 构建工具

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端界面      │    │   Next.js API   │    │   腾讯云COS     │
│                 │    │                 │    │                 │
│ - React组件     │◄──►│ - 签名生成      │◄──►│ - 文件存储      │
│ - 状态管理      │    │ - 数据管理      │    │ - CDN分发       │
│ - UI交互        │    │ - 权限验证      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   本地存储      │
                    │                 │
                    │ - JSON数据      │
                    │ - 文件备份      │
                    └─────────────────┘
```

## 📁 项目结构

```
diary/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API路由
│   │   │   ├── moments/       # 记忆数据管理
│   │   │   │   ├── route.ts   # GET/POST - 列表和创建
│   │   │   │   └── [id]/      # 动态路由 - 编辑删除
│   │   │   │       └── route.ts
│   │   │   ├── upload/        # 上传相关API
│   │   │   │   ├── auth/      # COS签名生成
│   │   │   │   │   └── route.ts
│   │   │   │   └── local/     # 本地上传备用
│   │   │   │       └── route.ts
│   │   ├── upload/           # 上传页面
│   │   ├── page.tsx          # 主页面
│   │   ├── layout.tsx        # 布局组件
│   │   └── globals.css       # 全局样式
│   ├── components/           # React组件
│   │   ├── ImageModal.tsx    # 图片预览模态框
│   │   ├── PermissionManager.tsx  # 权限管理
│   │   └── COSUpload.tsx     # COS上传组件
│   └── lib/                  # 工具库
├── data/                     # 数据存储
│   └── moments.json          # 记忆数据文件
├── public/                   # 静态资源
│   └── uploads/              # 本地文件备份
├── .env.local               # 环境变量
├── package.json             # 项目配置
├── tailwind.config.ts       # Tailwind配置
├── next.config.ts           # Next.js配置
└── TECHNICAL_DOCUMENTATION.md  # 技术文档
```

## 🔌 API文档

### 记忆数据管理 API

#### 1. 获取所有记忆
```
GET /api/moments
```
**响应示例：**
```json
[
  {
    "id": "m123456789",
    "date": "2025-12-29T12:00:00.000Z",
    "title": "家庭聚餐",
    "description": "今天和家人一起吃饭",
    "mediaType": "photo",
    "mediaUrl": "https://xingyue-1317852266.cos.ap-beijing.myqcloud.com/..."
  }
]
```

#### 2. 创建新记忆
```
POST /api/moments
```
**请求体：**
```json
{
  "title": "标题",
  "description": "描述",
  "mediaType": "photo",
  "mediaUrl": "https://...",
  "date": "2025-12-29T12:00:00.000Z"
}
```

#### 3. 更新记忆
```
PATCH /api/moments/{id}
```
**请求体：**
```json
{
  "title": "新标题",
  "date": "2025-12-29T12:00:00.000Z"
}
```

#### 4. 删除记忆
```
DELETE /api/moments/{id}
```

### 文件上传 API

#### 1. 获取COS签名
```
POST /api/upload/auth
```
**请求体：**
```json
{
  "fileName": "photo.jpg",
  "fileType": "image/jpeg"
}
```
**响应示例：**
```json
{
  "uploadUrl": "https://xingyue-1317852266.cos.ap-beijing.myqcloud.com/...",
  "fileUrl": "https://xingyue-1317852266.cos.ap-beijing.myqcloud.com/..."
}
```

#### 2. 本地存储备用
```
POST /api/upload/local
```
**multipart/form-data** 格式上传文件

## 🧩 核心组件

### ImageModal 组件
```typescript
interface ImageModalProps {
  moment: Moment
  isOpen: boolean
  onClose: () => void
  onDownload: (url: string, filename: string) => void
  canEdit?: boolean
  onEdit?: (moment: Moment) => void
  onDelete?: (moment: Moment) => void
}
```

**功能特性：**
- 图片/视频预览
- 全屏显示模式
- 下载功能
- 管理员编辑删除
- 响应式设计

### PermissionManager 组件
```typescript
interface PermissionManagerProps {
  onPermissionChange: (isAdmin: boolean) => void
}
```

**权限管理：**
- 管理员密码验证 (`xingyue2025`)
- 本地存储状态持久化
- 权限状态实时通知

### COSUpload 组件
```typescript
interface COSUploadProps {
  onUploadSuccess: (data: UploadResult) => void
  onUploadError: (error: string) => void
}
```

## 🔧 配置说明

### 环境变量 (.env.local)
```bash
# 腾讯云COS配置
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
TENCENT_BUCKET=xingyue-1317852266
TENCENT_REGION=ap-beijing
```

### Next.js配置 (next.config.ts)
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Turbopack构建优化
    turbo: {}
  }
}
```

### Tailwind配置 (tailwind.config.ts)
```typescript
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## 🚀 部署指南

### 开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
访问：http://localhost:3000

### 生产环境
```bash
# 构建项目
npm run build

# 启动生产服务器
npm start
```

### 环境配置
1. 确保 `.env.local` 文件配置正确
2. 腾讯云COS存储桶权限设置
3. 域名和SSL证书配置

## 🔐 安全考虑

### 权限控制
- 管理员操作需要密码验证
- 敏感API路由有权限检查
- 前端组件根据权限显示

### 文件安全
- COS存储桶私有访问
- 签名URL临时访问
- 文件类型验证
- 上传大小限制

### 数据安全
- JSON数据定期备份
- 敏感信息不存储在客户端
- API请求参数验证

## 🐛 问题排查

### 常见问题

#### 1. 上传失败 - 403错误
**原因：** COS签名过期或权限不足
**解决：** 
- 检查环境变量配置
- 验证腾讯云COS权限
- 重新生成签名

#### 2. 构建错误 - TypeScript类型错误
**原因：** Next.js版本兼容性
**解决：**
- 更新依赖版本
- 检查类型定义
- 重启开发服务器

#### 3. 图片显示问题
**原因：** COS访问权限或URL错误
**解决：**
- 检查COS存储桶权限设置
- 验证图片URL有效性
- 确认CORS配置

### 调试方法

#### 1. 查看服务器日志
```bash
npm run dev
# 查看控制台输出
```

#### 2. 检查网络请求
- 浏览器开发者工具
- API响应状态码
- 请求/响应数据

#### 3. COS控制台检查
- 存储桶内容
- 访问权限设置
- 流量统计

## 📈 性能优化

### 前端优化
- 图片懒加载
- 组件按需加载
- 状态管理优化
- 缓存策略

### 后端优化
- API响应缓存
- 文件压缩
- 数据库索引优化

### 云存储优化
- CDN加速
- 图片压缩
- 访问频率控制

## 🔮 未来规划

### 功能扩展
- [ ] 用户认证系统
- [ ] 照片标签管理
- [ ] 搜索功能
- [ ] 批量操作
- [ ] 数据导出

### 技术升级
- [ ] 数据库迁移
- [ ] 微服务架构
- [ ] 移动端App
- [ ] AI图片识别

### 性能提升
- [ ] 边缘计算
- [ ] 图片CDN优化
- [ ] 缓存策略升级
- [ ] 监控告警

## 📞 技术支持

如有问题或建议，请通过以下方式联系：
- 查看本文档的"问题排查"章节
- 检查GitHub Issues
- 提交新的Issue

---

**文档版本：** v1.0  
**最后更新：** 2025-12-30  
**适用版本：** Next.js 16.1.1+