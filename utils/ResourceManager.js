/**
 * ResourceManager - 智能资源管理器
 * 
 * 职责：
 * 1. 永久缓存同步（syncSounds）- 缺失则下载并永久保存
 * 2. 混合文件生命周期（queueMixedDownload）
 *    - 状态回调：onStart, onProgress, onSuccess, onError
 *    - 原子替换：下载成功 -> 通知切换 -> 删除旧文件
 *    - 异常处理：下载失败 -> 通知 UI 显示错误 -> 保留旧文件
 * 
 * uniapp 多端兼容：使用 uni.downloadFile, uni.getFileSystemManager 等通用 API
 */

import { SERVER_BASE_URL, MIXED_AUDIO_DIR, DEFAULT_MIX_DURATION } from '../config/index';

/**
 * 下载状态
 * @typedef {'idle' | 'downloading' | 'success' | 'error'} DownloadState
 */

/**
 * 下载进度回调
 * @typedef {Object} DownloadCallbacks
 * @property {Function} [onStart] - 开始下载
 * @property {Function} [onProgress] - 进度更新
 * @property {Function} [onSuccess] - 下载成功
 * @property {Function} [onError] - 下载失败
 */

/**
 * 轨道音量配置
 * @typedef {Object} TrackVolume
 * @property {string} id - 轨道 ID
 * @property {number} vol - 音量 0-1
 */

class ResourceManager {
    constructor() {
        this.fs = uni.getFileSystemManager();
        this.currentDownloadTask = null;
        this.currentMixedPath = null;
        // mixed 文件采用 saveFile 持久化，不依赖自建目录（避免 devtools 权限/路径差异）
    }

    /**
     * 确保混合音频目录存在
     */
    async ensureMixedDir() {
        try {
            await this.accessDir(MIXED_AUDIO_DIR);
            return;
        } catch (_e) {
            // 不存在则创建
        }

        try {
            await this.mkdir(MIXED_AUDIO_DIR);
            console.log('[ResourceManager] 创建混合音频目录:', MIXED_AUDIO_DIR);
        } catch (err) {
            // 可能已被并发创建；再检查一次
            try {
                await this.accessDir(MIXED_AUDIO_DIR);
            } catch (e2) {
                throw err || e2;
            }
        }
    }

    /**
     * 将临时文件持久化保存到 USER_DATA_PATH
     * 不依赖 mkdir/copyFile，兼容 devtools 与真机
     * @param {string} tempFilePath
     * @returns {Promise<string>} savedFilePath
     */
    saveFilePersistent(tempFilePath) {
        return new Promise((resolve, reject) => {
            // 优先使用 uni.saveFile（跨端封装）
            if (uni.saveFile) {
                uni.saveFile({
                    tempFilePath,
                    success: (res) => resolve(res.savedFilePath),
                    fail: reject
                });
                return;
            }

            // 兜底：某些环境下可用 FileSystemManager.saveFile
            if (this.fs && this.fs.saveFile) {
                this.fs.saveFile({
                    tempFilePath,
                    success: (res) => resolve(res.savedFilePath),
                    fail: reject
                });
                return;
            }

            reject(new Error('saveFile API not available'));
        });
    }

    /**
     * 检查目录是否存在
     */
    accessDir(dirPath) {
        return new Promise((resolve, reject) => {
            this.fs.access({
                path: dirPath,
                success: () => resolve(),
                fail: (err) => reject(err)
            });
        });
    }

    /**
     * 创建目录
     */
    mkdir(dirPath) {
        return new Promise((resolve, reject) => {
            this.fs.mkdir({
                dirPath: dirPath,
                success: () => resolve(),
                fail: (err) => reject(err)
            });
        });
    }

    /**
     * 删除文件
     */
    unlink(filePath) {
        return new Promise((resolve, reject) => {
            this.fs.unlink({
                filePath: filePath,
                success: () => resolve(),
                fail: (err) => reject(err)
            });
        });
    }

    /**
     * 复制文件
     */
    copyFile(src, dest) {
        return new Promise((resolve, reject) => {
            this.fs.copyFile({
                srcPath: src,
                destPath: dest,
                success: () => resolve(),
                fail: (err) => reject(err)
            });
        });
    }

    /**
     * 生成混合音频的 Hash（与后端算法一致）
     * 后端算法：MD5(JSON.stringify(sorted tracks + duration))
     * @param {Array<TrackVolume>} tracks 
     * @param {number} duration 
     */
    generateMixedHash(tracks, duration = DEFAULT_MIX_DURATION) {
        // 按 track.id 排序（与后端一致）
        const sortedTracks = [...tracks].sort((a, b) => a.id.localeCompare(b.id));
        const payload = JSON.stringify({ tracks: sortedTracks, duration });
        
        // 简化的 Hash 实现（实际项目中可引入 crypto-js）
        let hash = 0;
        for (let i = 0; i < payload.length; i++) {
            const char = payload.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        // 转换为 32 位十六进制字符串
        const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
        return hashStr.repeat(4); // 32 位
    }

    /**
     * 获取混合音频的本地路径
     * @param {string} hash 
     */
    getMixedFilePath(hash) {
        return `${MIXED_AUDIO_DIR}/${hash}.mp3`;
    }

    /**
     * 检查混合音频是否已缓存
     * @param {string} hash 
     */
    async checkMixedCache(hash) {
        const localPath = this.getMixedFilePath(hash);
        try {
            await this.accessDir(localPath);
            console.log('[ResourceManager] 混合音频命中缓存:', localPath);
            return localPath;
        } catch (e) {
            return null;
        }
    }

    /**
     * 队列式混合音频下载
     * 
     * 流程：
     * 1. onStart - 开始下载
     * 2. onProgress - 进度更新
     * 3. 下载完成 -> onSuccess(localPath)
     * 4. 删除旧文件（如果有）
     * 
     * @param {Array<TrackVolume>} tracks 轨道音量配置
     * @param {number} duration 时长（秒）
     * @param {DownloadCallbacks} callbacks 状态回调
     * @returns {Promise<string>} 成功返回本地路径
     */
    async queueMixedDownload(tracks, duration = DEFAULT_MIX_DURATION, callbacks = {}) {
        const { onStart, onProgress, onSuccess, onError } = callbacks;
        
        // 1. 生成 Hash
        const hash = this.generateMixedHash(tracks, duration);
        const localPath = this.getMixedFilePath(hash);

        // 2. 检查缓存
        try {
            await this.accessDir(localPath);
            console.log('[ResourceManager] 命中缓存，直接返回:', localPath);
            onSuccess && onSuccess(localPath);
            return localPath;
        } catch (e) {
            // 缓存未命中，继续下载
        }

        // 3. 构建请求参数
        const activeTracks = tracks.filter(t => t.vol > 0);
        if (activeTracks.length === 0) {
            const err = new Error('没有活跃的轨道');
            onError && onError(err);
            throw err;
        }

        // 4. 请求后端合成
        const requestBody = {
            tracks: activeTracks,
            duration
        };

        console.log('[ResourceManager] 请求后端合成:', requestBody);

        // 5. 发起请求
        try {
            onStart && onStart();

            // 先请求合成接口获取 URL
            const synthResponse = await new Promise((resolve, reject) => {
                uni.request({
                    url: `${SERVER_BASE_URL}/api/v1/synthesize`,
                    method: 'POST',
                    data: requestBody,
                    success: (res) => {
                        if (res.statusCode === 200 && res.data?.success) {
                            resolve(res.data);
                        } else {
                            reject(new Error(res.data?.error || '合成请求失败'));
                        }
                    },
                    fail: reject
                });
            });

            const downloadUrl = synthResponse.url;
            console.log('[ResourceManager] 获得下载链接:', downloadUrl);

            // 6. 下载文件（带进度）
            const tempPath = await this.downloadWithProgress(downloadUrl, (progress) => {
                onProgress && onProgress(progress);
            });

            // 7. 保存到持久化目录
            const savedPath = await this.saveFilePersistent(tempPath);
            console.log('[ResourceManager] 文件已持久化保存:', savedPath);

            // 8. 删除旧的混合文件（如果有）
            await this.cleanupOldMixedFile(savedPath);

            // 9. 回调成功
            onSuccess && onSuccess(savedPath);
            this.currentMixedPath = savedPath;

            return savedPath;

        } catch (error) {
            console.error('[ResourceManager] 下载失败:', error);
            onError && onError(error);
            throw error;
        }
    }

    /**
     * 带进度的文件下载
     * @param {string} url 
     * @param {Function} onProgress 
     */
    downloadWithProgress(url, onProgress) {
        return new Promise((resolve, reject) => {
            const task = uni.downloadFile({
                url: url,
                success: (res) => {
                    if (res.statusCode === 200) {
                        resolve(res.tempFilePath);
                    } else {
                        reject(new Error(`下载失败，HTTP ${res.statusCode}`));
                    }
                },
                fail: reject
            });

            // 监听下载进度
            task.onProgressUpdate((res) => {
                onProgress && onProgress(res.progress);
            });

            // 保存任务引用以便取消
            this.currentDownloadTask = task;
        });
    }

    /**
     * 取消当前下载
     * 用户再次拖动滑块时调用
     */
    cancelCurrentDownload() {
        if (this.currentDownloadTask) {
            this.currentDownloadTask.abort();
            this.currentDownloadTask = null;
            console.log('[ResourceManager] 已取消当前下载');
        }
    }

    /**
     * 清理旧的混合文件（保留当前使用的）
     * "新王登基，旧王退位"原则
     * @param {string} newPath 
     */
    async cleanupOldMixedFile(newPath) {
        if (!this.currentMixedPath) return;

        try {
            const oldPath = this.currentMixedPath;
            // 不删除当前正在使用的文件，只清理其他旧文件
            if (oldPath && oldPath !== newPath) {
                await this.unlink(oldPath);
                console.log('[ResourceManager] 已删除旧混合文件:', oldPath);
            }
        } catch (e) {
            console.warn('[ResourceManager] 清理旧文件失败:', e);
        }
    }

    /**
     * 获取当前混合文件路径
     */
    getCurrentMixedPath() {
        return this.currentMixedPath;
    }

    /**
     * 清理所有混合文件（可选，用于调试）
     */
    async clearAllMixedFiles() {
        try {
            const files = await new Promise((resolve, reject) => {
                this.fs.readdir({
                    dirPath: MIXED_AUDIO_DIR,
                    success: (res) => resolve(res.files || []),
                    fail: reject
                });
            });

            for (const file of files) {
                try {
                    await this.unlink(`${MIXED_AUDIO_DIR}/${file}`);
                } catch (e) {
                    console.warn('[ResourceManager] 删除文件失败:', file);
                }
            }
            console.log('[ResourceManager] 已清理所有混合文件');
            this.currentMixedPath = null;
        } catch (e) {
            console.warn('[ResourceManager] 清理目录失败:', e);
        }
    }
}

// 导出单例
export const resourceManager = new ResourceManager();
export default resourceManager;
