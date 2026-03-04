# 眠融 (MianRong) - 专业级白噪音冥想空间

> **沉浸式声学混音器 | 极简主义设计 | 极致交互体验**

一个基于 uni-app 开发的极致白噪音混音器，旨在提供深度的沉浸感与高效的专注体验。

<img src="static/screenshot_pro.png" width="30%" alt="眠融 PRO 运行界面" />

## 💎 PRO 版本核心特性

### 1. 极致简约的“悬浮”布局 (Pure Floating UI)
- **无界设计**：移除了所有背景方块、边框和分割线。调音台控件直接“漂浮”在动态水墨背景之上，营造出一种融于环境的自然感。
- **重心下移**：重新设计的垂直布局，将核心控制区推向屏幕底部，缩短手指操作路径，完美适配大屏手机的单手使用。

### 2. 交互式 8 轨专业调音台
- **纯电平交互**：去除了传统的物理滑块手柄，仅保留纵向彩色电平条。直接在轨道上滑动即可调节音量，视觉反馈丝滑顺畅。
- **独奏模式 (Solo Mode)**：**长按**任意音轨即可触发中等强度触感震动，系统自动将其他音轨静音，聚焦当前音源。

### 3. 多场景智能管理
- **预设场景**：内置“深度专注”、“宝宝助眠”、“冥想时刻”等多种专业混音方案。
- **自定保存**：调好满意的组合后，一键保存为个人场景，支持云端同步样式的手感。

### 4. 情境化功能面板
- **原生时钟图标**：采用纯 CSS 绘制的等宽时钟图标，解决跨平台显示差异，保持 iOS/Android 视觉高度统一。
- **动态倒计时**：开启睡眠定时后，剩余时间实时显示在图标下方，信息获取更直觉，无多余文字干扰。

## 🛠 技术栈

- **框架**: [uni-app](https://uniapp.dcloud.net.cn/) (Vue 3 + TypeScript)
- **平台**: 微信小程序 (mp-weixin) / H5 / App (iOS & Android)
- **核心组件**: 自定义 `MeditationCanvas` (动态视觉层), `AudioCacheManager` (远程加速库)

## 🚀 快速开始

1. **克隆项目**
   ```bash
   git clone https://github.com/zhuyin19890308/whitenoise.git
   ```

2. **开发环境**
   - 推荐使用 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 最新版。
   - 打开项目后，等待 npm 插件自动安装完成。

3. **编译运行**
   - 使用 HBuilderX：点击顶部 `运行 -> 运行到小程序模拟器`。
   - 或使用微信开发者工具导入 `dist/dev/mp-weixin` 目录进行本地调试。

---

## ☁️ 云混音 & 后台播放架构说明

### 1. 后端云混音服务（不可修改）

- 目录：`server/`
- 核心接口：`POST /api/v1/synthesize`
  - 请求体：`{ tracks: [{ id, vol }], duration: number }`
  - Hash 规则：后端将 `tracks` 按 `id` 排序，序列化成 `JSON.stringify({ tracks: sortedTracks, duration })`，然后做 `MD5`，生成唯一混音文件名。
  - 响应示例：
    ```json
    {
      "success": true,
      "url": "https://sounds.zhuyin.pro:1024/temp/<hash>.mp3",
      "hash": "<hash>",
      "cached": false
    }
    ```

> 注意：`server/` 代码为独立部署的 Node / ffmpeg 混音服务，本项目前端 **只消费接口，不修改后端实现**。

### 1.1 后端 Docker 构建与部署示例

以下是当前线上使用的构建 & 部署流程，仅作示例参考：

#### 本地构建镜像并打包

在后端项目根目录（即 `server` 对应的 Node 项目目录）下：

```bash
# 构建 amd64 平台镜像
docker build --platform linux/amd64 -t zhuyin19890308/whitenoise-server:v1.1.5 .

# 导出为离线 tar 包，方便传到远端 NAS / 服务器
docker save -o whitenoise-v1.1.5.tar zhuyin19890308/whitenoise-server:v1.1.5
```

> 实际开发中，可以通过脚本（如 `test.sh`）自动化上述流程，这里仅展示关键命令。

#### 远端（NAS / 服务器）加载 & 运行

在远端服务器上（示例路径 `/vol1/1000/myApps/whitenoise`）：

```bash
# 1. 停止并删除旧容器
docker rm -f mianrong-backend || true

# 2. 加载新镜像
docker load -i whitenoise-v1.1.5.tar

# 3. 运行新容器
docker run -d \
  --name mianrong-backend \
  -p 4000:3000 \
  -v /vol1/1000/myApps/whitenoise/sources:/app/sources \
  --tmpfs /app/temp:size=512M \
  -e BASE_URL=https://sounds.zhuyin.pro:1024 \
  -e SOURCE_DIR=/app/sources \
  zhuyin19890308/whitenoise-server:v1.1.5

# 4. 验证容器状态
docker ps | grep mianrong-backend
docker logs mianrong-backend
```

- `-v /vol1/1000/myApps/whitenoise/sources:/app/sources`：挂载原始音源（单轨 mp3）目录。
- `--tmpfs /app/temp:size=512M`：混音临时文件目录放在内存盘，加速合成。
- `BASE_URL=https://sounds.zhuyin.pro:1024`：后端在返回合成 URL 时使用该前缀，需与前端 `LUCKY_BASE_URL` 对齐。

### 2. 动态音源配置（前端）

- 配置文件：`config/index.ts`
- 关键导出：
  - `AUDIO_TRACKS`：动态音源列表（风声、细雨、雷声等），支持后续拓展和用户自定义音源。
  - `NAS_BASE_URL`：原始音源（单轨 mp3）所在的 NAS 域名。
  - `SERVER_BASE_URL`：云混音 API 的访问入口，已经根据 **微信开发者工具 / 真机** 做了自动区分：
    ```ts
    const systemInfo = uni.getSystemInfoSync?.() || {};
    const isDevtools = systemInfo.platform === 'devtools';

    export const LUCKY_BASE_URL = 'https://sounds.zhuyin.pro:1024';

    export const NAS_BASE_URL = isDevtools
      ? `${LUCKY_BASE_URL}/sounds/`
      : `${LUCKY_BASE_URL}/sounds/`;

    export const SERVER_BASE_URL = isDevtools
      ? LUCKY_BASE_URL
      : LUCKY_BASE_URL;
    ```
  - `DEFAULT_MIX_DURATION`：云混音目标时长（单位：秒），开发阶段可短一些（如 30），生产可设为 1800/3600 等。

### 3. 智能资源管理器：`utils/ResourceManager.js`

**职责：**
- 永久缓存单轨音源（由 `AudioCacheManager` 完成，此处不赘述）。
- 负责混合文件生命周期管理：
  - 调用云混音 API。
  - 通过 `uni.downloadFile` 下载 mp3。
  - 通过 `uni.saveFile` 持久化到本地。
  - 删除旧混合文件（新王登基，旧王退位）。

**关键方法：**

- `queueMixedDownload(tracks, duration, callbacks)`：
  - 入参：
    - `tracks: { id: string; vol: number }[]`
    - `duration: number`
    - `callbacks?: { onStart, onProgress, onSuccess, onError }`
  - 行为：
    1. 根据 `tracks + duration` 生成与后端一致的 Hash（保证幂等）。
    2. 先检查本地是否已有对应混合文件（Hash 命名），命中则直接返回。
    3. 未命中则：
       - `POST /api/v1/synthesize`，拿到合成 mp3 的云端 URL。
       - 通过 `uni.downloadFile` 下载，`onProgressUpdate` 驱动 UI 的百分比提示。
       - 通过 `uni.saveFile` 持久化到本地，返回 `savedFilePath`（如 `wxfile://store_xxx.mp3`）。
       - 删除上一个混合文件（如果存在），仅保留当前一个。
    4. 将最终本地路径通过 `onSuccess(localPath)` 回传给上层（`AudioEngine`）。

> 前端不会直接播放远程云端 URL，而是 **先下载再本地播放**，避免后台网络抖动导致的断播。

### 4. 音频引擎：`utils/AudioEngine.js`

音频引擎是本项目的「大脑」，负责 **模式切换 / 状态机 / 事件广播**。

- **Mode A（本地多路混音）**
  - 使用多个 `InnerAudioContext`（每轨一个）。
  - 音源来自 NAS 或本地缓存（`AudioCacheManager.getAudioPath`）。
  - 拖动推子、长按独奏、切换场景等全部基于 Mode A，即时反馈，无需走云端。

- **Mode B（后端单文件）**
  - 使用 `BackgroundAudioManager` 播放后端合成出的单文件 mp3。
  - 播放源为本地持久化路径（`wxfile://store_xxx.mp3`），由 `ResourceManager` 提供。
  - 支持小窗播放 & 真机后台播放。

#### 状态机

`AudioEngineState` 枚举了所有对 UI 友好的状态：

- `IDLE`：无播放。
- `LOCAL_MIX`：本地多路混音中（Mode A）。
- `CLOUD_MIXING`：预留态（当前实现中直接跳到 CLOUD_LOADING，可按需扩展）。
- `CLOUD_LOADING`：云混音文件下载中（关键态，需要 UI 显示「☁️ 云加载中…」）。
- `READY`：已切换到后台单文件播放（Mode B）。
- `ERROR`：云混音失败，自动回退到本地模式，并给出提示。

#### 事件回调（供页面订阅）

`AudioEngine.setCallbacks({ onStateChange, onProgress, onError })`：

- `onStateChange(state, prevState)`：
  - 驱动 UI 的状态文案（本地混音 / 云加载中 / 已就绪 / 错误提示）。
- `onProgress(progress)`：
  - 显示云混音下载进度（0–100%）。
- `onError(error)`：
  - 在页面上 toast 提示「云端合成失败，已切回本地模式」。

#### 切换逻辑

- **从 Mode A → Mode B：**
  - 用户拖动推子停止后：
    - `AudioEngine.switchToCloudMix(activeTracks, DEFAULT_MIX_DURATION)`。
    - 立刻保持本地多轨混音播放（保证无缝过渡）。
    - 云混音下载完成后：
      - 停掉所有本地 `InnerAudioContext`。
      - 启动 `BackgroundAudioManager`，设置 src 为本地混合文件。
      - 状态切到 `READY`。

- **从 Mode B → Mode A：**
  - 用户再次拖动推子、发生错误等：
    - 取消当前云混音下载任务（`ResourceManager.cancelCurrentDownload()`）。
    - 停止后台单文件。
    - 状态切回 `LOCAL_MIX` 并重新激活本地轨道。

#### 前台 / 后台行为

- 配置：
  - `manifest.json` 的 `mp-weixin.requiredBackgroundModes = ["audio"]`。
  - 确保编译后的小程序根目录 `app.json` 中也包含该字段（这一点是微信后台播放生效的关键）。
- 行为：
  - 真机上，切后台后由微信官方的 `BackgroundAudioManager` 机制保证继续播放。
  - `App.vue` 的 `onShow/onHide` 会调用 `AudioEngine.onAppShow/onAppHide`，辅助恢复：
    - 记住最近一次后台播放的本地路径 `lastBgSrc`。
    - 回到前台时，如果 `bgAudioManager.src` 丢失，则重新设置并 `play()`。

#### 播放/暂停按钮的双模行为

- 在 Mode A（本地混音）：
  - 点击暂停：暂停所有 `InnerAudioContext`。
  - 再次点击播放：根据当前推子音量恢复所有有声轨道。

- 在 Mode B（后台单文件）：
  - 点击暂停：仅对 `BackgroundAudioManager` 调用 `pause()`，不 `stop()`，小窗和后台实例会保留。
  - 再次点击播放：直接 `BackgroundAudioManager.play()`，无缝恢复后台混音和小窗。

### 5. 页面交互与状态文案：`pages/index/index.vue`

#### 状态提示 UI 布局

- 位置：8 通道调音台顶部、场景 LCD 之上，紧贴推子区域。
- 模板片段：

```vue
<view class="mixer-panel">
  <!-- 状态提示容器：非侵入式，位于滑块下方 -->
  <view class="engine-status" v-if="audioStatusText">
    <text class="status-text" :class="audioStatusClass">{{ audioStatusText }}</text>
  </view>
  <!-- 下面是 SCENE/CH LCD、场景列表、推子等 -->
</view>
```

#### 状态文案和样式

- 文案逻辑（简化版）：
  - `LOCAL_MIX / IDLE`：不显示或极淡提示。
  - `CLOUD_LOADING`：显示 `☁️ 云加载中…`（带呼吸动画和省略号动态）。
  - `READY`：显示 `✓ 已就绪` 后几秒淡出。
  - `ERROR`：显示 `⚠️ 云端失败，使用本地模式`，然后回退到本地混音。

- 样式特征：
  - 字体小：11px。
  - 颜色淡：`rgba(255,255,255,0.4)` 为基础色。
  - 动画通过 `@keyframes status-pulse` 和 `ellipsis` 实现轻微呼吸 & 动态省略号。

---

## ⚠️ 常见坑位与注意事项

1. **后台播放失效（切后台几秒就停）**
   - 根因：最终运行的小程序工程中，`app.json` 没有 `requiredBackgroundModes: ["audio"]`。
   - 解决：
     - 在 `manifest.json` 的 `mp-weixin` 段中配置：
       ```json
       "mp-weixin": {
         "requiredBackgroundModes": ["audio"]
       }
       ```
     - 或直接在微信小程序工程的根目录 `app.json` 中手动加入：
       ```json
       {
         "requiredBackgroundModes": ["audio"],
         ...
       }
       ```
     - 修改后需要重新编译并在真机上测试。

2. **开发者工具与真机行为不一致**
   - DevTools 对音频 API 的支持不完整，例如：
     - `setInnerAudioOption:fail 开发者工具暂时不支持此 API 调试`
     - 后台播放、锁屏等行为与真机有差异。
   - 建议：
     - 所有与音频相关的关键行为（尤其是后台播放）必须以 **真机测试** 为准。
     - DevTools 仅作为 UI 与基础逻辑的快速联调工具。

3. **域名与证书问题**
   - 云混音 API 与音源下载域名必须：
     - 在微信小程序后台配置为 `request` 与 `downloadFile` 合法域名。
     - 使用有效的 HTTPS 证书（自签名证书需要在 DevTools 中开启「忽略证书错误」）。
   - 当前项目默认使用：
     - `https://sounds.zhuyin.pro:1024` 作为统一入口，由 NAS / Lucky 反向代理到 Docker 容器。

---

## 📅 版本更新日志 (v1.0.1)
- [x] **UI 改版**：移除所有冗余背景块与边框，实现 Floating 视觉。
- [x] **交互升级**：移除物理推子块，改为全轨道触控及 Solo 逻辑。
- [x] **品牌重塑**：从“冥想空间”正式更名为“眠 融”。
- [x] **跨平台修复**：自定义 CSS 绘制图标，修复 iOS 字符渲染不一致问题。
