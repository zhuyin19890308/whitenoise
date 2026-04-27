<template>
  <view class="page-container">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 页面内容 -->
    <view class="page-content">
      <!-- 用户信息 -->
      <view class="user-section">
        <view class="avatar-wrap">
          <view class="avatar">
            <text class="avatar-text">眠</text>
          </view>
          <view class="pro-badge">PRO</view>
        </view>
        <text class="username">眠融用户</text>
      </view>

      <!-- 统计信息 -->
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-value">{{ stats.favorites }}</text>
          <text class="stat-label">收藏</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ stats.days }}</text>
          <text class="stat-label">使用天数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ stats.scenes }}</text>
          <text class="stat-label">创建混音</text>
        </view>
      </view>

      <!-- 菜单列表 -->
      <view class="menu-section">
        <MenuItem
          v-for="item in menuItems"
          :key="item.label"
          :icon="item.icon"
          :label="item.label"
          :value="item.value"
          @tap="onMenuTap"
        />
      </view>

      <!-- 底部链接 -->
      <view class="bottom-links">
        <text class="link-item" @tap="onLogout">退出登录</text>
        <text class="link-divider">|</text>
        <text class="link-item" @tap="onSwitchAccount">切换账户</text>
      </view>

      <!-- 版本信息 -->
      <text class="version">版本 2.0.0</text>
    </view>

    <!-- 底部TabBar -->
    <TabBar current="/pages/profile/index" />
  </view>
</template>

<script>
import StatusBar from '@/components/StatusBar.vue';
import TabBar from '@/components/TabBar.vue';
import MenuItem from '@/components/MenuItem.vue';

const FAVORITES_KEY = 'WN_FAVORITES';
const FIRST_USE_KEY = 'WN_FIRST_USE';
const SCENES_KEY = 'WN_SCENES';

export default {
  components: {
    StatusBar,
    TabBar,
    MenuItem
  },
  data() {
    return {
      menuItems: [
        { icon: '👤', label: '我的账户', value: 'account' },
        { icon: '📊', label: '睡眠报告', value: 'report' },
        { icon: '⚙️', label: '设置', value: 'settings' },
        { icon: 'ℹ️', label: '关于', value: 'about' }
      ]
    };
  },
  computed: {
    stats() {
      return {
        favorites: this.getFavoritesCount(),
        days: this.getDaysUsed(),
        scenes: this.getScenesCount()
      };
    }
  },
  onLoad() {
    this.checkFirstUse();
  },
  methods: {
    getFavoritesCount() {
      try {
        const data = uni.getStorageSync(FAVORITES_KEY);
        if (data) {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          const mixes = parsed.mixes || [];
          const sounds = parsed.sounds || [];
          return mixes.length + sounds.length;
        }
      } catch (e) {}
      return 0;
    },
    checkFirstUse() {
      try {
        const firstUse = uni.getStorageSync(FIRST_USE_KEY);
        if (!firstUse) {
          uni.setStorageSync(FIRST_USE_KEY, Date.now());
        }
      } catch (e) {}
    },
    getDaysUsed() {
      try {
        const firstUse = uni.getStorageSync(FIRST_USE_KEY);
        if (firstUse) {
          const days = Math.floor((Date.now() - firstUse) / (1000 * 60 * 60 * 24));
          return Math.max(1, days);
        }
      } catch (e) {}
      return 1;
    },
    getScenesCount() {
      try {
        const scenes = uni.getStorageSync(SCENES_KEY);
        if (scenes) {
          const parsed = typeof scenes === 'string' ? JSON.parse(scenes) : scenes;
          return Array.isArray(parsed) ? parsed.length : 0;
        }
      } catch (e) {}
      return 0;
    },
    onMenuTap(item) {
      switch (item.value) {
        case 'account':
          uni.showToast({ title: '我的账户', icon: 'none' });
          break;
        case 'report':
          uni.showToast({ title: '睡眠报告', icon: 'none' });
          break;
        case 'settings':
          uni.showToast({ title: '设置', icon: 'none' });
          break;
        case 'about':
          uni.showToast({ title: '关于', icon: 'none' });
          break;
      }
    },
    onLogout() {
      uni.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            // 清除登录状态
            uni.clearStorageSync();
            uni.showToast({ title: '已退出', icon: 'none' });
          }
        }
      });
    },
    onSwitchAccount() {
      uni.showToast({ title: '切换账户', icon: 'none' });
    }
  },
  onShareAppMessage() {
    return {
      title: '眠融 - 个人中心',
      desc: '来我的眠融主页看看~',
      path: '/pages/profile/index'
    };
  },
  onShareTimeline() {
    return {
      title: '眠融 - 个人中心',
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
  align-items: center;
}

/* 用户信息 */
.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.avatar-wrap {
  position: relative;
  margin-bottom: 12px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 32px;
  color: #FFFFFF;
}

.pro-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  padding: 2px 6px;
  border-radius: 8px;
  background: #FFD700;
  font-size: 10px;
  font-weight: 600;
  color: #0A0E1A;
}

.username {
  font-size: 20px;
  font-weight: 600;
  color: #FAFAF9;
}

/* 统计信息 */
.stats-row {
  display: flex;
  align-items: center;
  background: #121829;
  border-radius: 16px;
  padding: 16px 24px;
  margin-bottom: 24px;
  width: 100%;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #FAFAF9;
}

.stat-label {
  font-size: 12px;
  color: #8E8E93;
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: #2A2A35;
}

/* 菜单列表 */
.menu-section {
  width: 100%;
}

/* 底部链接 */
.bottom-links {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 32px;
  gap: 16px;
}

.link-item {
  font-size: 14px;
  color: #6B6B70;
}

.link-divider {
  font-size: 14px;
  color: #6B6B70;
}

/* 版本信息 */
.version {
  font-size: 12px;
  color: #6B6B70;
  margin-top: 16px;
}
</style>
