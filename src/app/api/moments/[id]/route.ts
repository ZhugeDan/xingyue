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

// PATCH 方法：更新记录
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    
    // 读取现有数据
    const existingMoments = await readMoments()
    
    // 查找要更新的记录
    const index = existingMoments.findIndex(moment => moment.id === id)
    if (index === -1) {
      return NextResponse.json(
        { error: '记录不存在' },
        { status: 404 }
      )
    }
    
    // 验证更新的字段
    const allowedFields = ['title', 'description', 'date']
    const updates: any = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'title' || field === 'description') {
          if (!body[field].trim()) {
            return NextResponse.json(
              { error: `${field} 不能为空` },
              { status: 400 }
            )
          }
          updates[field] = body[field].trim()
        } else if (field === 'date') {
          // 验证日期格式
          const dateObj = new Date(body[field])
          if (isNaN(dateObj.getTime())) {
            return NextResponse.json(
              { error: '日期格式无效' },
              { status: 400 }
            )
          }
          updates[field] = dateObj.toISOString()
        }
      }
    }
    
    // 更新记录
    existingMoments[index] = {
      ...existingMoments[index],
      ...updates
    }
    
    // 写入文件
    await writeMoments(existingMoments)
    
    return NextResponse.json(existingMoments[index])
  } catch (error) {
    console.error('更新记录失败:', error)
    return NextResponse.json(
      { error: '更新记录失败' },
      { status: 500 }
    )
  }
}

// DELETE 方法：删除记录
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // 读取现有数据
    const existingMoments = await readMoments()
    
    // 查找要删除的记录
    const index = existingMoments.findIndex(moment => moment.id === id)
    if (index === -1) {
      return NextResponse.json(
        { error: '记录不存在' },
        { status: 404 }
      )
    }
    
    // 删除记录
    existingMoments.splice(index, 1)
    
    // 写入文件
    await writeMoments(existingMoments)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除记录失败:', error)
    return NextResponse.json(
      { error: '删除记录失败' },
      { status: 500 }
    )
  }
}