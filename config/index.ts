/**
 * 全局配置文件
 * 支持动态音源配置和用户自定义音源扩展
 */

// uni-app 全局变量声明兜底（用于 TS 类型检查）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;

/**
 * 环境判断：
 * - 微信开发者工具：platform === 'devtools'
 * - 真机：platform === 'ios' | 'android'
 */
const systemInfo = uni.getSystemInfoSync?.() || {};
const isDevtools = systemInfo.platform === 'devtools';

// Lucky 反向代理域名（生产/真机访问后端与静态资源的统一入口）
export const LUCKY_BASE_URL = 'https://sounds.zhuyin.pro:1024';

// NAS/静态音源基础路径
// 微信小程序生产环境需在 MP 后台配置该域名为 downloadFile 合法域名
export const NAS_BASE_URL = isDevtools
  ? `${LUCKY_BASE_URL}/sounds/`
  : `${LUCKY_BASE_URL}/sounds/`;

// 后端合成服务基础路径（给 /api/v1/synthesize 使用）
// - 开发者工具：直连本机 Docker 映射端口 4000
// - 真机：必须走 Lucky 反代域名（不能用 localhost）
export const SERVER_BASE_URL = isDevtools
  ? LUCKY_BASE_URL
  : LUCKY_BASE_URL;

// 混合音频文件存储目录（小程序 USER_DATA_PATH）
// 注意：微信开发者工具里可能出现 http://usr 这种“非文件系统路径”的前缀
// FileSystemManager 需要 wxfile://usr（或真机上实际的 USER_DATA_PATH）
const userDataPathRaw = uni.env?.USER_DATA_PATH || '';
const userDataPath =
  typeof userDataPathRaw === 'string'
    ? userDataPathRaw.replace(/^http:\/\//, 'wxfile://')
    : userDataPathRaw;
export const MIXED_AUDIO_DIR = `${userDataPath}/mixed`;

// 用户自定义音源存储键
export const CUSTOM_TRACKS_KEY = 'WHITE_NOISE_CUSTOM_TRACKS';

// 默认混合音频时长（秒）
// 先用更短时长便于联调与快速体验；后续可切回更长时长
export const DEFAULT_MIX_DURATION = 120;

export interface TrackConfig {
    id: string;
    name: string;
    icon: string;
    fileName: string;
    defaultVolume: number;
    isCustom?: boolean;  // 是否为用户自定义音源
    sourceUrl?: string;  // 自定义音源的远程 URL
}

export const AUDIO_TRACKS: TrackConfig[] = [
    { id: 'wind', name: '风声', icon: '🌬️', fileName: 'wind.mp3', defaultVolume: 0.15 },
    { id: 'drizzle', name: '细雨', icon: '🌧️', fileName: 'drizzle.mp3', defaultVolume: 0.80 },
    { id: 'thunder', name: '远雷', icon: '⛈️', fileName: 'thunder.mp3', defaultVolume: 0 },
    { id: 'wave', name: '海浪', icon: '🌊', fileName: 'wave.mp3', defaultVolume: 0.60 },
    { id: 'bonfire', name: '篝火', icon: '🔥', fileName: 'bonfire.mp3', defaultVolume: 0.30 },
    { id: 'bird', name: '林鸟', icon: '🐦', fileName: 'bird.mp3', defaultVolume: 0 },
    { id: 'insect', name: '夜虫', icon: '🦗', fileName: 'insect.mp3', defaultVolume: 0 },
    { id: 'dream', name: '入梦', icon: '✨', fileName: 'dream.mp3', defaultVolume: 0 },
];

/**
 * 获取所有音源（默认 + 用户自定义）
 * 支持动态扩展，无需硬编码
 */
export function getAllTracks(): TrackConfig[] {
    try {
        const customTracksJson = uni.getStorageSync(CUSTOM_TRACKS_KEY);
        const customTracks: TrackConfig[] = customTracksJson ? JSON.parse(customTracksJson) : [];
        return [...AUDIO_TRACKS, ...customTracks.map(t => ({ ...t, isCustom: true }))];
    } catch (e) {
        console.warn('[Config] 加载自定义音源失败:', e);
        return [...AUDIO_TRACKS];
    }
}

/**
 * 添加用户自定义音源
 */
export function addCustomTrack(track: TrackConfig): void {
    const customTracksJson = uni.getStorageSync(CUSTOM_TRACKS_KEY);
    const customTracks: TrackConfig[] = customTracksJson ? JSON.parse(customTracksJson) : [];
    customTracks.push({ ...track, isCustom: true });
    uni.setStorageSync(CUSTOM_TRACKS_KEY, JSON.stringify(customTracks));
}

/**
 * 删除用户自定义音源
 */
export function removeCustomTrack(trackId: string): void {
    const customTracksJson = uni.getStorageSync(CUSTOM_TRACKS_KEY);
    const customTracks: TrackConfig[] = customTracksJson ? JSON.parse(customTracksJson) : [];
    const filtered = customTracks.filter(t => t.id !== trackId);
    uni.setStorageSync(CUSTOM_TRACKS_KEY, JSON.stringify(filtered));
}
