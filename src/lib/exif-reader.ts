// EXIF数据读取工具
export interface ExifData {
  DateTime?: string
  DateTimeOriginal?: string
  DateTimeDigitized?: string
  Make?: string
  Model?: string
  LensModel?: string
  ISOSpeedRatings?: number
  FNumber?: number
  ExposureTime?: number
  GPSLatitude?: number
  GPSLongitude?: number
  [key: string]: any
}

// 解析EXIF日期字符串
function parseExifDate(dateString: string): Date | null {
  try {
    // EXIF日期格式: "YYYY:MM:DD HH:MM:SS"
    const match = dateString.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
    if (!match) return null
    
    const [, year, month, day, hour, minute, second] = match
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    )
  } catch (error) {
    console.error('解析EXIF日期失败:', error)
    return null
  }
}

// 转换GPS坐标
function parseGPSCoordinate(value: any, ref: string): number | null {
  try {
    if (typeof value === 'object' && value.numerator && value.denominator) {
      const degrees = value.numerator / value.denominator
      const direction = ref === 'S' || ref === 'W' ? -1 : 1
      return degrees * direction
    }
    return null
  } catch (error) {
    console.error('解析GPS坐标失败:', error)
    return null
  }
}

// 读取图片EXIF数据
export async function readExifData(file: File): Promise<ExifData | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      resolve(null)
      return
    }

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      try {
        // 使用exif-js库读取EXIF数据
        import('exif-js').then(ExifReader => {
          // @ts-ignore
          const exifData = ExifReader.default ? ExifReader.default.getAllTags(img) : ExifReader.getAllTags(img)
          resolve(exifData)
        }).catch(() => {
          resolve(null)
        })
      } catch (error) {
        console.error('读取EXIF数据失败:', error)
        resolve(null)
      }
    }

    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
}

// 提取拍摄日期
export function extractCaptureDate(exifData: ExifData | null): string | null {
  if (!exifData) return null
  
  // 优先使用DateTimeOriginal，其次是DateTime
  const dateString = exifData.DateTimeOriginal || exifData.DateTime
  if (!dateString) return null
  
  const date = parseExifDate(dateString)
  return date ? date.toISOString() : null
}

// 提取相机信息
export function extractCameraInfo(exifData: ExifData | null) {
  if (!exifData) return {}
  
  return {
    camera: exifData.Model ? `${exifData.Make || ''} ${exifData.Model}`.trim() : undefined,
    lens: exifData.LensModel,
    iso: exifData.ISOSpeedRatings,
    aperture: exifData.FNumber ? `f/${exifData.FNumber}` : undefined,
    shutterSpeed: exifData.ExposureTime ? `1/${Math.round(1/exifData.ExposureTime)}s` : undefined
  }
}

// 提取GPS信息
export function extractGPSInfo(exifData: ExifData | null) {
  if (!exifData) return null
  
  const latitude = parseGPSCoordinate(exifData.GPSLatitude, exifData.GPSLatitudeRef)
  const longitude = parseGPSCoordinate(exifData.GPSLongitude, exifData.GPSLongitudeRef)
  
  if (latitude !== null && longitude !== null) {
    return { latitude, longitude }
  }
  
  return null
}