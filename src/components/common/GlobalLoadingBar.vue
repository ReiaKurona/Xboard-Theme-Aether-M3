<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { loadingProgress, loadingStatus, isBarVisible } from '../../utils/loadingBar'

interface SparkleParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
  decay: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationFrameId: any = null
const particles: SparkleParticle[] = []

// 🌟 高定量子极光色谱 (高冷精致、不花哨)
const plasmaColors = [
  '#ffffff', // 30% 核心白炽火花
  '#67e8f9', // 冰晶青
  '#a5b4fc', // 钴蓝
  '#c084fc', // 霓虹紫
  '#f472b6'  // 洋红微晕
]

// 物理限制画布高度仅为 18px，杜绝任何粒子向下漏出遮挡 UI
const updateCanvasSize = () => {
  if (canvasRef.value) {
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = 18
  }
}

// 粒子主引擎循环
const renderLoop = () => {
  if (!ctx || !canvasRef.value) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  const isVisible = isBarVisible.value
  const progress = loadingProgress.value
  const headX = (progress / 100) * canvasRef.value.width

  // 1. 运行中：在彗星头部严格沿反方向 145° 锥角喷射微细火花
  if (isVisible && loadingStatus.value === 'loading' && progress > 2 && progress < 98) {
    // 每次迭代发射 1~2 颗微细粒子
    for (let i = 0; i < 2; i++) {
      // 🌟 核心：计算 145° 扇区（以 180° 为中心向上下各展开 72.5°）
      // 弧度制：π ± (145/2) deg
      const spreadAngle = (145 * Math.PI) / 180
      const angle = Math.PI + (Math.random() - 0.5) * spreadAngle

      // 适中的喷射初速度
      const speed = Math.random() * 2.2 + 1.0

      particles.push({
        x: headX - 1, // 位于头部核心稍后侧
        y: 2,         // 紧贴顶部轨道
        vx: Math.cos(angle) * speed,       // 严格负 X 轴反向推进
        vy: Math.sin(angle) * speed * 0.45, // 垂直方向施加 0.45 扁平阻尼，收敛在轨道边缘
        size: Math.random() * 1.2 + 0.6,   // 0.6px ~ 1.8px 微细光斑
        alpha: 1,
        color: plasmaColors[Math.floor(Math.random() * plasmaColors.length)],
        decay: Math.random() * 0.045 + 0.035 // 快速湮灭，限制飞行距离在 25px~35px 之间
      })
    }
  }

  // 2. 物理运动更新与空气阻尼
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy

    // 速度阻尼衰减（迅速失速并消散，杜绝漂逸太远）
    p.vx *= 0.94
    p.vy *= 0.92
    p.alpha -= p.decay

    if (p.alpha <= 0) {
      particles.splice(i, 1)
      continue
    }

    ctx.save()
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = p.size * 2.5
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  animationFrameId = requestAnimationFrame(renderLoop)
}

// 🌟 100% 冲线终点：精致的水平激光微晕扩散（不向下炸开）
const triggerBurst = () => {
  if (!canvasRef.value) return
  const w = canvasRef.value.width
  for (let i = 0; i < 20; i++) {
    const spreadAngle = (120 * Math.PI) / 180
    const angle = Math.PI + (Math.random() - 0.5) * spreadAngle
    const speed = Math.random() * 3.5 + 1.2

    particles.push({
      x: w - 2,
      y: 2,
      vx: Math.cos(angle) * speed,
      vy: (Math.random() - 0.2) * 1.5,
      size: Math.random() * 1.5 + 0.8,
      alpha: 1,
      color: plasmaColors[Math.floor(Math.random() * plasmaColors.length)],
      decay: Math.random() * 0.035 + 0.02
    })
  }
}

watch(
  () => loadingStatus.value,
  (status) => {
    if (status === 'success') {
      triggerBurst()
    }
  }
)

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    renderLoop()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="global-top-loading-system"
      :style="{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        zIndex: 2147483647,
        pointerEvents: 'none',
        opacity: isBarVisible ? 1 : 0,
        transition: 'opacity 0.25s ease'
      }"
    >
      <!-- 1. 核心流动激光光轨 (3.5px 纯净高密度) -->
      <div
        class="loading-track"
        :class="loadingStatus === 'error' ? 'track-error' : 'track-gradient'"
        :style="{
          height: '4px',
          width: '100%',
          position: 'relative',
          transform: `translate3d(${loadingProgress - 100}%, 0, 0)`,
          transition: loadingStatus === 'loading'
            ? 'transform 0.26s cubic-bezier(0.2, 0, 0, 1)'
            : 'transform 0.32s cubic-bezier(0.34, 1.45, 0.64, 1)'
        }"
      >
        <!-- 2. 彗星光斑微核 (光晕更紧致内敛，不刺眼) -->
        <div class="comet-head"></div>
      </div>

      <!-- 3. Canvas 粒子层 (高度仅 18px，严格约束在轨顶) -->
      <canvas
        ref="canvasRef"
        style="position: absolute; top: 0; left: 0; width: 100%; pointer-events: none;"
      ></canvas>
    </div>
  </Teleport>
</template>

<style scoped>
/* 🌟 高定量子激光流光 (青蓝 -> 钴蓝 -> 电紫 -> 柔粉，冷峻科技感) */
.track-gradient {
  background: linear-gradient(
    90deg,
    #00f2fe 0%,
    #4facfe 30%,
    #7000ff 60%,
    #e056fd 85%,
    #00f2fe 100%
  );
  background-size: 200% 100%;
  animation: laser-flow 2s linear infinite;
  box-shadow: 
    0 1px 8px rgba(112, 0, 255, 0.65),
    0 2px 14px rgba(0, 242, 254, 0.35);
}

.track-error {
  background: linear-gradient(90deg, #ef4444, #f43f5e, #dc2626);
  box-shadow: 0 2px 14px rgba(239, 68, 68, 0.85);
}

@keyframes laser-flow {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

/* 彗星头部发光核心 (10px 紧致光子核心) */
.comet-head {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: radial-gradient(circle, #ffffff 40%, rgba(112, 0, 255, 0.85) 75%, transparent 100%);
  box-shadow: 
    0 0 6px #ffffffb0,
    0 0 14px #4facfe,
    0 0 20px #7000ff;
}
</style>