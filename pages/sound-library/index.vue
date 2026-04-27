<template>
  <view class="page-container">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 页面内容 -->
    <view class="page-content">
      <text class="page-title">声音库</text>
      <text class="page-desc">浏览所有助眠声音</text>
    </view>

    <!-- 底部TabBar -->
    <TabBar current="/pages/sound-library/index" />
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
}
.page-content {
  padding: 120px 20px 100px;
}
.page-title {
  display: block;
  font-size: 28px;
  font-weight: 600;
  color: #FAFAF9;
  margin-bottom: 8px;
}
.page-desc {
  display: block;
  font-size: 14px;
  color: #8E8E93;
}
</style>
