<template>
  <view class="custom-tabbar" :class="{ 'safe-area': hasSafeArea }">
    <view
      v-for="item in tabs"
      :key="item.pagePath"
      class="tab-item"
      :class="{ active: currentPath === item.pagePath }"
      @tap="switchTab(item)"
    >
      <view class="tab-icon">
        <text class="iconfont">{{ item.icon }}</text>
      </view>
      <text class="tab-text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'TabBar',
  props: {
    current: {
      type: String,
      default: '/pages/index/index'
    }
  },
  data() {
    return {
      hasSafeArea: false,
      tabs: [
        {
          pagePath: '/pages/index/index',
          text: '首页',
          icon: '🏠'
        },
        {
          pagePath: '/pages/sound-library/index',
          text: '声音库',
          icon: '📚'
        },
        {
          pagePath: '/pages/timer/index',
          text: '计时器',
          icon: '⏱️'
        },
        {
          pagePath: '/pages/favorites/index',
          text: '收藏',
          icon: '❤️'
        },
        {
          pagePath: '/pages/profile/index',
          text: '我的',
          icon: '👤'
        }
      ]
    };
  },
  computed: {
    currentPath() {
      return this.current || getCurrentPages()[getCurrentPages().length - 1]?.route || '';
    }
  },
  mounted() {
    // 检测安全区域
    const systemInfo = uni.getSystemInfoSync();
    this.hasSafeArea = systemInfo.safeAreaInsets?.bottom > 0;
  },
  methods: {
    switchTab(item) {
      if (this.currentPath === item.pagePath) return;
      uni.switchTab({
        url: item.pagePath,
        fail: (err) => {
          console.warn('switchTab failed:', err);
          // 如果switchTab失败，尝试navigateTo
          uni.navigateTo({
            url: item.pagePath,
            fail: () => {
              console.warn('navigateTo also failed:', err);
            }
          });
        }
      });
    }
  }
};
</script>

<style scoped>
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 62px;
  background: #1A2035;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 8px;
  box-sizing: border-box;
  z-index: 1000;
}

.custom-tabbar.safe-area {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  height: 100%;
  opacity: 0.6;
  transition: opacity 0.2s, transform 0.2s;
}

.tab-item.active {
  opacity: 1;
  transform: scale(1.05);
}

.tab-icon {
  font-size: 22px;
  line-height: 1;
  margin-bottom: 4px;
}

.tab-text {
  font-size: 11px;
  color: #8E8E93;
  font-weight: 500;
}

.tab-item.active .tab-text {
  color: #6366F1;
}
</style>
