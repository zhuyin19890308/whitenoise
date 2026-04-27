<template>
  <view class="mix-card" @tap="onTap">
    <view class="mix-info">
      <text class="mix-name">{{ name }}</text>
      <view class="mix-icons">
        <text v-for="(icon, index) in icons.slice(0, 5)" :key="index" class="mix-icon">{{ icon }}</text>
        <text v-if="icons.length > 5" class="mix-icon-more">+{{ icons.length - 5 }}</text>
      </view>
      <text class="mix-count">{{ count }}种声音</text>
    </view>
    <view class="mix-actions">
      <view class="play-btn" @tap.stop="onPlay">
        <text>{{ isPlaying ? '⏸' : '▶' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MixCard',
  props: {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    icons: {
      type: Array,
      default: () => []
    },
    count: {
      type: Number,
      default: 0
    },
    isPlaying: {
      type: Boolean,
      default: false
    },
    volumes: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['tap', 'play'],
  methods: {
    onTap() {
      this.$emit('tap', {
        id: this.id,
        name: this.name,
        volumes: this.volumes
      });
    },
    onPlay() {
      this.$emit('play', {
        id: this.id,
        name: this.name,
        volumes: this.volumes
      });
    }
  }
};
</script>

<style scoped>
.mix-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #121829;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}

.mix-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mix-name {
  font-size: 16px;
  font-weight: 600;
  color: #FAFAF9;
}

.mix-icons {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.mix-icon {
  font-size: 16px;
}

.mix-icon-more {
  font-size: 12px;
  color: #8E8E93;
  align-self: center;
}

.mix-count {
  font-size: 12px;
  color: #8E8E93;
  margin-top: 4px;
}

.mix-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.play-btn {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background: #6366F1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn text {
  font-size: 16px;
  color: #FFFFFF;
}
</style>
