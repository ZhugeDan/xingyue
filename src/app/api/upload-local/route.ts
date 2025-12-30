import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '没有文件上传' }, { status: 400 })
    }

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 })
    }

    // 检查文件大小 (100MB 限制)
    const maxSize = 100 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '文件大小超过 100MB 限制' }, { status: 400 })
    }

    // 创建 uploads 目录
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    try {
      await fs.access(uploadsDir)
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true })
    }

    // 生成唯一文件名
    const fileExtension = path.extname(file.name)
    const fileName = `${randomUUID()}${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fs.writeFile(filePath, buffer)

    // 返回文件 URL
    const fileUrl = `/uploads/${fileName}`

    return NextResponse.json({ 
      success: true, 
      url: fileUrl,
      originalName: file.name,
      size: file.size,
      type: file.type
    })

  } catch (error) {
    console.error('本地文件上传错误:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}