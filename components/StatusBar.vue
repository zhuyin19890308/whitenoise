<template>
  <view class="status-bar">
    <text class="time-text">{{ currentTime }}</text>
    <view class="right-icons">
      <text class="icon">📶</text>
      <text class="icon">🔋</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'StatusBar',
  data() {
    return {
      currentTime: '9:41'
    };
  },
  mounted() {
    this.updateTime();
    setInterval(this.updateTime, 60000);
  },
  methods: {
    updateTime() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      this.currentTime = `${hours}:${minutes}`;
    }
  }
};
</script>

<style scoped>
.status-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 62px;
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 20px;
  padding-right: 20px;
  z-index: 100;
}
.time-text {
  font-size: 15px;
  font-weight: 600;
  color: #FAFAF9;
}
.right-icons {
  display: flex;
  gap: 8px;
}
.icon {
  font-size: 16px;
}
</style>
