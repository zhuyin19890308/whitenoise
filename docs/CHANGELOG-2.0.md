# 眠融 2.0 升级日志

## 2026-04-27

### 概述

本次更新完成眠融 App 2.0 版本的基础架构搭建，包括多页面架构、TabBar 导航、微信分享功能、平台差异化音频策略等核心功能。

---

## 一、新增功能

### 1.1 多页面架构

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `pages/index/index` | 8轨混音器 + 播放控制 |
| 声音库 | `pages/sound-library/index` | 浏览所有声音 + 分类筛选 |
| 收藏夹 | `pages/favorites/index` | 收藏的混音 + 单独声音 |
| 个人中心 | `pages/profile/index` | 用户信息 + 统计 + 菜单 |
| 睡眠计时器 | `pages/timer/index` | 定时关闭 + 渐出 |

### 1.2 自定义 TabBar 导航

- 底部固定导航栏
- 5个 Tab：首页、声音库、计时器、收藏、我的
- 支持安全区域适配
- 激活状态高亮显示

### 1.3 微信分享功能

每个页面实现：
- `onShareAppMessage` - 分享给好友
- `onShareTimeline` - 分享到朋友圈

分享内容根据当前状态动态生成。

### 1.4 平台差异化音频策略

| 平台 | 策略 |
|------|------|
| iOS/Android App | 本地多路混音优先，后端合成降级 |
| 微信小程序 | 后端合成（保持原有逻辑） |

---

## 二、页面变更

### 2.1 首页 (`pages/index/index`)

**修改内容：**
- 导入 TabBar 组件
- 底部添加 TabBar 导航
- 增加底部留白 80px 避免被 TabBar 遮挡
- 实现微信分享功能（根据当前播放状态动态生成分享内容）

### 2.2 声音库 (`pages/sound-library/index`)

**新增内容：**
- 分类标签栏（推荐、自然、城市、白噪音、助眠、放松）
- 声音卡片网格（3列布局）
- 点击声音切换播放状态

**组件依赖：**
- `StatusBar`
- `TabBar`
- `CategoryTabs`
- `SoundCard`

### 2.3 收藏夹 (`pages/favorites/index`)

**新增内容：**
- 收藏的混音列表（MixCard 组件）
- 收藏的声音列表
- 本地存储读写
- 空状态提示
- 点击跳转到首页并应用混音/播放声音

**存储结构：**
```javascript
{
  mixes: [{ id, name, volumes }],
  sounds: ['wind', 'drizzle', ...]
}
```

### 2.4 个人中心 (`pages/profile/index`)

**新增内容：**
- 用户头像（紫色渐变背景）
- PRO 徽章
- 统计信息（收藏数、使用天数、创建混音数）
- 菜单列表（我的账户、睡眠报告、设置、关于）
- 底部链接（退出登录、切换账户）

### 2.5 睡眠计时器 (`pages/timer/index`)

**已有功能：**
- 圆形计时器显示
- 预设按钮（15/30/45/60分钟 + 整晚）
- 开始/停止按钮
- 计时结束触发 `uni.$emit('timerEnd')`

---

## 三、新增组件

| 组件 | 路径 | 用途 |
|------|------|------|
| `StatusBar` | `components/StatusBar.vue` | 状态栏（时间、信号、电量） |
| `TabBar` | `components/TabBar.vue` | 底部导航栏 |
| `SoundCard` | `components/SoundCard.vue` | 声音库单张卡片 |
| `MixCard` | `components/MixCard.vue` | 收藏夹混音卡片 |
| `CategoryTabs` | `components/CategoryTabs.vue` | 分类标签栏 |
| `MenuItem` | `components/MenuItem.vue` | 菜单项 |

---

## 四、配置变更

### 4.1 `manifest.json`

**新增配置：**
- iOS 后台音频模式：`UIBackgroundModes: ["audio"]`
- Android 后台权限：`FOREGROUND_SERVICE`、`WAKE_LOCK`
- 微信分享开关：`enableShareAppMessage`、`enableShareTimeline`

### 4.2 `pages.json`

**新增页面路由：**
- `pages/sound-library/index`
- `pages/favorites/index`
- `pages/profile/index`
- `pages/timer/index`

### 4.3 `utils/platformUtils.js`

**新增工具函数：**
- `isApp()` / `isWeixin()` / `isIOS()` / `isAndroid()` - 平台判断
- `shouldUseCloudSynthesis(tracks)` - 混音策略判断
- `supportBackgroundPlayback()` - 后台播放支持检测
- `getShareConfig(params)` - 分享配置生成
- `parseShareParams()` - 分享参数解析
- `debounce()` / `throttle()` - 防抖节流

---

## 五、AudioEngine.js 变更

### 5.1 新增方法

| 方法 | 功能 |
|------|------|
| `shouldUseCloudMix(tracks)` | 判断是否使用后端合成 |
| `setBackgroundAudioInfo(mixInfo)` | 设置锁屏音频信息 |
| `initAudioInterruptionListener()` | 初始化音频中断监听 |
| `resume()` | 恢复播放（中断后） |
| `getCurrentMixName()` | 获取当前混音名称 |
| `fadeOutAndStop(fadeDuration)` | 渐出并停止（计时器用） |

### 5.2 音频中断处理

- 监听 `onAudioInterruptionBegin` / `onAudioInterruptionEnd`
- 中断后自动恢复播放

### 5.3 计时器集成

- 监听 `timerEnd` 事件
- 渐出 3 秒后停止

---

## 六、静态资源

### 6.1 TabBar 图标

位置：`static/tabbar/`

| 图标 | 文件 |
|------|------|
| 首页 | `home.svg` / `home-active.svg` |
| 声音库 | `library.svg` / `library-active.svg` |
| 计时器 | `timer.svg` / `timer-active.svg` |
| 收藏 | `favorite.svg` / `favorite-active.svg` |
| 我的 | `profile.svg` / `profile-active.svg` |

注：当前为 SVG 格式，后续需转换为 PNG。

### 6.2 分享海报

位置：`static/share/poster.svg`

渐变背景 + Logo + 名称的占位符。

---

## 七、Git 提交记录

| 提交 | 描述 |
|------|------|
| `c89f570` | feat: 首页适配 TabBar 架构并添加微信分享 |
| `f146343` | feat: 添加 UI 占位符资源 |
| `ddabd5a` | feat: Phase 2 - AudioEngine 平台差异化改造 |
| `13d6ec5` | feat: Phase 1 - 基础架构搭建 |
| `c65630f` | chore: bump version to 2.0.0 |

---

## 八、待完成工作

| 事项 | 优先级 | 说明 |
|------|--------|------|
| TabBar SVG 转 PNG | 高 | 部分平台可能不支持 SVG |
| 声音库完整交互 | 高 | 与 AudioEngine 联动 |
| 收藏夹添加功能 | 高 | 从首页添加到收藏 |
| 睡眠报告页面 | 中 | 图表展示 |
| 设置页面 | 中 | 各项配置 |

---

## 九、测试验证清单

- [ ] TabBar 导航切换正常
- [ ] 各页面音频播放正常
- [ ] iOS 后台播放正常
- [ ] Android 后台播放正常
- [ ] 微信分享正常
- [ ] 计时器渐出正常
- [ ] 收藏功能正常
