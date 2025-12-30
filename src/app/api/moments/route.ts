import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

// 数据文件路径
const dataFilePath = path.join(process.cwd(), 'data', 'moments.json')

// 类型定义
interface Moment {
  id: string
  date: string
  title: string
  description: string
  mediaType: 'photo' | 'video'
  mediaUrl: string
}

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 读取数据文件
async function readMoments(): Promise<Moment[]> {
  try {
    const fileContent = await readFile(dataFilePath, 'utf-8')
    return JSON.parse(fileContent)
  } catch (error) {
    console.error('读取数据文件失败:', error)
    return []
  }
}

// 写入数据文件
async function writeMoments(moments: Moment[]): Promise<void> {
  try {
    await writeFile(dataFilePath, JSON.stringify(moments, null, 2), 'utf-8')
  } catch (error) {
    console.error('写入数据文件失败:', error)
    throw error
  }
}

// GET 方法：获取所有记录
export async function GET() {
  try {
    const moments = await readMoments()
    return NextResponse.json(moments)
  } catch (error) {
    console.error('获取记录失败:', error)
    return NextResponse.json(
      { error: '获取记录失败' },
      { status: 500 }
    )
  }
}

// POST 方法：添加新记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, mediaType, mediaUrl, date } = body

    // 验证必填字段
    if (!title || !description || !mediaType || !mediaUrl) {
      return NextResponse.json(
        { error: '缺少必填字段：title, description, mediaType, mediaUrl' },
        { status: 400 }
      )
    }

    // 验证 mediaType
    if (!['photo', 'video'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'mediaType 必须是 "photo" 或 "video"' },
        { status: 400 }
      )
    }

    // 创建新记录
    const newMoment: Moment = {
      id: generateId(),
      date: date || new Date().toISOString(),
      title: title.trim(),
      description: description.trim(),
      mediaType,
      mediaUrl: mediaUrl.trim()
    }

    // 读取现有数据
    const existingMoments = await readMoments()

    // 添加新记录到开头（最新的在前面）
    const updatedMoments = [newMoment, ...existingMoments]

    // 写入文件
    await writeMoments(updatedMoments)

    return NextResponse.json(newMoment, { status: 201 })
  } catch (error) {
    console.error('添加记录失败:', error)
    return NextResponse.json(
      { error: '添加记录失败' },
      { status: 500 }
    )
  }
}

