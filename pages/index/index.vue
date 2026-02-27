<template>
  <view class="app-root">
    <!-- ═══════════════════════════════════════
         顶部：动态水墨视觉区
    ════════════════════════════════════════ -->
    <view class="visual-area">
      <!-- Canvas 背景 -->
      <MeditationCanvas class="canvas-layer" :active-tracks="activeTracks" />

      <!-- 渐变蒙版，保证文字可读性 -->
      <view class="visual-gradient-top" />
      <view class="visual-gradient-bottom" />

      <!-- 标题覆盖层 -->
      <view class="visual-overlay">
        <text class="app-title">~~ 冥想空间 ~~</text>
        <view class="scene-badge" v-if="currentSceneText !== '静寂无声'">
          <text class="scene-dot">●</text>
          <text class="scene-text">{{ currentSceneText }}</text>
        </view>
        <view class="scene-badge-off" v-else>
          <text class="scene-text-off">静寂无声</text>
        </view>
      </view>
    </view>

    <!-- ═══════════════════════════════════════
         中部：8 通道调音台
    ════════════════════════════════════════ -->
    <view class="mixer-panel">
      <!-- 顶部装饰线 -->
      <view class="panel-header">
        <view class="panel-led" :class="{ 'led-on': isGlobalPlaying && hasActiveTracks }"></view>
        <text class="panel-label">MIXER · 8CH</text>
        <view class="panel-led" :class="{ 'led-on': isGlobalPlaying && hasActiveTracks }"></view>
      </view>

      <view class="channels-scroll">
        <view class="channels-row">
          <!-- 每个通道 -->
          <view
            class="channel-strip"
            v-for="track in tracks"
            :key="track.id"
            :class="{ 'channel-active': track.volume > 0 }"
            @longpress="onTrackLongPress(track.id)"
          >
            <!-- 通道名 -->
            <view class="ch-icon-wrap">
              <text class="ch-icon">{{ track.icon }}</text>
            </view>
            <text class="ch-name">{{ track.name }}</text>

            <!-- 自定义竖向触摸推子 -->
            <view
              class="fader-rail"
              :id="'fader-rail-' + track.id"
              @touchstart.stop="onFaderTouchStart(track.id, $event)"
              @touchmove.stop.prevent="onFaderTouchMove(track.id, $event)"
              @touchend.stop="onFaderTouchEnd(track.id)"
            >
              <!-- 轨道刻度 -->
              <view class="fader-tick t100" />
              <view class="fader-tick t75" />
              <view class="fader-tick t50" />
              <view class="fader-tick t25" />
              <view class="fader-tick t0" />

              <!-- 填充进度条 (从底部向上) -->
              <view
                class="fader-fill"
                :style="{ height: (track.volume * 100) + '%', backgroundColor: getTrackColor(track.volume) }"
              />

              <!-- 推子滑块手柄 -->
              <view
                class="fader-knob"
                :style="{ bottom: 'calc(' + (track.volume * 100) + '% - 14px)' }"
              >
                <view class="knob-line" />
                <view class="knob-line" />
                <view class="knob-line" />
              </view>
            </view>

            <!-- 音量百分比 & 加载中遮罩 -->
            <view class="ch-status">
              <view v-if="track.isLoading" class="ch-loading-spinner" />
              <text class="ch-vol" :class="{ 'vol-active': track.volume > 0 && !track.isLoading }">
                {{ Math.round(track.volume * 100) }}
              </text>
            </view>
            <text class="ch-vol-unit">%</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ═══════════════════════════════════════
         底部：主控区
    ════════════════════════════════════════ -->
    <view class="master-bar">
      <!-- 睡眠定时按钮 -->
      <view class="master-btn" @click="toggleTimer" :class="{ 'btn-active': currentTimerIndex > 0 }">
        <text class="master-btn-icon">⏱</text>
        <text class="master-btn-label">{{ timerText }}</text>
      </view>

      <!-- 中央大播放按钮 -->
      <view
        class="play-btn"
        :class="{ 'play-btn-active': isGlobalPlaying }"
        @click="toggleGlobalPlay"
      >
        <view class="play-btn-ring" />
        <text class="play-btn-icon">{{ isGlobalPlaying ? '⏸' : '▶' }}</text>
      </view>

      <!-- 重置所有通道按钮 -->
      <view class="master-btn" @click="resetAll">
        <text class="master-btn-icon">↺</text>
        <text class="master-btn-label">重置</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import MeditationCanvas from '../../components/MeditationCanvas.vue';

// uni-app 全局变量声明兜底
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;

/* ─── 数据结构 ─── */
interface Track {
  id: string;
  name: string;
  icon: string;
  url: string;
  volume: number;
  defaultVolume: number; // 用于重置
  context: any | null;   // InnerAudioContext
  isLoading?: boolean;   // 是否正在从远程加载/缓存
}
import { AudioCacheManager } from '../../utils/audioCacheManager';
import { AUDIO_TRACKS, type TrackConfig } from '../../config/index';

/* ─── 8 轨道初始数据 ─── */
// url 为空字符串表示该轨道暂无音频文件，初始化时跳过
const tracks = ref<Track[]>(AUDIO_TRACKS.map((tc: TrackConfig) => ({
  ...tc,
  volume: tc.defaultVolume, // 必须初始化 volume，否则由于 NaN 导致初始 UI 无法拖拽
  url: tc.fileName,
  context: null,
  isLoading: false
})));

/* ─── 全局播放状态 ─── */
const isGlobalPlaying = ref(true);

/* ─── 计算属性 ─── */
const currentSceneText = computed(() => {
  const names = tracks.value.filter((t: Track) => t.volume > 0).map((t: Track) => t.name);
  if (!names.length) return '静寂无声';
  return names.join(' · ');
});

const hasActiveTracks = computed(() => tracks.value.some((t: Track) => t.volume > 0));

const activeTracks = computed(() =>
  tracks.value.filter((t: Track) => t.volume > 0).map((t: Track) => ({ id: t.id, volume: t.volume }))
);

/* ─── 推子颜色（根据音量渐变）─── */
const getTrackColor = (vol: number): string => {
  // 0 -> 深灰, 0.5 -> 蓝青, 1 -> 绿
  const r = Math.round(30 + vol * 20);
  const g = Math.round(60 + vol * 160);
  const b = Math.round(80 + vol * 60);
  return `rgb(${r}, ${g}, ${b})`;
};

/* ─── 推子布局缓存逻辑 (解决“不跟手”问题的核心) ─── */
const railsLayout = ref<Record<string, { top: number, height: number }>>({});

// 记录每个推子正在拖动时的轨道 id 和起始信息
const activeFaderState = ref<{
  id: string;
  startY: number;
  startVol: number;
  railHeight: number;
} | null>(null);

const cacheRailsLayout = () => {
  const query = uni.createSelectorQuery();
  tracks.value.forEach((t: Track) => {
    query.select('#fader-rail-' + t.id).boundingClientRect();
  });
  query.exec((res: any[]) => {
    if (res && res.length === tracks.value.length) {
      res.forEach((item, index) => {
        if (item) {
          railsLayout.value[tracks.value[index].id] = {
            top: item.top,
            height: item.height
          };
        }
      });
      console.log('[UI] 滑块轨道布局已缓存', railsLayout.value);
    }
  });
};

const onFaderTouchStart = (trackId: string, event: any) => {
  const touch = event.changedTouches[0];
  const layout = railsLayout.value[trackId];
  if (!layout) {
    // 降级处理：如果没有缓存到布局（如动态高度），则实时获取
    cacheRailsLayout();
    return;
  }
  
  const track = tracks.value.find((t: Track) => t.id === trackId)!;
  activeFaderState.value = {
    id: trackId,
    startY: touch.clientY,
    startVol: track.volume,
    railHeight: layout.height,
  };
};

const onFaderTouchMove = (trackId: string, event: any) => {
  if (!activeFaderState.value || activeFaderState.value.id !== trackId) return;
  const touch = event.changedTouches[0];
  const state = activeFaderState.value;
  // 向上拖 -> 增大音量（Y 减小），向下拖 -> 减小音量
  const deltaY = state.startY - touch.clientY;
  const deltaVol = deltaY / state.railHeight;
  const newVol = Math.min(1, Math.max(0, state.startVol + deltaVol));

  const track = tracks.value.find((t: Track) => t.id === trackId);
  if (!track) return;
  track.volume = parseFloat(newVol.toFixed(3));

  // 实时同步音量到 AudioContext
  if (track.context) {
    track.context.volume = newVol;

    if (newVol > 0 && isGlobalPlaying.value) {
      ensureTrackSource(track).then((shouldPlay) => {
        if (shouldPlay && isGlobalPlaying.value && track.volume > 0) track.context.play();
      });
    } else if (newVol === 0) {
      track.context.pause();
    }
  }
};

const onFaderTouchEnd = (_trackId: string) => {
  activeFaderState.value = null;
};

/* ─── 长按独奏 (Solo Mode) ─── */
const onTrackLongPress = (trackId: string) => {
  // 中等强度震动反馈
  uni.vibrateShort({ type: 'medium' });

  // 遍历所有音轨
  tracks.value.forEach((t: Track) => {
    if (t.id === trackId) {
      // 选中的音轨：如果是静音状态，赋一个默认音量让人听见；如果有声音，保持原音量
      const newVol = t.volume > 0 ? t.volume : Math.max(t.defaultVolume, 0.5);
      t.volume = newVol;
      if (t.context) {
        t.context.volume = newVol;
        if (isGlobalPlaying.value && newVol > 0) {
          ensureTrackSource(t).then((shouldPlay) => {
            if (shouldPlay && isGlobalPlaying.value && t.volume > 0) t.context.play();
          });
        }
      }
    } else {
      // 其他音轨：全部静音
      t.volume = 0;
      if (t.context) {
        t.context.volume = 0;
        t.context.pause();
      }
    }
  });

  const selectedTrack = tracks.value.find((t: Track) => t.id === trackId);
  if (selectedTrack) {
    uni.showToast({ title: `已独奏: ${selectedTrack.name}`, icon: 'none' });
  }
};

/* ─── 全局控制 ─── */
const toggleGlobalPlay = () => {
  isGlobalPlaying.value = !isGlobalPlaying.value;
  syncAllTracks();
};

// 核心调度：将 App 变量同步到所有轨道
const syncAllTracks = () => {
  tracks.value.forEach((t: Track) => {
    if (!t.context) return;
    if (isGlobalPlaying.value && t.volume > 0) {
      ensureTrackSource(t).then((shouldPlay) => {
        if (shouldPlay && isGlobalPlaying.value && t.volume > 0) {
          t.context.play();
        }
      });
    } else {
      t.context.pause();
    }
  });
};

const resetAll = () => {
  tracks.value.forEach((t: Track) => {
    t.volume = t.defaultVolume;
    if (t.context) {
      t.context.volume = t.defaultVolume;
      if (t.defaultVolume > 0 && isGlobalPlaying.value) {
        ensureTrackSource(t).then((shouldPlay) => {
           if (shouldPlay && isGlobalPlaying.value && t.volume > 0) t.context.play();
        });
      } else {
        t.context.pause();
      }
    }
  });
  uni.showToast({ title: '已恢复默认配置', icon: 'none' });
};

/* ─── 睡眠定时 ─── */
const timerOptions = [0, 15, 30, 60];
const currentTimerIndex = ref(0);
const remainingSeconds = ref(0);
let timerTimeout: ReturnType<typeof setTimeout> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

const timerText = computed(() => {
  if (currentTimerIndex.value === 0) return '定时';
  if (remainingSeconds.value > 0) {
    const m = Math.floor(remainingSeconds.value / 60);
    const s = remainingSeconds.value % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  return `${timerOptions[currentTimerIndex.value]}min`;
});

const toggleTimer = () => {
  currentTimerIndex.value = (currentTimerIndex.value + 1) % timerOptions.length;
  if (timerTimeout) { clearTimeout(timerTimeout); timerTimeout = null; }
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  const min = timerOptions[currentTimerIndex.value];
  if (min === 0) {
    remainingSeconds.value = 0;
    uni.showToast({ title: '定时已取消', icon: 'none' });
  } else {
    remainingSeconds.value = min * 60;
    timerTimeout = setTimeout(() => {
      isGlobalPlaying.value = false;
      tracks.value.forEach((t: Track) => t.context?.pause());
      currentTimerIndex.value = 0;
      remainingSeconds.value = 0;
      uni.showToast({ title: '定时结束，晚安 🌙', icon: 'none' });
    }, min * 60 * 1000);
    countdownInterval = setInterval(() => {
      if (remainingSeconds.value > 0) remainingSeconds.value--;
    }, 1000);
    uni.showToast({ title: `${min} 分钟后自动停止`, icon: 'none' });
  }
};

/* ─── 生命周期 ─── */

/**
 * 为一个轨道初始化 InnerAudioContext
 * - 设置 src / loop / volume
 * - 注册 onError 回调，出错时打印，不崩溃
 * - 仅当 volume > 0 且全局在播放时触发 play()
 */
const initTrackContext = (t: Track) => {
  if (!t.url) return; // 没有音频文件，跳过

  const ctx = uni.createInnerAudioContext() as any;
  // 注意：此处不再立刻赋予 src，改为按需加载逻辑
  ctx.loop           = true;          // 每条轨道独立循环
  ctx.volume         = t.volume;
  ctx.obeyMuteSwitch = false;      // iOS 静音拨片不影响白噪音

  // 错误监听
  ctx.onError((err: any) => {
    console.warn(`[MixAudio] ${t.id} error:`, err?.errMsg ?? err);
    t.isLoading = false;
  });

  t.context = ctx;

  // 如果初始音量大于 0 且全局在播放，则触发按需加载并播放
  if (t.volume > 0 && isGlobalPlaying.value) {
    ensureTrackSource(t).then((shouldPlay) => {
      if (shouldPlay && isGlobalPlaying.value && t.volume > 0) ctx.play();
    });
  }
};

/**
 * 核心逻辑：确保音轨已加载本地/缓存路径
 * 并在真机上通过 onCanplay 确保 Buffer 就绪后再 resolve
 * @returns Promise<boolean> 是否允许播放
 */
const ensureTrackSource = async (t: Track): Promise<boolean> => {
  if (!t.url || !t.context) return false;
  
  // 如果已经有源且处于就绪状态，直接返回 true
  if (t.context.src) return true;
  if (t.isLoading) return false; // 已经在加载中

  try {
    t.isLoading = true;
    const localPath = await AudioCacheManager.getAudioPath(t.url);
    
    // 返回一个 Promise，等待 onCanplay 事件
    return await new Promise((resolve) => {
      // 超时处理：如果 10s 还没准备好，防止 UI 一直转圈
      const timer = setTimeout(() => {
        console.warn(`[App] ${t.id} onCanplay timeout`);
        resolve(false);
      }, 10000);

      t.context.onCanplay(() => {
        clearTimeout(timer);
        console.log(`[App] ${t.id} ready to play`);
        resolve(true);
      });

      t.context.src = localPath;
    });
  } catch (e: any) {
    console.error(`[App] 音轨 ${t.id} 加载失败`, e);
    const msg = e?.errMsg || e?.message || '网络或证书错误';
    uni.showToast({ title: `${t.name} 加载失败: ${msg}`, icon: 'none', duration: 3000 });
    return false;
  } finally {
    t.isLoading = false;
  }
};

onMounted(() => {
  // 设置音频基础选项
  if (uni.setInnerAudioOption) {
    uni.setInnerAudioOption({
      obeyMuteSwitch: false,
      mixWithOther: true
    });
  }

  tracks.value.forEach((t: Track) => initTrackContext(t));
  
  // 启动时同步初始播放状态
  syncAllTracks();

  // 渲染完成后延迟缓存位置信息
  setTimeout(cacheRailsLayout, 300);
});

onUnmounted(() => {
  if (timerTimeout) clearTimeout(timerTimeout);
  if (countdownInterval) clearInterval(countdownInterval);
  tracks.value.forEach((t: Track) => {
    t.context?.stop();
    t.context?.destroy();
    t.context = null;
  });
});
</script>

<style scoped>
/* ══════════════════════════════════════
   全局根容器
══════════════════════════════════════ */
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #0a0a0f;
  overflow: hidden;
}

/* ══════════════════════════════════════
   顶部视觉区
══════════════════════════════════════ */
.visual-area {
  position: relative;
  height: 35vh;
  flex-shrink: 0;
  overflow: hidden;
}

.canvas-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.visual-gradient-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, rgba(10,10,15,0.9) 0%, transparent 100%);
  z-index: 2;
  pointer-events: none;
}

.visual-gradient-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(to top, rgba(10,10,15,1) 0%, transparent 100%);
  z-index: 2;
  pointer-events: none;
}

.visual-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 18px 0 16px;
  pointer-events: none;
}

.app-title {
  font-size: 22px;
  font-weight: 200;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 6px;
  text-shadow: 0 0 30px rgba(100, 200, 255, 0.4);
}

.scene-badge {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 5px 14px;
  gap: 6px;
}

.scene-dot {
  font-size: 8px;
  color: #4ecca3;
  animation: pulse 2s ease-in-out infinite;
}

.scene-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 1px;
}

.scene-badge-off {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 5px 14px;
}

.scene-text-off {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 2px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ══════════════════════════════════════
   调音台面板
══════════════════════════════════════ */
.mixer-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #10101a 0%, #0d0d14 100%);
  border-top: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
  min-height: 0;
}

.panel-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 8px;
}

.panel-label {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 3px;
  font-family: monospace;
}

.panel-led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #333;
  transition: background 0.5s;
  box-shadow: none;
}

.led-on {
  background: #4ecca3;
  box-shadow: 0 0 8px #4ecca3, 0 0 16px rgba(78, 204, 163, 0.4);
  animation: led-flicker 3s ease-in-out infinite;
}

@keyframes led-flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.7; }
  94% { opacity: 1; }
}

.channels-scroll {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.channels-row {
  display: flex;
  flex-direction: row;
  padding: 0 8px 10px;
  gap: 2px;
  width: 100%;
  box-sizing: border-box;
}

/* ── 单个通道 ── */
.channel-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 6px 2px 8px;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  transition: background 0.3s, border-color 0.3s;
}

.channel-active {
  background: rgba(78, 204, 163, 0.05);
  border-color: rgba(78, 204, 163, 0.2);
}

.ch-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  border: 1px solid rgba(255,255,255,0.07);
}

.ch-icon {
  font-size: 14px;
  line-height: 1;
}

.ch-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0;
  margin-bottom: 8px;
}

/* ── 竖向推子 ── */
.fader-rail {
  position: relative;
  width: 18px;
  height: 130px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: visible;
  cursor: pointer;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);
  flex-shrink: 0;
}

/* 刻度线 */
.fader-tick {
  position: absolute;
  right: -6px;
  width: 4px;
  height: 1px;
  background: rgba(255,255,255,0.15);
}

.t100 { bottom: 100%; }
.t75  { bottom: 75%; }
.t50  { bottom: 50%; }
.t25  { bottom: 25%; }
.t0   { bottom: 0%; }

/* 填充层（从底部向上） */
.fader-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 12px;
  transition: background-color 0.3s;
  min-height: 0;
}

/* 推子手柄 */
.fader-knob {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 20px;
  background: linear-gradient(180deg, #2a2a3a 0%, #1a1a26 100%);
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(255,255,255,0.05) inset;
  z-index: 10;
  /* 移除 bottom 的 transition，实现真正的零延迟“跟手” */
  transition: none;
}

.knob-line {
  width: 14px;
  height: 1px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 1px;
}

/* 音量数字 & 加载状态 */
.ch-status {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  width: 100%;
}

.ch-vol {
  font-size: 13px;
  font-family: monospace;
  color: rgba(255,255,255,0.4);
  line-height: 1;
  transition: color 0.3s;
  z-index: 2;
}

.ch-loading-spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(78, 204, 163, 0.2);
  border-top: 1px solid #4ecca3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.vol-active {
  color: #4ecca3;
}

.ch-vol-unit {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 1px;
}

/* ══════════════════════════════════════
   底部主控区
══════════════════════════════════════ */
.master-bar {
  height: 88px;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  background: #080810;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 0 24px;
}

/* 侧边功能按钮 */
.master-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  transition: all 0.2s;
  min-width: 60px;
}

.master-btn:active {
  background: rgba(255,255,255,0.1);
  transform: scale(0.95);
}

.btn-active {
  background: rgba(78, 204, 163, 0.1) !important;
  border-color: rgba(78, 204, 163, 0.4) !important;
}

.master-btn-icon {
  font-size: 22px;
  margin-bottom: 4px;
}

.master-btn-label {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  font-family: monospace;
  letter-spacing: 1px;
}

/* 中央大播放按钮 */
.play-btn {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a2a3a 0%, #0d1520 100%);
  border: 2px solid rgba(78, 204, 163, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(78, 204, 163, 0.1), inset 0 1px 2px rgba(255,255,255,0.05);
  transition: all 0.3s;
}

.play-btn:active {
  transform: scale(0.93);
}

.play-btn-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px solid rgba(78, 204, 163, 0.15);
  animation: none;
}

.play-btn-active {
  border-color: rgba(78, 204, 163, 0.7);
  box-shadow: 0 0 30px rgba(78, 204, 163, 0.25), 0 0 60px rgba(78, 204, 163, 0.1);
}

.play-btn-active .play-btn-ring {
  border-color: rgba(78, 204, 163, 0.3);
  animation: ripple 2.5s ease-out infinite;
}

@keyframes ripple {
  0%   { transform: scale(1);   opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

.play-btn-icon {
  font-size: 26px;
  color: rgba(255, 255, 255, 0.9);
  margin-left: 3px; /* 视觉对齐 ▶ */
}

.play-btn-active .play-btn-icon {
  color: #4ecca3;
  text-shadow: 0 0 12px rgba(78, 204, 163, 0.6);
}
</style>
