# 使用 Node.js 基础镜像
FROM node:18-slim

# 安装 FFmpeg 运行所需的依赖库
RUN apt-get update && apt-get install -y \
    libexpat1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制依赖文件（不包含 node_modules，让构建时重新安装）
COPY package*.json ./

# 安装生产环境依赖
# @ffmpeg-installer/ffmpeg 会在 npm install 时自动下载 Linux 版本的二进制
RUN npm install --production

# 复制项目代码
COPY . .

# 暴露服务端口
EXPOSE 3000

# 启动脚本
CMD ["node", "index.js"]
