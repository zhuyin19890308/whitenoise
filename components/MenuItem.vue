<template>
  <view class="menu-item" @tap="onTap">
    <view class="menu-icon-wrap">
      <text class="menu-icon">{{ icon }}</text>
    </view>
    <text class="menu-label">{{ label }}</text>
    <text class="menu-arrow">›</text>
  </view>
</template>

<script>
export default {
  name: 'MenuItem',
  props: {
    icon: {
      type: String,
      default: '📋'
    },
    label: {
      type: String,
      required: true
    },
    value: {
      type: [String, Number],
      default: ''
    }
  },
  emits: ['tap'],
  methods: {
    onTap() {
      this.$emit('tap', {
        label: this.label,
        value: this.value
      });
    }
  }
};
</script>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #121829;
  border-radius: 12px;
  margin-bottom: 8px;
}

.menu-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #1A2035;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.menu-icon {
  font-size: 16px;
}

.menu-label {
  flex: 1;
  font-size: 15px;
  color: #FAFAF9;
}

.menu-arrow {
  font-size: 20px;
  color: #6B6B70;
}
</style>
