import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 })
    }

    // 生成文件名
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'bin'
    const filename = `${year}-${month}-${day}-${timestamp}.${ext}`
    
    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', year.toString(), month)
    try {
      await require('fs/promises').mkdir(uploadDir, { recursive: true })
    } catch (err) {
      // 目录已存在，忽略错误
    }
    
    // 保存文件
    const filePath = path.join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)
    
    // 返回文件的相对路径
    const fileUrl = `/uploads/${year}/${month}/${filename}`
    
    return NextResponse.json({
      success: true,
      fileUrl,
      message: '文件已保存到本地'
    })

  } catch (error) {
    console.error('本地上传错误:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '上传失败' 
    }, { status: 500 })
  }
}