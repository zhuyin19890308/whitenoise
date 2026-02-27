<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  onLaunch() {
    console.log('App Launch');
  },
  onShow() {
    console.log('App Show');
  },
  onHide() {
    console.log('App Hide');
  }
});
</script>

<style lang="scss">
/* 每个页面公共css */
page {
  background-color: #121212; /* 深色模式背景 */
  color: #E0E0E0; /* 深色模式文字 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  height: 100%;
  width: 100%;
  overflow: hidden; /* 防止原生滚动 */
}
</style>
