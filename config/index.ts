/**
 * 全局配置文件
 */

// NAS 远程音频基础路径 (用户需替换为自己的私有 NAS 域名)
// 微信小程序生产环境需在 MP 后台配置此域名的 downloadFile 合法域名
export const NAS_BASE_URL = 'https://sounds.zhuyin.pro:1024/sounds/';

export interface TrackConfig {
    id: string;
    name: string;
    icon: string;
    fileName: string;
    defaultVolume: number;
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
