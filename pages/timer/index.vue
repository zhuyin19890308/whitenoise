<template>
  <view class="page-container">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 页面内容 -->
    <view class="page-content">
      <text class="page-title">睡眠计时器</text>
      <text class="page-desc">设置定时关闭，安心入睡</text>

      <!-- 计时器显示 -->
      <view class="timer-display">
        <text class="timer-text">{{ displayTime }}</text>
      </view>

      <!-- 预设按钮 -->
      <view class="preset-row">
        <view
          v-for="preset in presets"
          :key="preset.value"
          class="preset-btn"
          :class="{ active: selectedPreset === preset.value }"
          @tap="selectPreset(preset.value)"
        >
          <text>{{ preset.label }}</text>
        </view>
      </view>

      <!-- 开始按钮 -->
      <view class="start-btn" @tap="toggleTimer">
        <text>{{ isRunning ? '停止' : '开始计时' }}</text>
      </view>

      <!-- 说明 -->
      <text class="tip-text">音频将会在计时结束后渐出</text>
    </view>

    <!-- 底部TabBar -->
    <TabBar current="/pages/timer/index" />
  </view>
</template>

<script>
import StatusBar from '@/components/StatusBar.vue';
import TabBar from '@/components/TabBar.vue';

export default {
  components: {
    StatusBar,
    TabBar
  },
  data() {
    return {
      selectedPreset: 30,
      remainingSeconds: 30 * 60,
      isRunning: false,
      timerInterval: null,
      presets: [
        { label: '15分钟', value: 15 },
        { label: '30分钟', value: 30 },
        { label: '45分钟', value: 45 },
        { label: '60分钟', value: 60 },
        { label: '整晚', value: 0 }
      ]
    };
  },
  computed: {
    displayTime() {
      if (this.selectedPreset === 0) {
        return '∞';
      }
      const hours = Math.floor(this.remainingSeconds / 3600);
      const minutes = Math.floor((this.remainingSeconds % 3600) / 60);
      const seconds = this.remainingSeconds % 60;
      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
  },
  onUnload() {
    this.clearTimer();
  },
  methods: {
    selectPreset(minutes) {
      if (this.isRunning) return;
      this.selectedPreset = minutes;
      this.remainingSeconds = minutes * 60;
    },
    toggleTimer() {
      if (this.isRunning) {
        this.stopTimer();
      } else {
        this.startTimer();
      }
    },
    startTimer() {
      if (this.selectedPreset === 0) {
        // 整晚模式
        this.isRunning = true;
        return;
      }
      this.isRunning = true;
      this.timerInterval = setInterval(() => {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds--;
        } else {
          this.onTimerEnd();
        }
      }, 1000);
    },
    stopTimer() {
      this.clearTimer();
      this.remainingSeconds = this.selectedPreset * 60;
    },
    clearTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.isRunning = false;
    },
    onTimerEnd() {
      this.clearTimer();
      // 触发音频渐出
      uni.$emit('timerEnd');
      uni.showToast({
        title: '晚安~',
        icon: 'none'
      });
    }
  },
  onShareAppMessage() {
    return {
      title: '眠融 - 睡眠计时器',
      desc: '设置睡眠计时器，安心入睡~',
      path: '/pages/timer/index'
    };
  },
  onShareTimeline() {
    return {
      title: '眠融 - 睡眠计时器',
      query: 'from=timeline'
    };
  }
};
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #151B30 0%, #0A0E1A 50%, #050810 100%);
}
.page-content {
  padding: 120px 20px 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.page-title {
  display: block;
  font-size: 28px;
  font-weight: 600;
  color: #FAFAF9;
  margin-bottom: 8px;
  align-self: flex-start;
}
.page-desc {
  display: block;
  font-size: 14px;
  color: #8E8E93;
  margin-bottom: 60px;
  align-self: flex-start;
}
.timer-display {
  width: 220px;
  height: 220px;
  border-radius: 110px;
  background: #1A2035;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}
.timer-text {
  font-size: 48px;
  font-weight: 600;
  color: #FAFAF9;
}
.preset-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 40px;
}
.preset-btn {
  padding: 10px 16px;
  border-radius: 20px;
  background: #1A2035;
  min-width: 60px;
  text-align: center;
}
.preset-btn.active {
  background: #6366F1;
}
.preset-btn text {
  font-size: 14px;
  color: #8E8E93;
}
.preset-btn.active text {
  color: #FFFFFF;
}
.start-btn {
  width: 200px;
  height: 56px;
  border-radius: 28px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.start-btn text {
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
}
.tip-text {
  font-size: 14px;
  color: #8E8E93;
}
</style>
