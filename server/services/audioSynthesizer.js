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
        // 每次合成前清理旧文件
        this.cleanupOldFiles();

        const sortedTracks = [...tracks].sort((a, b) => a.id.localeCompare(b.id));
        
        // 如果没有传 duration，自动获取最长轨道的长度
        if (duration === undefined || duration === null) {
            console.log(`[Synth] No duration provided, calculating max track duration...`);
            const activeTracks = tracks.filter(t => t.vol > 0);
            const durations = await Promise.all(
                activeTracks.map(async (track) => {
                    const inputPath = path.join(this.sourceDir, `${track.id}.mp3`);
                    try {
                        const dur = await this.getAudioDuration(inputPath);
                        console.log(`[Synth] Track ${track.id} duration: ${dur}s`);
                        return dur;
                    } catch (e) {
                        console.error(`[Synth] Error getting duration for ${track.id}:`, e.message);
                        return 0;
                    }
                })
            );
            duration = Math.max(...durations);
            console.log(`[Synth] Calculated max duration: ${duration}s`);
        }

        const hash = this.generateHash(sortedTracks, duration);
        const outputPath = path.join(this.tempDir, `${hash}.mp3`);

        console.log(`[Synth] Request received. Hash: ${hash}, Duration: ${duration}s, Tracks:`, JSON.stringify(tracks));

        // 1. 检查本地缓存 (生产环境应检查 Redis/OSS)
        if (fs.existsSync(outputPath)) {
            // 416 Bug fix: 既然前端报 416，我们直接删掉缓存，强制重新生成
            console.log(`[Synth] Cache found but deleting to avoid 416 error: ${hash}`);
            fs.unlinkSync(outputPath);
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
                command = command.input(inputPath).inputOptions(['-stream_loop -1']); // 循环读取素材

                // 滤镜链：调节音量
                filterInputs.push(`[${index}:a]volume=${track.vol}[a${index}]`);
            });

            // 混合滤镜
            const amixInputs = activeTracks.map((_, i) => `[a${i}]`).join('');
            const filterComplex = [
                ...filterInputs,
                `${amixInputs}amix=inputs=${activeTracks.length}:duration=first:dropout_transition=2[out]`
            ].join(';');

            command
                .complexFilter(filterComplex, 'out')
                .duration(duration) // 限制合成时长
                .audioChannels(2)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .on('start', (cmd) => console.log('FFmpeg started:', cmd))
                .on('error', (err) => reject(err))
                .on('end', () => {
                    console.log('FFmpeg finished:', hash);
                    resolve({ url: `/temp/${hash}.mp3`, hash, cached: false });
                })
                .save(outputPath);
        });
    }
}

module.exports = AudioSynthesizer;
