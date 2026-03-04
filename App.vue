<script lang="ts">
import { defineComponent } from 'vue';
import AudioEngine from './utils/AudioEngine';

export default defineComponent({
  onLaunch() {
    console.log('App Launch');
  },
  onShow() {
    console.log('App Show');
    // 回到前台时尝试恢复后台音频
    try {
      console.log('[App] AudioEngine state:', AudioEngine.getState?.(), 'lastBgSrc:', AudioEngine.lastBgSrc);
      AudioEngine.onAppShow?.();
    } catch (e) {
      // ignore
    }
  },
  onHide() {
    console.log('App Hide');
    try {
      console.log('[App] AudioEngine state:', AudioEngine.getState?.(), 'lastBgSrc:', AudioEngine.lastBgSrc);
      AudioEngine.onAppHide?.();
    } catch (e) {
      // ignore
    }
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
