import { NextRequest, NextResponse } from 'next/server'
import COS from 'cos-nodejs-sdk-v5'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json({ error: '缺少文件名参数' }, { status: 400 })
    }

    const bucket = process.env.TENCENT_BUCKET
    const region = process.env.TENCENT_REGION
    const secretId = process.env.TENCENT_SECRET_ID
    const secretKey = process.env.TENCENT_SECRET_KEY

    if (!bucket || !region || !secretId || !secretKey) {
      return NextResponse.json({ error: 'COS 配置不完整' }, { status: 500 })
    }

    // 生成带日期的文件路径
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    
    const timestamp = Date.now()
    const key = `uploads/${year}/${month}/${day}/${timestamp}-${filename}`

    console.log('COS Configuration:', {
      bucket,
      region,
      secretId: secretId.substring(0, 10) + '...',
      key
    })

    // 初始化 COS 客户端
    const cos = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
      Protocol: 'https'
    })

    // 使用 Promise 包装 getObjectUrl 方法
    const generateUploadUrl = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        cos.getObjectUrl({
          Bucket: bucket,
          Region: region,
          Key: key,
          Method: 'PUT',
          Sign: true,
          Expires: 600, // 10分钟过期
        }, (err, data) => {
          if (err) {
            console.error('生成签名URL失败:', err)
            reject(new Error(`生成上传链接失败: ${err.message || JSON.stringify(err)}`))
          } else {
            console.log('生成的签名URL:', data.Url)
            resolve(data.Url)
          }
        })
      })
    }

    const uploadUrl = await generateUploadUrl()
    const fileUrl = `https://${bucket}.cos.${region}.myqcloud.com/${key}`

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      fileUrl,
      debug: {
        bucket,
        region,
        key
      }
    })

  } catch (error) {
    console.error('API 错误:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '服务器内部错误',
      details: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 })
  }
}