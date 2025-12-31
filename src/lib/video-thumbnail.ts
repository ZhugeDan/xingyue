/**
 * 生成视频缩略图 - 截取第一帧作为封面
 */
export const generateVideoThumbnail = (videoFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建Canvas上下文'))
      return
    }

    // 设置视频属性
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    let hasSeeked = false

    video.onloadedmetadata = () => {
      console.log('视频元数据加载完成:', {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      })

      // 确保视频有有效尺寸
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        reject(new Error('视频尺寸无效'))
        return
      }

      // 设置画布尺寸为视频尺寸，但限制最大尺寸
      const maxSize = 800
      let { videoWidth, videoHeight } = video

      if (videoWidth > maxSize || videoHeight > maxSize) {
        const ratio = Math.min(maxSize / videoWidth, maxSize / videoHeight)
        videoWidth = Math.floor(videoWidth * ratio)
        videoHeight = Math.floor(videoHeight * ratio)
      }

      canvas.width = videoWidth
      canvas.height = videoHeight

      console.log('画布尺寸设置:', { width: canvas.width, height: canvas.height })

      // 等待一短时间确保视频准备好
      setTimeout(() => {
        video.currentTime = 0.1 // 稍微偏移一点确保有内容
      }, 100)
    }

    video.onseeked = () => {
      if (hasSeeked) return // 防止重复触发
      hasSeeked = true

      console.log('视频跳转到第一帧完成')

      try {
        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // 绘制视频帧到画布
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // 转换为base64，使用PNG格式避免压缩损失
        const thumbnail = canvas.toDataURL('image/png', 0.9)

        if (!thumbnail || thumbnail === 'data:,') {
          throw new Error('生成的缩略图为空')
        }

        console.log('缩略图生成成功，数据长度:', thumbnail.length)
        resolve(thumbnail)
      } catch (error) {
        console.error('缩略图生成失败:', error)
        reject(new Error(`缩略图生成失败: ${error}`))
      }
    }

    video.onerror = (e) => {
      console.error('视频加载错误:', e)
      reject(new Error('视频文件加载失败或格式不支持'))
    }

    video.oncanplay = () => {
      console.log('视频可以播放')
    }

    // 创建视频URL并设置源
    const videoURL = URL.createObjectURL(videoFile)
    video.src = videoURL

    // 设置超时
    setTimeout(() => {
      if (!hasSeeked) {
        reject(new Error('视频缩略图生成超时'))
      }
    }, 10000) // 10秒超时
  })
}

/**
 * 从服务器视频URL生成缩略图（如果需要客户端生成）
 */
export const generateThumbnailFromUrl = async (videoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建Canvas上下文'))
      return
    }

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      video.currentTime = 1 // 1秒处，通常第一帧比较清晰
    }

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
      resolve(thumbnail)
    }

    video.onerror = () => {
      reject(new Error('视频加载失败'))
    }

    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.src = videoUrl
  })
}