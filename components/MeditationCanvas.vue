<template>
  <!-- #ifdef APP-NVUE -->
  <view class="canvas-wrapper">
    <canvas id="meditationCanvas" class="canvas-element" :style="{ width: _width + 'px', height: _height + 'px' }" />
  </view>
  <!-- #endif -->
  <!-- #ifndef APP-NVUE -->
  <view class="canvas-wrapper">
    <!-- 使用 type="2d" 对齐最新 API，并给好宽高撑满父元素 -->
    <canvas type="2d" id="meditationCanvas" canvas-id="meditationCanvas" class="canvas-element" />
  </view>
  <!-- #endif -->
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, getCurrentInstance } from 'vue';

const props = defineProps<{
  activeTracks: Array<{ id: string, volume: number }>
}>();

const instance = getCurrentInstance();

let canvasNode: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let requestID: number | null = null;

let _width = 0;
let _height = 0;

// ========================
// 粒子系统基础构造
// ========================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  type: string; // 'bonfire' | 'drizzle' | 'wind' | 'wave'
  // 水墨涟漪特有：
  radius?: number;
  maxRadius?: number;
}

let particles: Particle[] = [];

// ========================
// 绘制算法
// ========================
const addBonfireParticle = (volume: number) => {
  // 从底部中间或随机位置生成
  if (Math.random() > volume * 0.5) return; // 频率与音量正相关
  particles.push({
    x: _width * 0.2 + Math.random() * _width * 0.6, // 集中在中下部
    y: _height,
    vx: (Math.random() - 0.5) * 1.5,
    vy: -1 - Math.random() * 2 * volume, // 上升速度和音量正相关
    life: 0,
    maxLife: 60 + Math.random() * 40,
    size: 5 + Math.random() * 15 * volume,
    alpha: 0.8 * volume,
    type: 'bonfire'
  });
};

const addDrizzleParticle = (volume: number) => {
  if (Math.random() > volume * 0.8) return;
  particles.push({
    x: Math.random() * _width,
    y: Math.random() * _height * 0.8, // 随机落在上半部分
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 40 + Math.random() * 20,
    size: 2,
    alpha: 0.6 * volume,
    radius: 0,
    maxRadius: 10 + Math.random() * 20 * volume,
    type: 'drizzle'
  });
};

const drawBonfire = (p: Particle, ctx: CanvasRenderingContext2D) => {
  const percent = p.life / p.maxLife;
  const currentAlpha = p.alpha * (1 - percent);
  const currentSize = p.size * (1 - percent);
  
  ctx.beginPath();
  // 暖色调模糊粒子：橙红渐变
  const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentSize);
  gradient.addColorStop(0, `rgba(255, 120, 0, ${currentAlpha})`);
  gradient.addColorStop(1, `rgba(255, 60, 0, 0)`);
  
  ctx.fillStyle = gradient;
  ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
  ctx.fill();
};

const drawDrizzleRipple = (p: Particle, ctx: CanvasRenderingContext2D) => {
  // 雨滴落地，扩大涟漪淡出
  const percent = p.life / p.maxLife;
  if (!p.radius) p.radius = 0;
  p.radius += (p.maxRadius! - p.radius) * 0.05;
  const currentAlpha = p.alpha * (1 - percent);
  
  ctx.beginPath();
  ctx.strokeStyle = `rgba(200, 200, 200, ${currentAlpha})`;
  ctx.lineWidth = 1;
  // 椭圆视觉透视
  ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
};

let windTime = 0;
const drawWind = (ctx: CanvasRenderingContext2D, volume: number) => {
  // 水平气流，风的轨迹
  windTime += 0.02 * volume;
  ctx.beginPath();
  ctx.moveTo(0, _height * 0.4);
  const cp1x = _width * 0.3;
  const cp1y = _height * 0.4 + Math.sin(windTime) * 50 * volume;
  const cp2x = _width * 0.7;
  const cp2y = _height * 0.4 - Math.cos(windTime * 1.5) * 60 * volume;
  const endX = _width;
  const endY = _height * 0.3;
  
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.strokeStyle = `rgba(220, 220, 220, ${0.1 * volume})`;
  ctx.lineWidth = 2 + volume * 4;
  ctx.stroke();

  // 添加第二条辅助风线
  ctx.beginPath();
  ctx.moveTo(0, _height * 0.5);
  ctx.bezierCurveTo(
    cp1x + 20, cp1y - 30, 
    cp2x - 20, cp2y + 40, 
    endX, endY + 20
  );
  ctx.strokeStyle = `rgba(200, 200, 200, ${0.05 * volume})`;
  ctx.lineWidth = 1 + volume * 2;
  ctx.stroke();
};

let waveTime = 0;
const drawWave = (ctx: CanvasRenderingContext2D, volume: number) => {
  waveTime += 0.01 + volume * 0.02;
  // 生成底部缓慢起伏的深色正弦波叠加
  ctx.beginPath();
  ctx.moveTo(0, _height);
  
  const amplitude = 30 * volume;
  const frequency = 0.01;
  const baseHeight = _height * 0.85;

  for (let x = 0; x <= _width; x += 10) {
    const y = baseHeight + Math.sin(x * frequency + waveTime) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(_width, _height);
  ctx.lineTo(0, _height);
  ctx.closePath();
  
  const gradient = ctx.createLinearGradient(0, baseHeight - amplitude, 0, _height);
  gradient.addColorStop(0, `rgba(40, 60, 90, ${0.4 * volume})`);
  gradient.addColorStop(1, `rgba(20, 30, 50, ${0.8 * volume})`);
  ctx.fillStyle = gradient;
  ctx.fill();
};

const renderLoop = () => {
  if (!ctx || !_width || !_height) return;

  // 1. 清屏 (因为有波浪等持续绘制，采用带有透明度背景以形成水墨拖影)
  ctx.fillStyle = 'rgba(13, 13, 13, 0.3)';
  ctx.fillRect(0, 0, _width, _height);

  let bonfireVol = 0;
  let drizzleVol = 0;
  let windVol = 0;
  let waveVol = 0;

  // 获取各种活跃元素的音量
  props.activeTracks.forEach(t => {
    if (t.id === 'bonfire') bonfireVol = t.volume;
    if (t.id === 'drizzle') drizzleVol = t.volume;
    if (t.id === 'wind') windVol = t.volume;
    if (t.id === 'wave') waveVol = t.volume;
  });

  // 2. 根据音量不断生成新粒子
  if (bonfireVol > 0) addBonfireParticle(bonfireVol);
  if (drizzleVol > 0) addDrizzleParticle(drizzleVol);

  // 3. 绘制连续波形内容
  if (windVol > 0) drawWind(ctx, windVol);
  if (waveVol > 0) drawWave(ctx, waveVol);

  // 4. 更新并绘制离散粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.life++;
    p.x += p.vx;
    p.y += p.vy;

    if (p.life >= p.maxLife || (p.type === 'bonfire' && p.y < 0)) {
      particles.splice(i, 1);
      continue;
    }

    if (p.type === 'bonfire') {
      drawBonfire(p, ctx);
    } else if (p.type === 'drizzle') {
      drawDrizzleRipple(p, ctx);
    }
  }

  // 5. 循环
  requestID = canvasNode?.requestAnimationFrame(renderLoop) || 
               // 微信小程序兜底
               setTimeout(() => { renderLoop(); }, 16) as any as number;
};

onMounted(() => {
  // 采用 uni.createSelectorQuery() 处理跨平台 canvas2d
  const query = uni.createSelectorQuery().in(instance);
  query.select('#meditationCanvas')
    .fields({ node: true, size: true }, (res: any) => {
      if (res && res.node) {
        // 微信小程序/H5 等支持 type="2d"
        canvasNode = res.node;
        _width = res.width || 300;
        _height = res.height || 200;
        canvasNode!.width = _width;
        canvasNode!.height = _height;
        ctx = canvasNode!.getContext('2d') as CanvasRenderingContext2D;
        
        // 启动动画
        if (typeof canvasNode!.requestAnimationFrame === 'function') {
          requestID = canvasNode!.requestAnimationFrame(renderLoop);
        } else {
          renderLoop(); // 开始定时器循环
        }
      } else {
        // App端旧版canvas-id兜底
        _width = res.width || uni.getSystemInfoSync().windowWidth;
        _height = res.height || (uni.getSystemInfoSync().windowHeight * 0.35);
        ctx = uni.createCanvasContext('meditationCanvas', instance) as unknown as CanvasRenderingContext2D;
        // 注意：旧版Canvas无法使用 requestAnimationFrame，一般需要改用draw(true)和setInterval，这里为了简化，主要兼容 type="2d"
        // 实际如果要兼容APP旧版canvas，则需要不同的渲染逻辑。目前uniapp默认在app-vue支持了较为完善的2d API如果配置了
      }
    })
    .exec();
});

onUnmounted(() => {
  if (requestID) {
    if (canvasNode && typeof canvasNode.cancelAnimationFrame === 'function') {
      canvasNode.cancelAnimationFrame(requestID);
    } else {
      clearTimeout(requestID);
    }
  }
  // 清理内存
  particles = [];
});
</script>

<style scoped>
.canvas-wrapper {
  width: 100%;
  height: 100%;
}

.canvas-element {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
