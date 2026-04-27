<template>
  <view class="page-container">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 页面内容 -->
    <view class="page-content">
      <!-- Header -->
      <view class="page-header">
        <text class="page-title">收藏</text>
        <text class="page-subtitle">{{ totalCount }}个收藏</text>
      </view>

      <!-- 收藏的混音 -->
      <view class="section" v-if="favoriteMixes.length > 0">
        <text class="section-title">收藏的混音</text>
        <MixCard
          v-for="mix in favoriteMixes"
          :key="mix.id"
          :id="mix.id"
          :name="mix.name"
          :icons="getMixIcons(mix)"
          :count="getMixCount(mix)"
          :volumes="mix.volumes"
          :isPlaying="currentMixId === mix.id"
          @tap="onMixTap"
          @play="onMixPlay"
        />
      </view>

      <!-- 收藏的声音 -->
      <view class="section" v-if="favoriteSounds.length > 0">
        <text class="section-title">收藏的声音</text>
        <view class="sound-list">
          <view
            v-for="soundId in favoriteSounds"
            :key="soundId"
            class="sound-item"
            @tap="onSoundTap(soundId)"
          >
            <text class="sound-icon">{{ getSoundIcon(soundId) }}</text>
            <text class="sound-name">{{ getSoundName(soundId) }}</text>
            <text class="sound-remove" @tap.stop="removeFavoriteSound(soundId)">✕</text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty-state" v-if="totalCount === 0">
        <text class="empty-icon">❤️</text>
        <text class="empty-text">暂无收藏</text>
        <text class="empty-hint">去声音库添加喜欢的混音和声音</text>
      </view>
    </view>

    <!-- 底部TabBar -->
    <TabBar current="/pages/favorites/index" />
  </view>
</template>

<script>
import StatusBar from '@/components/StatusBar.vue';
import TabBar from '@/components/TabBar.vue';
import MixCard from '@/components/MixCard.vue';
import { AUDIO_TRACKS } from '@/config/index';

const FAVORITES_KEY = 'WN_FAVORITES';

export default {
  components: {
    StatusBar,
    TabBar,
    MixCard
  },
  data() {
    return {
      favoriteMixes: [],
      favoriteSounds: [],
      currentMixId: null
    };
  },
  computed: {
    totalCount() {
      return this.favoriteMixes.length + this.favoriteSounds.length;
    }
  },
  onLoad() {
    this.loadFavorites();
  },
  onShow() {
    this.loadFavorites();
  },
  methods: {
    loadFavorites() {
      try {
        const data = uni.getStorageSync(FAVORITES_KEY);
        if (data) {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          this.favoriteMixes = parsed.mixes || [];
          this.favoriteSounds = parsed.sounds || [];
        }
      } catch (e) {
        console.warn('加载收藏失败:', e);
      }
    },
    saveFavorites() {
      try {
        uni.setStorageSync(FAVORITES_KEY, {
          mixes: this.favoriteMixes,
          sounds: this.favoriteSounds
        });
      } catch (e) {
        console.warn('保存收藏失败:', e);
      }
    },
    getMixIcons(mix) {
      if (!mix.volumes) return [];
      return Object.entries(mix.volumes)
        .filter(([id, vol]) => vol > 0)
        .map(([id]) => {
          const track = AUDIO_TRACKS.find(t => t.id === id);
          return track?.icon || '🔊';
        });
    },
    getMixCount(mix) {
      if (!mix.volumes) return 0;
      return Object.values(mix.volumes).filter(v => v > 0).length;
    },
    getSoundIcon(soundId) {
      const track = AUDIO_TRACKS.find(t => t.id === soundId);
      return track?.icon || '🔊';
    },
    getSoundName(soundId) {
      const track = AUDIO_TRACKS.find(t => t.id === soundId);
      return track?.name || soundId;
    },
    onMixTap(mix) {
      // 跳转到首页并应用该混音
      uni.switchTab({
        url: '/pages/index/index',
        success: () => {
          // 通过事件通知首页应用混音
          uni.$emit('applyScene', mix);
        }
      });
    },
    onMixPlay(mix) {
      this.currentMixId = mix.id;
      // 触发播放
      uni.$emit('playMix', mix);
    },
    onSoundTap(soundId) {
      // 跳转到首页并播放该声音
      uni.switchTab({
        url: '/pages/index/index',
        success: () => {
          uni.$emit('playSound', { id: soundId, volume: 0.5 });
        }
      });
    },
    removeFavoriteSound(soundId) {
      this.favoriteSounds = this.favoriteSounds.filter(id => id !== soundId);
      this.saveFavorites();
    }
  },
  onShareAppMessage() {
    return {
      title: '眠融 - 收藏夹',
      desc: '这些是我收藏的好听声音，一起听听吧~',
      path: '/pages/favorites/index'
    };
  },
  onShareTimeline() {
    return {
      title: '眠融 - 收藏夹',
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
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  display: block;
  font-size: 28px;
  font-weight: 600;
  color: #FAFAF9;
}

.page-subtitle {
  display: block;
  font-size: 14px;
  color: #8E8E93;
  margin-top: 4px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #FAFAF9;
  margin-bottom: 12px;
}

.sound-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sound-item {
  display: flex;
  align-items: center;
  background: #121829;
  border-radius: 12px;
  padding: 12px 16px;
}

.sound-icon {
  font-size: 20px;
  margin-right: 12px;
}

.sound-name {
  flex: 1;
  font-size: 14px;
  color: #FAFAF9;
}

.sound-remove {
  font-size: 14px;
  color: #6B6B70;
  padding: 4px 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 80px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  color: #FAFAF9;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #8E8E93;
}
</style>
