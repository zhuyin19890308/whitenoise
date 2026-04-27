<template>
  <scroll-view scroll-x class="category-tabs" :show-scrollbar="false">
    <view class="tabs-container">
      <view
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ active: activeId === tab.id }"
        @tap="onTabTap(tab)"
      >
        <text class="tab-text">{{ tab.name }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<script>
export default {
  name: 'CategoryTabs',
  props: {
    tabs: {
      type: Array,
      required: true
      // [{ id: 'all', name: '推荐' }, { id: 'nature', name: '自然' }, ...]
    },
    activeId: {
      type: String,
      default: 'all'
    }
  },
  emits: ['change'],
  methods: {
    onTabTap(tab) {
      if (this.activeId === tab.id) return;
      this.$emit('change', tab.id);
    }
  }
};
</script>

<style scoped>
.category-tabs {
  width: 100%;
  background: transparent;
}

.tabs-container {
  display: flex;
  gap: 12px;
  padding: 0 4px;
}

.tab-item {
  flex-shrink: 0;
  padding: 10px 16px;
  border-radius: 20px;
  background: #1A2035;
  transition: all 0.2s ease;
}

.tab-item.active {
  background: #6366F1;
}

.tab-text {
  font-size: 14px;
  color: #8E8E93;
  white-space: nowrap;
}

.tab-item.active .tab-text {
  color: #FFFFFF;
  font-weight: 500;
}
</style>
