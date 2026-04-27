<template>
  <view class="page-container">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 页面内容 -->
    <view class="page-content">
      <!-- Header -->
      <view class="page-header">
        <text class="page-title">声音库</text>
        <text class="page-subtitle">SOUND LIBRARY</text>
      </view>

      <!-- 分类标签 -->
      <CategoryTabs
        :tabs="categories"
        :activeId="activeCategory"
        @change="onCategoryChange"
      />

      <!-- 声音网格 -->
      <scroll-view scroll-y class="sound-grid-container">
        <view class="sound-grid">
          <SoundCard
            v-for="sound in filteredSounds"
            :key="sound.id"
            :id="sound.id"
            :name="sound.name"
            :icon="sound.icon"
            :volume="sound.volume"
            :isPlaying="isSoundPlaying(sound.id)"
            @tap="onSoundTap"
          />
        </view>
      </scroll-view>
    </view>

    <!-- 底部TabBar -->
    <TabBar current="/pages/sound-library/index" />
  </view>
</template>

<script>
import StatusBar from '@/components/StatusBar.vue';
import TabBar from '@/components/TabBar.vue';
import CategoryTabs from '@/components/CategoryTabs.vue';
import SoundCard from '@/components/SoundCard.vue';
import { AUDIO_TRACKS } from '@/config/index';
import AudioEngine, { AudioEngineState } from '@/utils/AudioEngine';

export default {
  components: {
    StatusBar,
    TabBar,
    CategoryTabs,
    SoundCard
  },
  data() {
    return {
      activeCategory: 'all',
      currentPlayingId: null,
      audioEngineState: AudioEngineState.IDLE
    };
  },
  computed: {
    categories() {
      return [
        { id: 'all', name: '推荐' },
        { id: 'nature', name: '自然' },
        { id: 'urban', name: '城市' },
        { id: 'white', name: '白噪音' },
        { id: 'sleep', name: '助眠' },
        { id: 'relax', name: '放松' }
      ];
    },
    sounds() {
      return AUDIO_TRACKS.map(track => ({
        ...track,
        volume: 0
      }));
    },
    filteredSounds() {
      if (this.activeCategory === 'all') {
        return this.sounds;
      }
      // 根据分类过滤
      const natureSounds = ['wind', 'drizzle', 'thunder', 'wave', 'bonfire', 'bird', 'insect'];
      if (this.activeCategory === 'nature') {
        return this.sounds.filter(s => natureSounds.includes(s.id));
      }
      // 其他分类暂时返回全部
      return this.sounds;
    }
  },
  onLoad() {
    // 监听音频状态变化
    this.updateAudioState();
  },
  onShow() {
    this.updateAudioState();
  },
  methods: {
    onCategoryChange(categoryId) {
      this.activeCategory = categoryId;
    },
    onSoundTap(sound) {
      // 切换该声音的播放状态
      const newVolume = sound.volume > 0 ? 0 : (sound.defaultVolume || 0.5);
      this.setSoundVolume(sound.id, newVolume);
    },
    setSoundVolume(soundId, volume) {
      // 找到声音并更新
      const sound = this.sounds.find(s => s.id === soundId);
      if (sound) {
        sound.volume = volume;
      }
      // 调用音频引擎
      AudioEngine.setTrackVolume(soundId, volume);
    },
    isSoundPlaying(soundId) {
      return this.currentPlayingId === soundId && this.audioEngineState === AudioEngineState.READY;
    },
    updateAudioState() {
      this.audioEngineState = AudioEngine.getState();
      // 检查是否有活跃轨道
      const volumes = AudioEngine.getTrackVolumes();
      const activeSounds = volumes.filter(v => v.vol > 0);
      if (activeSounds.length === 1) {
        this.currentPlayingId = activeSounds[0].id;
      } else {
        this.currentPlayingId = null;
      }
    }
  },
  onShareAppMessage() {
    return {
      title: '眠融 - 精选声音',
      desc: '这个声音真的很助眠，推荐给你~',
      path: '/pages/sound-library/index'
    };
  },
  onShareTimeline() {
    return {
      title: '眠融 - 精选声音',
      query: 'from=timeline'
    };
  }
};
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #151B30 0%, #0A0E1A 50%, #050810 100%);
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  padding: 120px 20px 100px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  margin-bottom: 8px;
}

.page-title {
  display: block;
  font-size: 28px;
  font-weight: 600;
  color: #FAFAF9;
}

.page-subtitle {
  display: block;
  font-size: 12px;
  color: #8E8E93;
  letter-spacing: 2px;
  margin-top: 4px;
}

.sound-grid-container {
  flex: 1;
  margin-top: 8px;
}

.sound-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-bottom: 20px;
}
</style>
