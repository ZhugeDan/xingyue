# 🚀 服务器部署指南

## 📋 部署概览

**项目**: 星月家庭相册  
**部署环境**: Ubuntu 20.04+ / CentOS 8+  
**部署方式**: PM2 + Nginx + HTTPS  
**存储**: 腾讯云COS + 本地备份  

---

## 🖥️ 服务器要求

### 最低配置
- **CPU**: 1核心
- **内存**: 2GB RAM
- **存储**: 20GB SSD
- **网络**: 1Mbps带宽
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 10+

### 推荐配置
- **CPU**: 2核心
- **内存**: 4GB RAM
- **存储**: 50GB SSD
- **网络**: 5Mbps带宽
- **操作系统**: Ubuntu 22.04 LTS

---

## 🔧 第一步：服务器环境准备

### 1.1 更新系统
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 1.2 安装基础软件
```bash
# 安装基础工具
sudo apt install -y curl wget git unzip build-essential

# 安装Node.js 18+ (推荐使用NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证Node.js版本
node --version  # 应该 >= 18.0.0
npm --version   # 应该 >= 8.0.0

# 安装PM2进程管理器
sudo npm install -g pm2

# 安装Nginx
sudo apt install -y nginx
```

### 1.3 创建应用用户
```bash
# 创建专用用户
sudo adduser --disabled-password --gecos "" diary-app

# 添加到sudo组 (可选，用于管理)
sudo usermod -aG sudo diary-app

# 切换到应用用户
sudo su - diary-app
```

### 1.4 配置防火墙
```bash
# 启用UFW防火墙
sudo ufw enable

# 允许SSH、HTTP、HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# 查看状态
sudo ufw status
```

---

## 📦 第二步：项目部署

### 2.1 获取项目代码
```bash
# 方法1: Git克隆 (如果有Git仓库)
cd /home/diary-app
git clone <your-repository-url> diary-app
cd diary-app

# 方法2: 上传文件包
# 在本地打包: tar -czf diary-app.tar.gz ./
# 上传到服务器: scp diary-app.tar.gz user@server:/home/diary-app/
# 解压: tar -xzf diary-app.tar.gz
```

### 2.2 安装项目依赖
```bash
# 进入项目目录
cd /home/diary-app/diary-app

# 安装生产依赖
npm install --production

# 检查安装结果
npm list --depth=0
```

### 2.3 环境配置
```bash
# 创建环境变量文件
nano .env.local
```

**编辑 `.env.local` 文件**:
```bash
# 腾讯云COS配置

# 应用配置
NODE_ENV=production
PORT=3000
```

### 2.4 构建项目
```bash
# 构建生产版本
npm run build

# 检查构建结果
ls -la .next/
```

---

## 🌐 第三步：Web服务器配置

### 3.1 配置Nginx
```bash
# 创建站点配置
sudo nano /etc/nginx/sites-available/diary-app
```

**Nginx配置文件内容**:
```nginx
# 主服务器配置
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # HTTP到HTTPS重定向
    return 301 https://$server_name$request_uri;
}

# HTTPS服务器配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 静态文件缓存
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 上传文件缓存
    location /uploads/ {
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 静态文件服务
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.2 启用站点
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/diary-app /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载Nginx
sudo systemctl reload nginx

# 设置开机自启
sudo systemctl enable nginx
```

---

## 🔒 第四步：SSL证书配置

### 4.1 安装Certbot
```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

### 4.2 获取SSL证书
```bash
# 获取Let's Encrypt证书 (替换your-domain.com为实际域名)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 邮箱注册 (如果首次使用)
# 同意服务条款
# 选择是否重定向HTTP到HTTPS: 选择2 (是)
```

### 4.3 自动续期
```bash
# 测试自动续期
sudo certbot renew --dry-run

# 添加到crontab
sudo crontab -e
# 添加以下行:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🚀 第五步：应用启动

### 5.1 启动应用
```bash
# 进入项目目录
cd /home/diary-app/diary-app

# 使用PM2启动
pm2 start npm --name "diary-app" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs diary-app
```

### 5.2 PM2配置
```bash
# 设置PM2开机自启
pm2 startup
# 按照提示执行命令

# 保存PM2进程列表
pm2 save

# 查看详细信息
pm2 show diary-app
```

### 5.3 进程管理命令
```bash
# 重启应用
pm2 restart diary-app

# 停止应用
pm2 stop diary-app

# 删除应用
pm2 delete diary-app

# 实时监控
pm2 monit
```

---

## 📊 第六步：监控和维护

### 6.1 创建监控脚本
```bash
# 创建监控脚本
nano ~/monitor.sh
```

**监控脚本内容**:
```bash
#!/bin/bash

# 检查应用状态
APP_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="diary-app") | .pm2_env.status')

if [ "$APP_STATUS" != "online" ]; then
    echo "应用已停止，正在重启..."
    pm2 restart diary-app
fi

# 检查磁盘空间
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "磁盘空间不足: ${DISK_USAGE}%"
fi

# 检查内存使用
MEM_USAGE=$(free | grep Mem | awk '{printf("%.1f"), $3/$2 * 100.0}')
echo "内存使用率: ${MEM_USAGE}%"

# 检查Nginx状态
NGINX_STATUS=$(systemctl is-active nginx)
if [ "$NGINX_STATUS" != "active" ]; then
    echo "Nginx未运行，正在重启..."
    sudo systemctl restart nginx
fi
```

### 6.2 设置监控任务
```bash
# 添加执行权限
chmod +x ~/monitor.sh

# 添加到crontab (每5分钟检查一次)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/diary-app/monitor.sh >> /home/diary-app/monitor.log 2>&1") | crontab -
```

### 6.3 日志管理
```bash
# PM2日志位置
~/.pm2/logs/diary-app-out.log
~/.pm2/logs/diary-app-error.log

# Nginx日志位置
/var/log/nginx/access.log
/var/log/nginx/error.log

# 系统日志
sudo journalctl -u nginx -f
```

---

## 💾 第七步：数据备份

### 7.1 创建备份脚本
```bash
# 创建备份脚本
nano ~/backup.sh
```

**备份脚本内容**:
```bash
#!/bin/bash

# 备份配置
BACKUP_DIR="/home/diary-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/home/diary-app/diary-app"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份应用数据
tar -czf "$BACKUP_DIR/diary_app_$DATE.tar.gz" \
    -C "$PROJECT_DIR" \
    data/ \
    .env.local \
    package.json \
    package-lock.json

# 备份Nginx配置
sudo cp /etc/nginx/sites-available/diary-app "$BACKUP_DIR/nginx_diary_$DATE.conf"

# 清理7天前的备份
find $BACKUP_DIR -name "diary_app_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "nginx_diary_*.conf" -mtime +7 -delete

echo "备份完成: diary_app_$DATE.tar.gz"
```

### 7.2 设置自动备份
```bash
# 添加执行权限
chmod +x ~/backup.sh

# 添加到crontab (每天凌晨2点备份)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/diary-app/backup.sh") | crontab -
```

---

## 🔧 第八步：性能优化

### 8.1 Node.js优化
```bash
# 编辑PM2配置文件
pm2 ecosystem
```

**PM2配置文件 (ecosystem.config.js)**:
```javascript
module.exports = {
  apps: [{
    name: 'diary-app',
    script: './node_modules/.bin/next',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

### 8.2 系统优化
```bash
# 调整文件描述符限制
echo "diary-app soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "diary-app hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 优化网络设置
echo "net.core.somaxconn = 65536" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 🆘 第九步：故障排除

### 9.1 常见问题诊断

#### 应用无法启动
```bash
# 检查Node.js版本
node --version

# 检查端口占用
sudo netstat -tlnp | grep :3000

# 检查PM2日志
pm2 logs diary-app

# 手动测试启动
cd /home/diary-app/diary-app
npm run build
npm start
```

#### Nginx配置问题
```bash
# 测试Nginx配置
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# 重启Nginx
sudo systemctl restart nginx
```

#### SSL证书问题
```bash
# 检查证书状态
sudo certbot certificates

# 手动续期证书
sudo certbot renew

# 检查证书过期时间
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -dates
```

### 9.2 性能监控
```bash
# 系统资源监控
htop
iotop
nethogs

# 应用监控
pm2 monit

# 日志监控
tail -f ~/.pm2/logs/diary-app-out.log
```

### 9.3 紧急恢复
```bash
# 快速重启所有服务
sudo systemctl restart nginx
pm2 restart all

# 检查服务状态
sudo systemctl status nginx
pm2 status

# 如果完全无法访问
# 1. 检查服务器网络
# 2. 重启服务器: sudo reboot
# 3. 检查防火墙设置
```

---

## 📋 第十步：部署检查清单

### 部署前检查
- [ ] 服务器配置满足要求
- [ ] Node.js版本 >= 18
- [ ] 腾讯云COS配置正确
- [ ] 域名DNS解析设置
- [ ] 防火墙端口开放

### 部署中检查
- [ ] 项目依赖安装成功
- [ ] 环境变量配置正确
- [ ] 构建过程无错误
- [ ] PM2进程启动成功
- [ ] Nginx配置测试通过

### 部署后检查
- [ ] 应用可以正常访问
- [ ] HTTPS证书配置成功
- [ ] 文件上传功能正常
- [ ] 图片显示正常
- [ ] API接口响应正常
- [ ] 监控脚本运行正常
- [ ] 自动备份设置成功

### 长期维护
- [ ] SSL证书自动续期
- [ ] 定期备份检查
- [ ] 性能监控
- [ ] 安全更新
- [ ] 日志清理

---

## 📞 技术支持

### 紧急联系
- **服务器提供商**: [联系信息]
- **域名注册商**: [联系信息]
- **腾讯云支持**: 95716

### 文档参考
- [Next.js部署文档](https://nextjs.org/docs/deployment)
- [PM2文档](https://pm2.keymetrics.io/docs/)
- [Nginx配置文档](https://nginx.org/en/docs/)
- [Let's Encrypt文档](https://letsencrypt.org/docs/)

---

**部署完成后，您的星月家庭相册应用就可以稳定运行在生产环境中了！** 🎉

**版本**: v1.0  
**最后更新**: 2025-12-30  
**适用系统**: Ubuntu 20.04+ / CentOS 8+