/**
 * platformUtils.js - 平台差异化工具
 *
 * 职责：
 * 1. 判断当前运行平台
 * 2. 提供平台相关的差异化配置
 * 3. 音频混音策略判断
 */

// ==================== 平台枚举 ====================
export const Platform = {
    IOS: 'ios',
    ANDROID: 'android',
    WEIXIN: 'weixin',
    H5: 'h5',
    UNKNOWN: 'unknown'
};

// ==================== 混音模式 ====================
export const MixMode = {
    LOCAL: 'LOCAL',           // 本地多路混音
    CLOUD: 'CLOUD',           // 后端合成
    LOCAL_FALLBACK: 'LOCAL_FALLBACK'  // 本地优先，失败后降级到后端
};

// ==================== 平台判断 ====================
let cachedPlatform = null;

/**
 * 获取当前平台
 * @returns {string} Platform enum value
 */
export function getPlatform() {
    if (cachedPlatform) return cachedPlatform;

    // #ifdef APP-PLUS
    const systemInfo = uni.getSystemInfoSync();
    if (systemInfo.platform === 'ios') {
        cachedPlatform = Platform.IOS;
    } else {
        cachedPlatform = Platform.ANDROID;
    }
    // #endif

    // #ifdef MP-WEIXIN
    cachedPlatform = Platform.WEIXIN;
    // #endif

    // #ifdef H5
    cachedPlatform = Platform.H5;
    // #endif

    // #ifndef APP-PLUS
    if (!cachedPlatform) {
        cachedPlatform = Platform.H5;
    }
    // #endif

    return cachedPlatform;
}

/**
 * 是否为App端（iOS或Android）
 */
export function isApp() {
    const p = getPlatform();
    return p === Platform.IOS || p === Platform.ANDROID;
}

/**
 * 是否为iOS平台
 */
export function isIOS() {
    return getPlatform() === Platform.IOS;
}

/**
 * 是否为Android平台
 */
export function isAndroid() {
    return getPlatform() === Platform.ANDROID;
}

/**
 * 是否为微信小程序
 */
export function isWeixin() {
    return getPlatform() === Platform.WEIXIN;
}

/**
 * 是否为H5平台
 */
export function isH5() {
    return getPlatform() === Platform.H5;
}

// ==================== 音频混音策略 ====================

/**
 * 判断是否应该使用后端合成
 * @param {Array} tracks - 音轨数组，每个元素包含 id 和 vol
 * @returns {boolean} true=使用后端合成，false=使用本地混音
 */
export function shouldUseCloudSynthesis(tracks) {
    // 微信小程序：始终使用后端合成
    if (isWeixin()) {
        return true;
    }

    // App端逻辑
    if (isApp()) {
        // 获取活跃音轨（音量 > 0）
        const activeTracks = tracks.filter(t => (t.vol || 0) > 0);

        // 单音轨：使用本地混音（不需要合成）
        if (activeTracks.length <= 1) {
            return false;
        }

        // 多音轨：默认使用本地混音
        // 保留后端合成作为降级方案（在 AudioEngine 中处理）
        return false;
    }

    // H5或其他平台：使用本地混音
    return false;
}

/**
 * 获取推荐的混音模式
 * @param {Array} tracks - 音轨数组
 * @returns {string} MixMode enum value
 */
export function getRecommendedMixMode(tracks) {
    const activeTracks = tracks.filter(t => (t.vol || 0) > 0);

    if (isWeixin()) {
        return MixMode.CLOUD;
    }

    if (isApp()) {
        if (activeTracks.length <= 1) {
            return MixMode.LOCAL;
        }
        // App端多音轨：本地优先
        return MixMode.LOCAL_FALLBACK;
    }

    return MixMode.LOCAL;
}

/**
 * 是否支持后台播放
 * @returns {boolean}
 */
export function supportBackgroundPlayback() {
    // App端支持后台播放
    return isApp();
}

/**
 * 获取锁屏音频信息
 * @param {Object} mixInfo - 混音信息 { name, coverUrl? }
 * @returns {Object} 锁屏信息配置
 */
export function getBackgroundAudioInfo(mixInfo) {
    return {
        title: mixInfo?.name || '眠融 - 白噪音',
        singer: '白噪音助眠',
        coverImgUrl: mixInfo?.coverUrl || '/static/icon.png',
        ...mixInfo
    };
}

// ==================== 分享配置 ====================

/**
 * 获取分享配置
 * @param {Object} params - 分享参数 { type, id, title?, desc? }
 * @returns {Object} 微信分享配置
 */
export function getShareConfig(params = {}) {
    const { type = 'home', id = '', title, desc } = params;

    const defaultTitles = {
        home: '眠融 - 白噪音助眠',
        sound: '眠融 - 精选声音',
        mix: '眠融 - 我的混音',
        favorite: '眠融 - 收藏夹'
    };

    const defaultDescs = {
        home: '我用眠融听着海浪声入睡，你也来试试~',
        sound: '这个声音真的很助眠，推荐给你~',
        mix: '这是我精心调配的白噪音组合，超级助眠！',
        favorite: '这些是我收藏的好听声音，一起听听吧~'
    };

    // 构建分享路径
    let path = '/pages/index/index';
    if (type === 'sound' && id) {
        path = `/pages/sound-library/index?soundId=${id}`;
    } else if (type === 'mix' && id) {
        path = `/pages/index/index?mixId=${id}`;
    } else if (type === 'favorite' && id) {
        path = `/pages/favorites/index?favId=${id}`;
    }

    return {
        title: title || defaultTitles[type] || defaultTitles.home,
        desc: desc || defaultDescs[type] || defaultDescs.home,
        path,
        imageUrl: ''
    };
}

/**
 * 解析分享参数（从URL或启动参数中）
 * @returns {Object} 解析后的参数
 */
export function parseShareParams() {
    // #ifdef MP-WEIXIN
    const options = uni.getLaunchOptionsSync?.() || {};
    const { query = {} } = options;
    return {
        mixId: query.mixId || null,
        soundId: query.soundId || null,
        favId: query.favId || null,
        scene: query.scene || null
    };
    // #endif

    // #ifndef MP-WEIXIN
    // App端或其他平台从缓存/状态中获取
    return {
        mixId: null,
        soundId: null,
        favId: null,
        scene: null
    };
    // #endif
}

// ==================== 防抖工具 ====================

/**
 * 创建防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟毫秒
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

/**
 * 创建节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} interval - 间隔毫秒
 * @returns {Function}
 */
export function throttle(fn, interval = 300) {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= interval) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
}

// ==================== 导出 ====================
export default {
    Platform,
    MixMode,
    getPlatform,
    isApp,
    isIOS,
    isAndroid,
    isWeixin,
    isH5,
    shouldUseCloudSynthesis,
    getRecommendedMixMode,
    supportBackgroundPlayback,
    getBackgroundAudioInfo,
    getShareConfig,
    parseShareParams,
    debounce,
    throttle
};
