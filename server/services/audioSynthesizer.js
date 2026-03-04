const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

class AudioSynthesizer {
    constructor(options = {}) {
        // 设置 FFmpeg 路径
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);

        this.tempDir = options.tempDir || path.join(__dirname, '../temp');
        this.sourceDir = options.sourceDir || path.join(__dirname, '../sources'); // 存放原始素材
        this.maxAgeMs = options.maxAgeMs || 10 * 60 * 1000; // 默认10分钟

        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    }

    /**
     * 清理过期的临时文件
     */
    cleanupOldFiles() {
        try {
            const now = Date.now();
            const files = fs.readdirSync(this.tempDir);
            let deletedCount = 0;

            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > this.maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`[Cleanup] Deleted old file: ${file}`);
                }
            });

            if (deletedCount > 0) {
                console.log(`[Cleanup] Deleted ${deletedCount} old files`);
            }
        } catch (err) {
            console.error('[Cleanup] Error cleaning up files:', err.message);
        }
    }

    /**
     * 生成参数 Hash 用于缓存
     */
    generateHash(tracks, duration) {
        const sortedTracks = [...tracks].sort((a, b) => a.id.localeCompare(b.id));
        const payload = JSON.stringify({ tracks: sortedTracks, duration });
        return crypto.createHash('md5').update(payload).digest('hex');
    }

    /**
     * 获取音频文件时长（秒）
     */
    getAudioDuration(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata.format.duration || 0);
                }
            });
        });
    }

    /**
     * 核心合成逻辑
     * @param {Array} tracks - [{ id, vol }]
     * @param {number} duration - 秒（可选，不传则自动计算最长轨道时长）
     */
    async synthesize(tracks, duration = null) {
        // 强制使用短时长切片循环策略，减轻服务端和手机端压力
        // 前端会自行循环播放这个短文件（例如 120s）
        const LOOP_DURATION = 120; 
        duration = LOOP_DURATION;

        // 每次合成前清理旧文件
        this.cleanupOldFiles();

        const sortedTracks = [...tracks].sort((a, b) => a.id.localeCompare(b.id));

        // Hash 生成规则不变，duration 固定为 LOOP_DURATION
        const hash = this.generateHash(sortedTracks, duration);
        const outputPath = path.join(this.tempDir, `${hash}.mp3`);

        console.log(`[Synth] Request received (Loop Mode). Hash: ${hash}, Duration: ${duration}s, Tracks:`, JSON.stringify(tracks));

        // 1. 检查本地缓存 (生产环境应检查 Redis/OSS)
        if (fs.existsSync(outputPath)) {
            console.log(`[Synth] Cache found: ${hash}`);
            return { url: `/temp/${hash}.mp3`, hash, cached: true };
        }
        
        console.log(`[Synth] Cache MISS for hash: ${hash}, starting FFmpeg synthesis...`);

        // 2. FFmpeg 混音逻辑
        return new Promise((resolve, reject) => {
            let command = ffmpeg();

            const filterInputs = [];
            const activeTracks = tracks.filter(t => t.vol > 0);

            if (activeTracks.length === 0) {
                return reject(new Error('No active tracks to mix'));
            }

            activeTracks.forEach((track, index) => {
                // 假设素材文件名为 track.id + '.mp3'
                const inputPath = path.join(this.sourceDir, `${track.id}.mp3`);
                command = command.input(inputPath).inputOptions(['-stream_loop -1']);

                // 滤镜链：调节音量
                filterInputs.push(`[${index}:a]volume=${track.vol}[a${index}]`);
            });

            // 混合滤镜
            const amixInputs = activeTracks.map((_, i) => `[a${i}]`).join('');
            const filterComplex = [
                ...filterInputs,
                // amix duration=first 确保混音时长以第一个输入为准（这里已经是固定 duration）
                // 加上 fade-out 防止循环时的爆音
                `${amixInputs}amix=inputs=${activeTracks.length}:duration=first:dropout_transition=2[out]`,
                // 全局淡出，避免循环时爆音
                '[out]afade=t=out:st=115:d=5[out_faded]'
            ].join(';');

            command
                .complexFilter(filterComplex, 'out_faded')
                .duration(duration) // 限制合成时长
                .audioChannels(2)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .on('start', (cmd) => console.log('FFmpeg started:', cmd))
                .on('error', (err) => reject(err))
                .on('end', () => {
                    console.log('FFmpeg finished:', hash);
                    resolve({ url: `/temp/${hash}.mp3`, hash, cached: false, duration: duration });
                })
                .save(outputPath);
        });
    }
}

module.exports = AudioSynthesizer;
