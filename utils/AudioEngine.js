/**
 * AudioEngine - 白噪音音频引擎
 *
 * 核心职责：
 * 1. 双模状态机：
 *    - Mode A（本地多路混音）：使用多个 InnerAudioContext 同时播放本地音源
 *    - Mode B（后端单文件）：使用 BackgroundAudioManager 播放后端合成的 MP3
 * 2. 状态机：IDLE, LOCAL_MIX, CLOUD_MIXING, CLOUD_LOADING, READY, ERROR
 * 3. 事件总线：通过回调通知 UI 状态变更
 * 4. 无缝切换逻辑
 *
 * uniapp 多端兼容：使用 uni.createInnerAudioContext, uni.getBackgroundAudioManager 等通用 API
 *
 * 平台差异化策略：
 * - App端：本地多路混音优先，后端合成作为降级方案
 * - 小程序端：后端合成（保持原有逻辑）
 */

import ResourceManager from './ResourceManager';
import {
    isApp,
    isWeixin,
    shouldUseCloudSynthesis,
    supportBackgroundPlayback,
    getBackgroundAudioInfo
} from './platformUtils';

// ==================== 状态常量 ====================
export const AudioEngineState = {
    IDLE: 'IDLE',                    // 初始状态，无播放
    LOCAL_MIX: 'LOCAL_MIX',          // Mode A：本地多路混音（拖动时触发）
    CLOUD_MIXING: 'CLOUD_MIXING',    // 正在请求后端合成（可选）
    CLOUD_LOADING: 'CLOUD_LOADING', // Mode B：正在下载合成文件
    READY: 'READY',                  // Mode B：下载完成，已切换到后台播放
    ERROR: 'ERROR'                   // 下载失败，回退到本地模式
};

// ==================== 事件回调类型 ====================
/**
 * @typedef {Object} AudioEngineCallbacks
 * @property {Function} [onStateChange] - 状态变更回调
 * @property {Function} [onProgress] - 进度回调
 * @property {Function} [onError] - 错误回调
 */

// ==================== 轨道播放器结构 ====================
/**
 * @typedef {Object} TrackPlayer
 * @property {string} id - 轨道 ID
 * @property {any} context - InnerAudioContext
 * @property {number} volume - 音量 0-1
 * @property {boolean} isPlaying - 是否正在播放
 */

// ==================== AudioEngine 核心类 ====================
class AudioEngine {
    constructor() {
        // 状态
        this.state = AudioEngineState.IDLE;
        this.prevState = AudioEngineState.IDLE;

        // Mode A：本地多路混音播放器
        this.trackPlayers = new Map();

        // Mode B：后端单文件播放器
        this.bgAudioManager = null;

        // 资源管理
        this.resourceManager = ResourceManager;

        // 事件回调
        this.callbacks = {};

        // 当前播放配置
        this.currentTracks = [];
        this.currentDuration = 1800;

        // 最近一次 Mode B 播放的本地路径（用于切后台/重启恢复）
        this.lastBgSrc = '';

        // 标记是否需要切换到 Mode B
        this.pendingModeB = false;

        // 初始化
        this.initBackgroundAudio();
        this.restoreLastBgSrc();

        // 初始化音频中断监听（App端）
        this.initAudioInterruptionListener();

        // 监听计时器结束事件
        // #ifdef APP-PLUS
        uni.$on('timerEnd', () => {
            console.log('[AudioEngine] 收到计时器结束事件');
            this.fadeOutAndStop(3000);
        });
        // #endif
    }

    bgDebug(tag, extra = {}) {
        try {
            const m = this.bgAudioManager;
            const payload = {
                tag,
                state: this.state,
                hasBg: !!m,
                src: m?.src,
                lastBgSrc: this.lastBgSrc,
                paused: m?.paused,
                currentTime: m?.currentTime,
                duration: m?.duration,
                ...extra
            };
            console.log('[BG]', payload);
        } catch (_e) {
            // ignore
        }
    }

    /**
     * 从本地存储恢复上一次后台音频 src
     */
    restoreLastBgSrc() {
        try {
            const src = uni.getStorageSync && uni.getStorageSync('WN_LAST_BG_SRC');
            if (src) this.lastBgSrc = src;
        } catch (e) {
            // ignore
        }
    }

    /**
     * 初始化后端单文件播放器
     */
    initBackgroundAudio() {
        try {
            this.bgAudioManager = uni.getBackgroundAudioManager();
            
            if (this.bgAudioManager) {
                this.bgDebug('init');

                this.bgAudioManager.onPlay(() => {
                    this.bgDebug('onPlay');
                });

                this.bgAudioManager.onEnded(() => {
                    this.bgDebug('onEnded');
                    // 监听播放结束，重新设置 src 实现单曲循环
                    if (this.lastBgSrc) {
                        const currentSrc = this.lastBgSrc;
                        // 直接设置新 src，不要先设置空字符串（某些机型会报错）
                        setTimeout(() => {
                            try {
                                this.bgAudioManager.src = currentSrc;
                                this.bgAudioManager.play();
                            } catch (e) {
                                console.warn('[AudioEngine] onEnded 循环播放失败:', e);
                            }
                        }, 200);
                    }
                });

                // 切后台/系统打断时，尝试保持状态（真机更有效，devtools 可能仍会被限制）
                this.bgAudioManager.onPause(() => {
                    this.bgDebug('onPause');
                });

                this.bgAudioManager.onStop(() => {
                    this.bgDebug('onStop');
                });

                this.bgAudioManager.onWaiting(() => {
                    this.bgDebug('onWaiting');
                });

                this.bgAudioManager.onCanplay(() => {
                    this.bgDebug('onCanplay');
                });

                this.bgAudioManager.onTimeUpdate(() => {
                    // 降频：每 ~5s 打一次
                    const t = Number(this.bgAudioManager.currentTime || 0);
                    if (!this._lastTimeLog || Math.abs(t - this._lastTimeLog) >= 5) {
                        this._lastTimeLog = t;
                        this.bgDebug('onTimeUpdate');
                    }
                });

                this.bgAudioManager.onError((err) => {
                    this.bgDebug('onError', { err });
                    this.handleError(new Error(err?.errMsg || '后端音频播放失败'));
                });
            }
        } catch (e) {
            console.warn('[AudioEngine] 无法初始化 BackgroundAudioManager:', e);
        }
    }

    /**
     * 初始化本地轨道播放器
     * @param {Array} tracks - 轨道配置数组
     */
    async initTrackPlayers(tracks) {
        // 清理旧的播放器
        this.trackPlayers.forEach(player => {
            if (player.context) {
                player.context.stop();
                player.context.destroy();
            }
        });
        this.trackPlayers.clear();

        // 创建新的播放器
        for (const track of tracks) {
            const ctx = uni.createInnerAudioContext();
            ctx.loop = true;
            ctx.obeyMuteSwitch = false;

            this.trackPlayers.set(track.id, {
                id: track.id,
                context: ctx,
                volume: track.defaultVolume || 0,
                isPlaying: false
            });
        }

        console.log('[AudioEngine] 轨道播放器初始化完成:', this.trackPlayers.size);
    }

    /**
     * 设置事件回调
     * @param {AudioEngineCallbacks} callbacks 
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * 状态变更处理
     * @param {string} newState 
     */
    setState(newState) {
        if (this.state === newState) return;

        this.prevState = this.state;
        this.state = newState;

        console.log(`[AudioEngine] 状态变更: ${this.prevState} -> ${this.state}`);
        
        if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(this.state, this.prevState);
        }
    }

    /**
     * 获取当前状态
     */
    getState() {
        return this.state;
    }

    /**
     * 设置轨道音量（Mode A）
     * @param {string} trackId 
     * @param {number} volume 
     */
    async setTrackVolume(trackId, volume) {
        const player = this.trackPlayers.get(trackId);
        if (!player) return;

        player.volume = volume;
        
        if (player.context) {
            player.context.volume = volume;
        }

        // 更新当前配置
        const trackConfig = this.currentTracks.find(t => t.id === trackId);
        if (trackConfig) {
            trackConfig.vol = volume;
        } else if (volume > 0) {
            this.currentTracks.push({ id: trackId, vol: volume });
        }

        // 如果正在播放，实时更新音量
        if (player.isPlaying && volume > 0) {
            player.context && player.context.play();
        } else if (volume === 0) {
            player.context && player.context.pause();
        }
    }

    /**
     * 获取所有轨道音量配置
     */
    getTrackVolumes() {
        const volumes = [];
        this.trackPlayers.forEach((player, id) => {
            volumes.push({ id, vol: player.volume });
        });
        return volumes;
    }

    /**
     * ==================== Mode A：本地多路混音 ====================
     * 
     * 立即切换到本地多路混音模式
     */
    async switchToLocalMix() {
        console.log('[AudioEngine] 切换到 Mode A（本地多路混音）');

        // 1. 停止 Mode B
        this.stopBackgroundAudio();

        // 2. 取消正在进行的下载
        this.resourceManager && this.resourceManager.cancelCurrentDownload();

        // 3. 更新状态
        this.setState(AudioEngineState.LOCAL_MIX);

        // 4. 播放所有活跃轨道
        this.playActiveTracks();
    }

    /**
     * 播放所有活跃的本地轨道
     */
    playActiveTracks() {
        this.trackPlayers.forEach((player) => {
            if (player.volume > 0 && !player.isPlaying) {
                player.isPlaying = true;
                player.context && player.context.play();
            } else if (player.volume === 0 && player.isPlaying) {
                player.isPlaying = false;
                player.context && player.context.pause();
            }
        });
    }

    /**
     * 停止所有本地轨道
     */
    stopAllLocalTracks() {
        this.trackPlayers.forEach((player) => {
            player.isPlaying = false;
            player.context && player.context.pause();
        });
    }

    /**
     * 渐出所有活跃轨道（降低到指定音量）
     * @param {number} targetVolume 目标音量，默认 0.05
     * @param {number} fadeDuration 渐出时长（毫秒），默认 500ms
     * @returns {Promise} 渐出完成后 resolve
     */
    fadeOutActiveTracks(targetVolume = 0.05, fadeDuration = 500) {
        return new Promise((resolve) => {
            const activePlayers = [];
            this.trackPlayers.forEach((player) => {
                if (player.isPlaying && player.volume > 0) {
                    activePlayers.push(player);
                }
            });

            if (activePlayers.length === 0) {
                resolve();
                return;
            }

            const startTime = Date.now();
            const initialVolumes = activePlayers.map(p => p.volume);
            const step = 50;
            const fadeStep = initialVolumes.map((v, i) =>
                (v - targetVolume) / (fadeDuration / step)
            );

            const fadeOut = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed >= fadeDuration) {
                    activePlayers.forEach((player, i) => {
                        player.volume = targetVolume;
                        if (player.context) {
                            player.context.volume = targetVolume;
                        }
                    });
                    resolve();
                    return;
                }

                activePlayers.forEach((player, i) => {
                    const newVol = Math.max(targetVolume, initialVolumes[i] - fadeStep[i] * (elapsed / step));
                    player.volume = newVol;
                    if (player.context) {
                        player.context.volume = newVol;
                    }
                });

                setTimeout(fadeOut, step);
            };

            fadeOut();
        });
    }

    /**
     * ==================== Mode B：后端单文件 ====================
     * 
     * 请求后端合成并下载混合音频
     */
    async switchToCloudMix(tracks, duration) {
        const trackVolumes = tracks || this.getTrackVolumes();
        this.currentTracks = trackVolumes;
        this.currentDuration = duration || this.currentDuration;

        const activeTracks = trackVolumes.filter(t => t.vol > 0);
        
        if (activeTracks.length === 0) {
            console.log('[AudioEngine] 没有活跃轨道，切换到本地空状态');
            this.setState(AudioEngineState.IDLE);
            return;
        }

        console.log('[AudioEngine] 请求后端合成 (Mode B):', activeTracks);

        // 1. 取消之前的下载任务
        this.resourceManager && this.resourceManager.cancelCurrentDownload();

        // 2. 停止后台音频
        this.stopBackgroundAudio();

        // 3. 切换到本地混音（保持播放）并渐出到 0.05
        this.setState(AudioEngineState.LOCAL_MIX);
        this.playActiveTracks();

        // 4. 请求后端合成
        this.setState(AudioEngineState.CLOUD_LOADING);

        // 同时开始本地轨道渐出到 0.05
        this.fadeOutActiveTracks(0.05, 500);

        try {
            const localPath = await this.resourceManager.queueMixedDownload(
                activeTracks,
                this.currentDuration,
                {
                    onStart: () => {
                        console.log('[AudioEngine] 开始下载混合音频');
                        this.setState(AudioEngineState.CLOUD_LOADING);
                    },
                    onProgress: (progress) => {
                        this.callbacks.onProgress && this.callbacks.onProgress(progress);
                    },
                    onSuccess: async (path) => {
                        console.log('[AudioEngine] 混合音频下载成功:', path);

                        // 停止本地轨道（音量已在渐出后降至 0.05）
                        this.stopAllLocalTracks();

                        // 切换到后端音频播放
                        await this.playBackgroundAudio(path);

                        // 更新状态
                        this.setState(AudioEngineState.READY);

                        // 几秒后隐藏提示
                        setTimeout(() => {
                            if (this.state === AudioEngineState.READY) {
                                // 保持 READY 状态
                            }
                        }, 3000);
                    },
                    onError: (error) => {
                        console.error('[AudioEngine] 混合音频下载失败:', error);
                        this.handleError(error);
                    }
                }
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 使用 BackgroundAudioManager 播放后端音频
     * @param {string} localPath 本地文件路径
     */
    async playBackgroundAudio(localPath) {
        if (!this.bgAudioManager) {
            console.warn('[AudioEngine] BackgroundAudioManager 不可用');
            return;
        }

        return new Promise((resolve, reject) => {
            // BackgroundAudioManager 需要网络 URL 或本地临时路径
            // 本地持久化路径需要转换为临时路径
            let src = localPath;
            
            // 如果是本地文件，复制到临时目录
            if (localPath.includes(uni.env.USER_DATA_PATH)) {
                const tempPath = `${uni.env.TEMP_PATH || '/tmp'}/mixed_${Date.now()}.mp3`;
                try {
                    const fs = uni.getFileSystemManager();
                    fs.copyFile({
                        srcPath: localPath,
                        destPath: tempPath,
                        success: () => {
                            src = tempPath;
                            this.startBgPlay(src, resolve, reject);
                        },
                        fail: (err) => {
                            // 复制失败，直接尝试播放原始路径
                            console.warn('[AudioEngine] 复制临时文件失败:', err);
                            this.startBgPlay(src, resolve, reject);
                        }
                    });
                    return;
                } catch (e) {
                    console.warn('[AudioEngine] 文件操作失败:', e);
                }
            }
            
            this.startBgPlay(src, resolve, reject);
        });
    }

    /**
     * 启动后台播放
     */
    startBgPlay(src, resolve, reject) {
        this.bgAudioManager.title = '眠融 - 白噪音';
        // 注释掉 loop = true，改为手动在 onEnded 中重新设置 src 实现循环（更可靠）
        // this.bgAudioManager.loop = true; 
        this.lastBgSrc = src;
        try {
            uni.setStorageSync && uni.setStorageSync('WN_LAST_BG_SRC', src);
        } catch (e) {
            // ignore
        }
        this.bgDebug('setSrc_begin', { nextSrc: src });
        this.bgAudioManager.src = src;

        this.bgAudioManager.onPlay(() => {
            console.log('[AudioEngine] 后端音频开始播放 (Loop Mode)');
            this.bgDebug('setSrc_onPlay');
            resolve();
        });

        this.bgAudioManager.onError((err) => {
            this.bgDebug('setSrc_onError', { err });
            reject(new Error(err?.errMsg || '播放失败'));
        });
    }

    /**
     * 停止后端音频播放
     */
    stopBackgroundAudio() {
        if (this.bgAudioManager) {
            this.bgDebug('stopBackgroundAudio');
            this.bgAudioManager.stop();
        }
    }

    /**
     * App 回到前台时尝试恢复后台音频播放
     * 注意：首次打开时不自动恢复，需要用户手动点击播放
     */
    onAppShow() {
        if (!this.bgAudioManager) return;
        if (!this.lastBgSrc) return;

        // 如果之前不在 READY 状态（正在播放），则不自动恢复
        // 这样确保每次打开 app 都需要用户手动点击播放
        if (this.prevState !== AudioEngineState.READY) {
            this.bgDebug('onAppShow_skip_not_ready');
            return;
        }

        // READY 状态下优先恢复 Mode B
        try {
            this.bgDebug('onAppShow_before');
            // 如果 src 丢了（被系统清空），重新设置
            if (!this.bgAudioManager.src) {
                this.bgAudioManager.title = '眠融 - 白噪音';
                this.bgAudioManager.src = this.lastBgSrc;
            } else {
                this.bgAudioManager.play();
            }
            this.bgDebug('onAppShow_after');
        } catch (e) {
            // ignore
        }
    }

    /**
     * App 进入后台时（可选）记录状态
     */
    onAppHide() {
        // 目前无需额外处理；保留接口便于后续扩展
        this.bgDebug('onAppHide');
    }

    /**
     * 处理错误
     * @param {Error} error 
     */
    handleError(error) {
        this.setState(AudioEngineState.ERROR);
        this.callbacks.onError && this.callbacks.onError(error);

        // 自动回退到本地模式
        setTimeout(() => {
            console.log('[AudioEngine] 自动回退到本地模式');
            this.setState(AudioEngineState.LOCAL_MIX);
            this.playActiveTracks();
        }, 3000);
    }

    /**
     * ==================== 全局播放控制 ====================
     */
    
    /**
     * 播放/暂停
     * @param {boolean} isPlaying
     */
    togglePlay(isPlaying) {
        if (isPlaying) {
            // 从暂停恢复播放
            if (this.state === AudioEngineState.LOCAL_MIX || this.state === AudioEngineState.IDLE) {
                const activeTracks = this.getTrackVolumes().filter(t => t.vol > 0);

                if (activeTracks.length === 0) {
                    // 没有活跃音轨
                    this.playActiveTracks();
                    return;
                }

                // 平台差异化策略
                if (this.shouldUseCloudMix(activeTracks)) {
                    // 微信小程序：使用后端合成
                    console.log('[AudioEngine] 小程序模式，触发云混音');
                    this.switchToCloudMix(activeTracks, this.currentDuration);
                } else {
                    // App端：本地多路混音
                    console.log('[AudioEngine] App模式，使用本地混音');
                    this.setState(AudioEngineState.LOCAL_MIX);
                    this.playActiveTracks();

                    // 如果需要后台播放，设置锁屏信息
                    if (supportBackgroundPlayback()) {
                        this.setBackgroundAudioInfo({ name: this.getCurrentMixName() });
                    }
                }
            } else if (this.state === AudioEngineState.READY) {
                // Mode B：恢复后台单文件
                if (this.bgAudioManager) {
                    this.bgDebug('togglePlay_ready_play');
                    try {
                        this.bgAudioManager.play();
                    } catch (e) {
                        // ignore
                    }
                }
            }
        } else {
            // 暂停：本地混音 + 后台单文件都进入暂停态，但不销毁实例
            this.stopAllLocalTracks();
            if (this.bgAudioManager) {
                this.bgDebug('togglePlay_pause_bg');
                try {
                    this.bgAudioManager.pause();
                } catch (e) {
                    // ignore
                }
            }
        }
    }

    /**
     * 停止所有播放
     */
    stop() {
        this.stopAllLocalTracks();
        this.stopBackgroundAudio();
        this.setState(AudioEngineState.IDLE);
    }

    /**
     * 销毁引擎
     */
    destroy() {
        this.stop();
        this.trackPlayers.forEach(player => {
            player.context && player.context.destroy();
        });
        this.trackPlayers.clear();
        this.resourceManager && this.resourceManager.cancelCurrentDownload();
    }
}

// ==================== 平台差异化方法 ====================

    /**
     * 判断是否应该使用后端合成
     * @param {Array} tracks - 音轨数组
     * @returns {boolean}
     */
    shouldUseCloudMix(tracks) {
        return shouldUseCloudSynthesis(tracks);
    }

    /**
     * 设置锁屏音频信息（App端）
     */
    setBackgroundAudioInfo(mixInfo) {
        if (!this.bgAudioManager || !isApp()) return;

        const info = getBackgroundAudioInfo(mixInfo);
        this.bgAudioManager.title = info.title;
        this.bgAudioManager.singer = info.singer;
        if (info.coverImgUrl) {
            this.bgAudioManager.coverImgUrl = info.coverImgUrl;
        }
    }

    /**
     * 初始化音频中断监听（App端）
     */
    initAudioInterruptionListener() {
        // #ifdef APP-PLUS
        uni.onAudioInterruptionBegin(() => {
            console.log('[AudioEngine] 音频中断开始');
            this._wasPlayingBeforeInterruption = this.state === AudioEngineState.READY ||
                this.state === AudioEngineState.LOCAL_MIX;
            if (this._wasPlayingBeforeInterruption) {
                this._isInterrupted = true;
            }
        });

        uni.onAudioInterruptionEnd(() => {
            console.log('[AudioEngine] 音频中断结束');
            if (this._isInterrupted && this._wasPlayingBeforeInterruption) {
                // 延迟恢复，避免抢占冲突
                setTimeout(() => {
                    this.resume();
                    this._isInterrupted = false;
                    this._wasPlayingBeforeInterruption = false;
                }, 500);
            }
        });
        // #endif
    }

    /**
     * 恢复播放（中断后）
     */
    resume() {
        if (this.state === AudioEngineState.READY && this.bgAudioManager) {
            try {
                this.bgAudioManager.play();
            } catch (e) {
                console.warn('[AudioEngine] 恢复播放失败:', e);
            }
        } else if (this.state === AudioEngineState.LOCAL_MIX) {
            this.playActiveTracks();
        }
    }

    /**
     * 获取当前混音名称
     */
    getCurrentMixName() {
        const activeTracks = this.currentTracks.filter(t => (t.vol || 0) > 0);
        if (activeTracks.length === 0) return '无';
        if (activeTracks.length === 1) {
            return this.getTrackName(activeTracks[0].id) || '单音轨';
        }
        return '混音组合';
    }

    /**
     * 获取音轨名称
     */
    getTrackName(trackId) {
        // 从 ResourceManager 获取音轨信息
        if (this.resourceManager && this.resourceManager.getTrackInfo) {
            const info = this.resourceManager.getTrackInfo(trackId);
            return info?.name || null;
        }
        return null;
    }

    /**
     * 渐出并停止（计时器到时）
     * @param {number} fadeDuration 渐出时长（毫秒）
     */
    fadeOutAndStop(fadeDuration = 3000) {
        console.log('[AudioEngine] 渐出并停止');

        if (this.state === AudioEngineState.READY && this.bgAudioManager) {
            // Mode B：使用 BackgroundAudioManager 的音量渐变
            // #ifdef APP-PLUS
            const startVolume = this.bgAudioManager.volume || 1;
            const startTime = Date.now();
            const step = 100;
            const volumeStep = startVolume / (fadeDuration / step);

            const fadeOut = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed >= fadeDuration) {
                    this.bgAudioManager.volume = 0;
                    this.stop();
                    return;
                }
                const newVolume = Math.max(0, startVolume - volumeStep * (elapsed / step));
                this.bgAudioManager.volume = newVolume;
                setTimeout(fadeOut, step);
            };
            fadeOut();
            // #endif

            // #ifndef APP-PLUS
            this.stop();
            // #endif
        } else if (this.state === AudioEngineState.LOCAL_MIX) {
            // Mode A：使用本地渐出
            this.fadeOutActiveTracks(0, fadeDuration).then(() => {
                this.stop();
            });
        } else {
            this.stop();
        }
    }

// ==================== 导出单例 ====================
export const audioEngine = new AudioEngine();
export default audioEngine;
