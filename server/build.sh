#!/bin/bash

# 构建脚本 - 读取 package.json 版本号，构建 Docker 镜像并保存为 tar

set -e

# ============ 配置变量 ============

# Docker 账号
DOCKER_USERNAME="zhuyin19890308"

# 远程服务器配置
SSH_USER="zhuyin"
SSH_HOST="zhuyin.pro"
SSH_PORT=22
TARGET_DIR="/vol1/1000/myApps/whitenoise"

# 容器配置
CONTAINER_NAME="mianrong-backend"

# 端口映射（宿主机端口:容器端口）
HOST_PORT=4000
CONTAINER_PORT=3000

# 环境变量
BASE_URL="https://sounds.zhuyin.pro:1024"

# ==================================

# 读取版本号
VERSION=$(node -p "require('./package.json').version")

echo "Building whitenoise-server v${VERSION} ..."

#（支持多平台 构建 Docker 镜像）
docker build --platform linux/amd64 -t ${DOCKER_USERNAME}/whitenoise-server:${VERSION} .

# 推送到 Docker Hub（可选，取消注释启用）
# docker push ${DOCKER_USERNAME}/whitenoise-server:${VERSION}

# 导出为 tar 文件
echo "Saving to whitenoise-v${VERSION}.tar ..."
docker save -o whitenoise-v${VERSION}.tar ${DOCKER_USERNAME}/whitenoise-server:${VERSION}

echo "Done! Created: whitenoise-v${VERSION}.tar"

# 复制到远程服务器
echo "Copying to remote server ..."
scp -P ${SSH_PORT} whitenoise-v${VERSION}.tar ${SSH_USER}@${SSH_HOST}:${TARGET_DIR}/

# 在远程服务器上部署
echo "Deploying on remote server ..."
ssh -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST} << EOF
    cd ${TARGET_DIR}
    
    # 停止并删除旧容器
    docker rm -f ${CONTAINER_NAME}
    
    # 加载新镜像
    docker load -i whitenoise-v${VERSION}.tar
    
    # 启动新容器
    docker run -d \
        --name ${CONTAINER_NAME} \
        -p ${HOST_PORT}:${CONTAINER_PORT} \
        -v ${TARGET_DIR}/sources:/app/sources \
        --tmpfs /app/temp:size=512M \
        -e BASE_URL=${BASE_URL} \
        -e SOURCE_DIR=/app/sources \
        ${DOCKER_USERNAME}/whitenoise-server:${VERSION}
EOF

echo "Deployment complete!"
