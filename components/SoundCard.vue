<template>
  <view class="sound-card" @tap="onTap">
    <view class="sound-icon-wrap">
      <text class="sound-icon">{{ icon }}</text>
      <view class="play-overlay" v-if="isPlaying">
        <text class="play-icon">▶</text>
      </view>
    </view>
    <text class="sound-name">{{ name }}</text>
    <view class="sound-state" v-if="volume > 0">
      <view class="state-dot"></view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'SoundCard',
  props: {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: '🔊'
    },
    volume: {
      type: Number,
      default: 0
    },
    isPlaying: {
      type: Boolean,
      default: false
    }
  },
  emits: ['tap'],
  methods: {
    onTap() {
      this.$emit('tap', {
        id: this.id,
        name: this.name,
        icon: this.icon,
        volume: this.volume
      });
    }
  }
};
</script>

<style scoped>
.sound-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #121829;
  border-radius: 16px;
  padding: 16px 8px;
  min-height: 100px;
  position: relative;
}

.sound-icon-wrap {
  position: relative;
  margin-bottom: 8px;
}

.sound-icon {
  font-size: 32px;
  line-height: 1;
}

.play-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  background: rgba(99, 102, 241, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon {
  color: #FFFFFF;
  font-size: 12px;
  margin-left: 2px;
}

.sound-name {
  font-size: 12px;
  color: #FAFAF9;
  text-align: center;
}

.sound-state {
  position: absolute;
  top: 8px;
  right: 8px;
}

.state-dot {
  width: 8px;
  height: 8px;
  background: #4ecca3;
  border-radius: 50%;
}
</style>
