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

      <view class="visual-overlay">
        <view class="brand-wrap">
          <text class="brand-main">M I A N R O N G</text>
          <view class="brand-sub">
            <text class="brand-zh">眠 融</text>
            <text class="brand-tag">PRO</text>
          </view>
        </view>
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
      <!-- 状态提示容器：非侵入式，位于滑块下方 -->
      <view class="engine-status" v-if="audioStatusText">
        <text class="status-text" :class="audioStatusClass">{{ audioStatusText }}</text>
      </view>

      <view class="panel-header">
        <view class="panel-info">
          <view class="lcd-display">
            <text class="lcd-label">SCENE:</text>
            <text class="lcd-value">{{ scenes.find((s: Scene) => s.id === currentSceneId)?.name || 'MANUAL' }}</text>
            <view class="lcd-divider"></view>
            <text class="lcd-label">CH:</text>
            <text class="lcd-value">{{ tracks.filter((t: Track) => t.volume > 0).length }}/8</text>
          </view>
        </view>
        <view class="panel-led-group">
          <view class="panel-led" :class="{ 'led-on': isGlobalPlaying && hasActiveTracks }"></view>
          <text class="panel-label">PRO MIXER</text>
        </view>
      </view>
      
      <!-- 场景管理：水平滚动选择器 -->
      <view class="scene-manager">
        <scroll-view scroll-x class="scene-scroll">
          <view class="scene-list">
            <view 
              class="scene-item" 
              v-for="scene in scenes" 
              :key="scene.id"
              :class="{ 'scene-active': currentSceneId === scene.id }"
              @click="applyScene(scene)"
              @longpress="deleteScene(scene.id)"
            >
              <text class="scene-name">{{ scene.name }}</text>
            </view>
            <!-- 新增场景按钮 -->
            <view class="scene-item add-scene" @click="showSaveModal = true">
              <text class="scene-name">+ 保存当前</text>
            </view>
          </view>
        </scroll-view>
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

            <!-- 自定义竖向触摸推子 + VU 表容器 -->
            <view class="fader-container">
              <!-- 左侧 VU 表 (装饰性) -->
              <view class="vu-meter">
                <view class="vu-led" v-for="i in 12" :key="i" :class="{ 'vu-led-on': track.volume > (12-i)/12 }"></view>
              </view>

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
  
                <!-- 移除了物理推子手柄，仅保留电平填充 -->
              </view>

              <!-- 右侧 VU 表 (装饰性) -->
              <view class="vu-meter">
                <view class="vu-led" v-for="i in 12" :key="i" :class="{ 'vu-led-on': track.volume > (12-i)/12 }"></view>
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
      <view class="master-btn timer-btn" @click="toggleTimer" :class="{ 'btn-active': currentTimerIndex > 0 }">
        <view class="master-btn-content">
          <view class="icon-clock-wrap">
            <view class="icon-clock-circle" />
            <view class="icon-clock-hand h-long" />
            <view class="icon-clock-hand h-short" />
          </view>
          <text v-if="currentTimerIndex > 0" class="timer-countdown">{{ timerText }}</text>
        </view>
      </view>

      <!-- 中央大播放按钮 -->
      <view
        class="play-btn"
        :class="{ 'play-btn-active': isGlobalPlaying }"
        @click="toggleGlobalPlay"
      >
        <view class="play-btn-ring" />
        <view class="play-btn-content">
          <view v-if="!isGlobalPlaying" class="shape-play" />
          <view v-else class="shape-pause">
            <view class="pause-bar" />
            <view class="pause-bar" />
          </view>
        </view>
      </view>

      <!-- 重置所有通道按钮 -->
      <view class="master-btn" @click="resetAll">
        <view class="master-btn-content">
          <text class="master-btn-icon">↺</text>
        </view>
      </view>
    </view>

    <!-- ═══════════════════════════════════════
         新增场景命名弹窗
    ════════════════════════════════════════ -->
    <view class="modal-overlay" v-if="showSaveModal" @click="showSaveModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">保存为新场景</text>
        </view>
        <view class="modal-body">
          <input 
            class="modal-input" 
            v-model="newSceneName" 
            placeholder="例如：孩子助眠 / 我的工作" 
            placeholder-style="color:rgba(255,255,255,0.2)"
            confirm-type="done"
            @confirm="saveCurrentAsScene"
          />
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel" @click="showSaveModal = false">取消</view>
          <view class="modal-btn confirm" @click="saveCurrentAsScene">保存</view>
        </view>
      </view>
    </view>

    <!-- ═══════════════════════════════════════
         删除确认弹窗
    ════════════════════════════════════════ -->
    <view class="modal-overlay" v-if="showDeleteModal" @click="showDeleteModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">确认删除</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">确定要永久删除这个自定义场景吗？</text>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel" @click="showDeleteModal = false">取消</view>
          <view class="modal-btn confirm delete-btn" @click="confirmDelete">删除</view>
        </view>
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

interface Scene {
  id: string;
  name: string;
  volumes: Record<string, number>;
}
import { AudioCacheManager } from '../../utils/audioCacheManager';
import { AUDIO_TRACKS, DEFAULT_MIX_DURATION, type TrackConfig } from '../../config/index';
import AudioEngine, { AudioEngineState } from '../../utils/AudioEngine';

/* ─── 音频引擎状态 ─── */
const audioEngineState = ref<string>(AudioEngineState.IDLE);
const audioStatusText = computed(() => {
  switch (audioEngineState.value) {
    case AudioEngineState.IDLE:
    case AudioEngineState.LOCAL_MIX:
      return ''; // 不显示
    case AudioEngineState.CLOUD_MIXING:
      return '☁️ 混合合成中...';
    case AudioEngineState.CLOUD_LOADING:
      return '☁️ 云加载中...';
    case AudioEngineState.READY:
      return '✓ 已就绪';
    case AudioEngineState.ERROR:
      return '⚠️ 云端失败，使用本地模式';
    default:
      return '';
  }
});
const audioStatusClass = computed(() => {
  switch (audioEngineState.value) {
    case AudioEngineState.CLOUD_LOADING:
      return 'status-loading';
    case AudioEngineState.READY:
      return 'status-ready';
    case AudioEngineState.ERROR:
      return 'status-error';
    default:
      return '';
  }
});

/* ─── 8 轨道初始数据 ─── */
/* ─── 场景管理数据 (Persistence) ─── */
const SAVED_SCENES_KEY = 'WHITE_NOISE_SAVED_SCENES';
const LAST_SCENE_ID_KEY = 'WHITE_NOISE_LAST_SCENE_ID';

const defaultScenes: Scene[] = [
  { id: 'focus', name: '深度专注', volumes: { 'wind': 0.3, 'fire': 0.1, 'rain': 0.05 } },
  { id: 'child', name: '宝宝助眠', volumes: { 'rain': 0.4, 'summer': 0.2 } },
  { id: 'meditation', name: '冥想时刻', volumes: { 'bowl': 0.6, 'wind': 0.2 } }
];

const scenes = ref<Scene[]>([]);
const currentSceneId = ref<string>('');
const showSaveModal = ref(false);
const showDeleteModal = ref(false);
const sceneToDeleteId = ref<string | null>(null);
const newSceneName = ref('');

const loadSavedData = () => {
  const storedScenes = uni.getStorageSync(SAVED_SCENES_KEY);
  scenes.value = storedScenes && storedScenes.length ? storedScenes : [...defaultScenes];
  
  const lastId = uni.getStorageSync(LAST_SCENE_ID_KEY);
  if (lastId && scenes.value.some((s: Scene) => s.id === lastId)) {
    currentSceneId.value = lastId;
  }
};

const persistScenes = () => {
  uni.setStorageSync(SAVED_SCENES_KEY, scenes.value);
};

const persistLastSceneId = () => {
  uni.setStorageSync(LAST_SCENE_ID_KEY, currentSceneId.value);
};

/* ─── 8 轨道初始化 ─── */
const tracks = ref<Track[]>(AUDIO_TRACKS.map((tc: TrackConfig) => ({
  ...tc,
  volume: tc.defaultVolume,
  url: tc.fileName,
  context: null,
  isLoading: false
})));

/**
 * 核心：应用一个场景的音量配置
 */
const applyScene = (scene: Scene) => {
  currentSceneId.value = scene.id;
  persistLastSceneId();
  
  tracks.value.forEach((t: Track) => {
    const vol = scene.volumes[t.id] !== undefined ? scene.volumes[t.id] : 0;
    t.volume = vol;
    if (t.context) {
      t.context.volume = vol;
      // 如果音量大于 0 且全局在播放，确保播放
      if (vol > 0 && isGlobalPlaying.value) {
        ensureTrackSource(t).then(res => {
          if (res && isGlobalPlaying.value && t.volume > 0) t.context.play();
        });
      } else if (vol === 0) {
        if (t.context.src) t.context.pause();
      }
    }
  });
};

const saveCurrentAsScene = () => {
  if (!newSceneName.value.trim()) {
    uni.showToast({ title: '请输入场景名称', icon: 'none' });
    return;
  }
  
  const volumes: Record<string, number> = {};
  tracks.value.forEach((t: Track) => {
    if (t.volume > 0) volumes[t.id] = t.volume;
  });
  
  const newScene: Scene = {
    id: Date.now().toString(),
    name: newSceneName.value.trim(),
    volumes
  };
  
  scenes.value.push(newScene);
  currentSceneId.value = newScene.id;
  persistScenes();
  persistLastSceneId();
  
  showSaveModal.value = false;
  newSceneName.value = '';
  uni.showToast({ title: '场景已保存', icon: 'success' });
};

const deleteScene = (id: string) => {
  if (defaultScenes.some((s: Scene) => s.id === id)) {
    uni.showToast({ title: '内置场景无法删除', icon: 'none' });
    return;
  }
  sceneToDeleteId.value = id;
  showDeleteModal.value = true;
};

const confirmDelete = () => {
  if (sceneToDeleteId.value) {
    const id = sceneToDeleteId.value;
    scenes.value = scenes.value.filter((s: Scene) => s.id !== id);
    persistScenes();
    if (currentSceneId.value === id) currentSceneId.value = '';
    uni.showToast({ title: '已删除', icon: 'none' });
  }
  showDeleteModal.value = false;
  sceneToDeleteId.value = null;
};

/**
 * 原有的 saveAudioConfig 升级为自动保存当前活跃场景或临时状态
 */
const saveAudioConfig = () => {
  // 如果当前在某个场景下，实时更新该场景的音量
  const activeScene = scenes.value.find((s: Scene) => s.id === currentSceneId.value);
  if (activeScene) {
    const volumes: Record<string, number> = {};
    tracks.value.forEach((t: Track) => { if (t.volume > 0) volumes[t.id] = t.volume; });
    activeScene.volumes = volumes;
    persistScenes();
  }
};

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
      if (track.context.src) track.context.pause();
    }
  }
};

const onFaderTouchEnd = (_trackId: string) => {
  activeFaderState.value = null;
  saveAudioConfig(); // 拖动结束保存配置
  
  // 触发云混音（自动请求后端合成）
  const activeVolumes = tracks.value
    .filter((t: Track) => t.volume > 0)
    .map((t: Track) => ({ id: t.id, vol: t.volume }));
  
  if (activeVolumes.length > 0 && isGlobalPlaying.value) {
    AudioEngine.switchToCloudMix(activeVolumes, DEFAULT_MIX_DURATION);
  }
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
        // 如果该轨道尚未设置 src（未真正加载过），直接 pause 会触发
        // operateAudio:fail audioInstance is not set
        if (t.context.src) t.context.pause();
      }
    }
  });

  const selectedTrack = tracks.value.find((t: Track) => t.id === trackId);
  if (selectedTrack) {
    uni.showToast({ title: `已独奏: ${selectedTrack.name}`, icon: 'none' });
  }

  // 独奏后重新触发云混音，确保后台播放的是独奏音轨
  if (isGlobalPlaying.value) {
    const activeVolumes = tracks.value
      .filter((t: Track) => t.volume > 0)
      .map((t: Track) => ({ id: t.id, vol: t.volume }));
    if (activeVolumes.length > 0) {
      AudioEngine.switchToCloudMix(activeVolumes, DEFAULT_MIX_DURATION);
    }
  }

  saveAudioConfig(); // 独奏状态变更保存
};

/* ─── 音频引擎初始化 ─── */
const initAudioEngine = () => {
  // 设置状态变化回调
  AudioEngine.setCallbacks({
    onStateChange: (state: string, prevState: string) => {
      console.log(`[Page] 音频引擎状态变化: ${prevState} -> ${state}`);
      audioEngineState.value = state;
    },
    onProgress: (progress: number) => {
      console.log(`[Page] 下载进度: ${progress}%`);
    },
    onError: (error: any) => {
      console.error('[Page] 音频引擎错误:', error);
      uni.showToast({
        title: '云端合成失败，已切换到本地模式',
        icon: 'none',
        duration: 3000
      });
    }
  });

  // 初始化轨道播放器
  AudioEngine.initTrackPlayers(AUDIO_TRACKS);
  
  console.log('[Page] 音频引擎已初始化');
};

/* ─── 全局控制 ─── */
const toggleGlobalPlay = () => {
  isGlobalPlaying.value = !isGlobalPlaying.value;
  syncAllTracks();
  // 同步到音频引擎
  AudioEngine.togglePlay(isGlobalPlaying.value);
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
      if (t.context.src) t.context.pause();
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
        if (t.context.src) t.context.pause();
      }
    }
  });
  uni.showToast({ title: '已恢复默认配置', icon: 'none' });
  saveAudioConfig(); // 重置后保存
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

  // 1. 加载数据
  loadSavedData();
  
  // 2. 初始化 Context
  tracks.value.forEach((t: Track) => initTrackContext(t));
  
  // 3. 初始化音频引擎并订阅状态变化
  initAudioEngine();
  
  // 4. 应用上次场景
  if (currentSceneId.value) {
    const scene = scenes.value.find((s: Scene) => s.id === currentSceneId.value);
    if (scene) applyScene(scene);
  } else {
    syncAllTracks();
  }

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
  flex: 1; /* 让视觉区撑满剩余空间，填补间距 */
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

.brand-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.brand-main {
  font-size: 16px;
  font-weight: 200;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 12px;
  text-indent: 12px;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

.brand-sub {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.brand-zh {
  font-size: 11px;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 12px; /* 增加间距，与英文对齐 */
  text-indent: 12px; /* 补偿右侧多出的间距，保持居中 */
}

.brand-tag {
  font-size: 8px;
  color: #0a0a0f;
  background: #4ecca3;
  padding: 0 4px;
  border-radius: 2px;
  font-weight: bold;
  letter-spacing: 1px;
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
  flex-shrink: 0; /* 调音台不再撑开，紧贴底部 */
  display: flex;
  flex-direction: column;
  background: transparent;
  border-top: none;
  overflow: hidden;
  min-height: 0;
  padding-bottom: 0px;
}

.panel-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: transparent; /* 页眉也设为透明 */
}

.panel-info {
  display: flex;
  align-items: center;
}

.lcd-display {
  display: flex;
  align-items: center;
  background: #1a2a1a;
  border: 1px solid #2d4d2d;
  padding: 4px 10px;
  border-radius: 4px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
}

.lcd-label {
  font-size: 9px;
  color: #4ecca3;
  opacity: 0.5;
  margin-right: 4px;
}

.lcd-value {
  font-size: 11px;
  color: #4ecca3;
  font-family: monospace;
  text-shadow: 0 0 5px rgba(78,204,163,0.5);
}

.lcd-divider {
  width: 1px;
  height: 10px;
  background: rgba(78,204,163,0.2);
  margin: 0 8px;
}

.panel-led-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-label {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 3px;
  font-family: monospace;
}

/* ══════════════════════════════════════
   场景选择器样式
   ══════════════════════════════════════ */
.scene-manager {
  padding: 0 16px 12px;
  background: transparent;
}

.scene-scroll {
  width: 100%;
  white-space: nowrap;
}

.scene-list {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.scene-item {
  padding: 6px 16px;
  background: rgba(255,255,255,0.05);
  border-radius: 100px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.scene-item:active {
  transform: scale(0.95);
  background: rgba(255,255,255,0.1);
}

.scene-active {
  background: #4ecca3;
  border-color: #4ecca3;
  box-shadow: 0 4px 12px rgba(78, 204, 163, 0.3);
}

.scene-active .scene-name {
  color: #0a0a0f;
  font-weight: 500;
}

.scene-name {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
}

.add-scene {
  background: transparent;
  border: 1px dashed rgba(255,255,255,0.2);
}

.add-scene .scene-name {
  color: rgba(255,255,255,0.4);
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
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* 底部对齐 */
  overflow: hidden; /* 彻底禁止滚动冲突 */
}

.channels-row {
  display: flex;
  flex-direction: row;
  padding: 0 8px 10px; /* 恢复正常间距，因为不再需要滚动到底部 */
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
  background: transparent; /* 去除背景方块 */
  border: none; /* 去除边框 */
  transition: all 0.3s;
}

.channel-active {
  background: transparent;
  border: none;
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

/* ── 竖向推子容器 ── */
.fader-container {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 4px;
  margin-bottom: 12px;
}

/* VU 米样式 */
.vu-meter {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4px 0;
  width: 4px;
}

.vu-led {
  width: 4px;
  height: 3px;
  background: #222;
  border-radius: 1px;
}

/* 顶部 LED 为红色，中间黄色，底部绿色 */
.vu-led:nth-child(-n+2).vu-led-on { background: #ff4d4d; box-shadow: 0 0 4px #ff4d4d; }
.vu-led:nth-child(n+3):nth-child(-n+5).vu-led-on { background: #ffd700; box-shadow: 0 0 4px #ffd700; }
.vu-led:nth-child(n+6).vu-led-on { background: #4ecca3; box-shadow: 0 0 4px #4ecca3; }

.fader-rail {
  position: relative;
  width: 14px;
  height: 180px; /* 进一步减小高度，确保在所有小屏设备上都不发生滚动冲突 */
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: visible;
  cursor: pointer;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.9);
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
  width: 26px; /* 随轨道减窄 */
  height: 18px; /* 随轨道减窄 */
  background: linear-gradient(180deg, #2a2a3a 0%, #1a1a26 100%);
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(255,255,255,0.05) inset;
  z-index: 10;
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
  height: auto;
  min-height: 88px;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  background: transparent; /* 移除底部背景 */
  border-top: none; /* 移除分割线 */
  padding: 10px 24px calc(14px + env(safe-area-inset-bottom)); /* 增加底部间距支撑 & 适配安全区 */
}

/* 侧边功能按钮 */
.master-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: transparent;
  border: none;
  transition: all 0.2s;
  min-width: 80px; /* 增加点击区域宽度 */
}

.master-btn-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.master-btn:active {
  transform: scale(0.9);
  opacity: 0.6;
}

.btn-active {
  color: #4ecca3 !important;
  text-shadow: 0 0 10px rgba(78, 204, 163, 0.5);
}

.master-btn-icon {
  font-size: 32px; /* 进一步增大图标 */
  color: rgba(255,255,255,0.4);
}

.icon-clock-wrap {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-clock-circle {
  position: absolute;
  inset: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
}

.icon-clock-hand {
  position: absolute;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 1px;
  bottom: 50%;
  left: 50%;
  transform-origin: bottom center;
}

.h-long {
  width: 1.5px;
  height: 8px;
  transform: translateX(-50%) rotate(0deg);
}

.h-short {
  width: 1.5px;
  height: 6px;
  transform: translateX(-50%) rotate(90deg);
}

.btn-active .icon-clock-circle,
.btn-active .icon-clock-hand {
  border-color: #4ecca3;
  background-color: #4ecca3;
  box-shadow: 0 0 8px rgba(78, 204, 163, 0.5);
}

.timer-countdown {
  font-size: 10px;
  color: #4ecca3;
  font-family: monospace;
  font-weight: bold;
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

.play-btn-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.shape-play {
  width: 0;
  height: 0;
  border-left: 20px solid rgba(255, 255, 255, 0.9);
  border-top: 12px solid transparent;
  border-bottom: 12px solid transparent;
  margin-left: 6px; /* 视觉中心校准 */
  transition: all 0.3s;
}

.shape-pause {
  display: flex;
  gap: 6px;
  transition: all 0.3s;
}

.pause-bar {
  width: 5px;
  height: 20px;
  background: #4ecca3;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(78, 204, 163, 0.5);
}

.play-btn-active .shape-play {
  border-left-color: #4ecca3;
}
/* ══════════════════════════════════════
   弹窗样式 (Modal)
   ══════════════════════════════════════ */
.modal-overlay,
.modal-content,
.modal-header,
.modal-title,
.modal-body,
.modal-input,
.modal-footer,
.modal-btn {
  box-sizing: border-box;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(5px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40px;
}

.modal-content {
  width: 100%;
  max-width: 320px; /* 增加最大宽度限制，视觉更紧致 */
  background: #1a1a26;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.modal-header {
  margin-bottom: 20px;
}

.modal-title {
  font-size: 18px;
  color: #fff;
  font-weight: 300;
  letter-spacing: 2px;
}

.modal-body {
  margin-bottom: 24px;
}

.modal-input {
  width: 100%;
  height: 48px;
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  padding: 0 16px;
  color: #fff;
  font-size: 16px;
  border: 1px solid rgba(255,255,255,0.08);
}

.modal-footer {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 15px;
  transition: opacity 0.2s;
}

.modal-btn:active {
  opacity: 0.7;
}

.cancel {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
}

.confirm {
  background: #4ecca3;
  color: #0a0a0f;
  font-weight: 500;
}

.delete-btn {
  background: #ff4d4d !important;
  color: #fff !important;
}

.modal-text {
  font-size: 15px;
  color: rgba(255,255,255,0.7);
  line-height: 1.6;
}

/* ══════════════════════════════════════
   音频引擎状态提示（非侵入式）
══════════════════════════════════════ */
.engine-status {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 0 8px;
  min-height: 20px;
}

.status-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

/* 加载中状态：带呼吸动画 */
.status-loading {
  color: #4ecca3;
  animation: status-pulse 1.5s ease-in-out infinite;
}

.status-loading::after {
  content: '';
  animation: ellipsis 1.5s steps(4, end) infinite;
}

/* 就绪状态 */
.status-ready {
  color: #4ecca3;
  opacity: 0.8;
}

/* 错误状态 */
.status-error {
  color: #ff6b6b;
  animation: status-fade 3s ease-in-out forwards;
}

@keyframes status-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes ellipsis {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
  100% { content: ''; }
}

@keyframes status-fade {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
