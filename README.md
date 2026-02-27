# 冥想空间 (WhiteNoise)

一个基于 uni-app 开发的极致白噪音混音器，旨在提供沉浸式的冥想与专注体验。

## 特性亮点

- **8 轨并行混音**：支持 8 路独立音轨同时播放，支持风声、雨声、雷声、柴火声等多种自然音源。
- **独奏模式 (Solo Mode)**：长按音轨卡片即可快速进入独奏模式，通过触感震动反馈并自动静音其他音轨。
- **UI 极致响应**：针对移动端滑块（Slider）进行了布局缓存优化，确保音量调节丝滑顺畅。
- **按需加载与缓存**：接入远程音源服务器，采用自动缓存机制，节省流量的同时保证二次打开秒开。
- **睡眠定时**：支持多种时长定时关闭，陪伴你安心入眠。

## 技术栈

- **框架**: [uni-app](https://uniapp.dcloud.net.cn/) (Vue 3 + TypeScript)
- **平台**: 微信小程序 (mp-weixin) / H5 / App
- **音频引擎**: `InnerAudioContext`

## 快速开始

1. **克隆项目**
   ```bash
   git clone https://github.com/zhuyin19890308/whitenoise.git
   ```

2. **开发环境**
   - 推荐使用 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 打开项目。
   - 安装必要的插件：Vue 3, TypeScript, Compile-node-sass 等。

3. **运行**
   - 在 HBuilderX 中点击 `运行 -> 运行到小程序模拟器 -> 微信开发者工具`。

## 项目结构

```text
├── config/         # 轨道与音频配置
├── pages/          # 主界面逻辑 (index/index.vue)
├── static/         # 静态资源
├── utils/          # 音频缓存管理器 (AudioCacheManager)
├── manifest.json   # 应用配置
└── pages.json      # 页面路由
```

## 贡献

欢迎提交 Issue 或 Pull Request 来完善这个项目。

## 许可证

[MIT](LICENSE)
