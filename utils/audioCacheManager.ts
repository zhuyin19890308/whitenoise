import { NAS_BASE_URL } from '../config/index';

/**
 * AudioCacheManager - 微信小程序音频缓存管理器
 * 
 * 核心逻辑：
 * 1. 检查本地持久化目录（USER_DATA_PATH）是否存在该文件。
 * 2. 若存在，直接返回本地路径。
 * 3. 若不存在，从 NAS 远程下载并保存到本地持久化目录。
 * 
 * 注意：微信小程序 USER_DATA_PATH 持久化配额为 200MB，
 * 本应用 8 个音频总计约 45MB，完全满足缓存需求。
 */
export class AudioCacheManager {
    private static fs = uni.getFileSystemManager();

    /**
     * 获取音频的可用路径（优先本地缓存，其次下载）
     * @param fileName 音频文件名，如 'bird.mp3'
     */
    static async getAudioPath(fileName: string): Promise<string> {
        const localPath = `${uni.env.USER_DATA_PATH}/${fileName}`;
        const remoteUrl = `${NAS_BASE_URL}${fileName}`;

        try {
            // 1. 检查本地是否存在
            const isExisted = await this.checkFileExists(localPath);
            if (isExisted) {
                console.log(`[Cache] 命中本地缓存: ${fileName}`);
                return localPath;
            }

            // 2. 不存在，执行下载逻辑
            console.log(`[Cache] 未命中缓存，开始从远程下载: ${remoteUrl}`);
            const tempFilePath = await this.downloadAudio(remoteUrl);

            // 3. 将临时文件转存为持久化文件
            await this.saveFilePersistent(tempFilePath, localPath);

            console.log(`[Cache] 下载并缓存成功: ${localPath}`);
            return localPath;
        } catch (error: any) {
            const errDetail = JSON.stringify(error) || error?.errMsg || error?.message || '未知错误';
            console.error(`[Cache] 获取音频路径失败: ${fileName}`, errDetail);
            throw error;
        }
    }

    /**
     * 检查文件是否存在
     */
    private static checkFileExists(path: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.fs.access({
                path,
                success: () => resolve(true),
                fail: () => resolve(false)
            });
        });
    }

    /**
     * 下载音频文件到临时目录
     */
    private static downloadAudio(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            uni.downloadFile({
                url,
                success: (res) => {
                    if (res.statusCode === 200) {
                        resolve(res.tempFilePath);
                    } else {
                        reject(new Error(`下载失败，HTTP状态码: ${res.statusCode}`));
                    }
                },
                fail: (err) => reject(err)
            });
        });
    }

    /**
     * 将临时文件转存到 USER_DATA_PATH
     */
    private static saveFilePersistent(tempPath: string, destPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // 使用 copyFile 实现持久化，tempFilePath 在小程序退出后会被清理，
            // 而 USER_DATA_PATH 下的文件会永久保留。
            this.fs.copyFile({
                srcPath: tempPath,
                destPath: destPath,
                success: () => resolve(),
                fail: (err) => reject(err)
            });
        });
    }

    /**
     * (选做) 获取当前已缓存文件占用空间
     */
    static getCacheSize(): void {
        this.fs.readdir({
            dirPath: uni.env.USER_DATA_PATH,
            success: (res) => {
                console.log('[Cache] 本地持久化目录文件列表:', res.files);
            }
        });
    }
}
