<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api/client'
import KnowledgeArticleView from '../../components/knowledge/KnowledgeArticleView.vue'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/progress/circular-progress.js'

const categoriesMap = ref<Record<string, any[]>>({})
const loading = ref(false)
const searchQuery = ref('')
const selectedArticle = ref<any | null>(null)
const isDetailLoading = ref(false)

// 响应式检测视口宽度
const windowWidth = ref<number>(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 1024)

// 移动端阅读状态与非线性滑动方向 ('push' 为进场向左，'pop' 为返回向右)
const isMobileReading = ref(false)
const navDirection = ref<'push' | 'pop'>('push')

const handleResize = () => {
  windowWidth.value = window.innerWidth
  // 若切到桌面宽屏，自动解除移动端阅读独占
  if (windowWidth.value >= 1024) {
    isMobileReading.value = false
  }
}

// 6.4 拉取知识库列表 (自动携带 language 参数)
const fetchKnowledgeList = async () => {
  loading.value = true
  try {
    const lang = localStorage.getItem('lang') || 'zh-CN'
    let url = `/user/knowledge/fetch?language=${encodeURIComponent(lang)}`
    if (searchQuery.value.trim()) {
      url += `&keyword=${encodeURIComponent(searchQuery.value.trim())}`
    }

    const res: any = await api.get(url)
    const data = res.data ?? res
    categoriesMap.value = (typeof data === 'object' && data !== null) ? data : {}

    // 桌面端默认加载第一篇文章
    if (!selectedArticle.value && window.innerWidth >= 1024) {
      const firstCat = Object.keys(categoriesMap.value)[0]
      if (firstCat && categoriesMap.value[firstCat].length > 0) {
        handleSelectArticle(categoriesMap.value[firstCat][0])
      }
    }
  } catch {
    categoriesMap.value = {}
  } finally {
    loading.value = false
  }
}

// 🌟 点击文章：触发 Push 右侧弹入动画
const handleSelectArticle = async (item: any) => {
  navDirection.value = 'push'
  isMobileReading.value = true

  if (item.body) {
    selectedArticle.value = item
    return
  }

  isDetailLoading.value = true
  try {
    const res: any = await api.get(`/user/knowledge/fetch?id=${item.id}`)
    selectedArticle.value = res.data ?? res
  } catch (err: any) {
    selectedArticle.value = item
  } finally {
    isDetailLoading.value = false
  }
}

// 🌟 点击返回目录：触发 Pop 左侧弹回动画
const handleBackToCatalog = () => {
  navDirection.value = 'pop'
  isMobileReading.value = false
}

const totalArticlesCount = computed(() => {
  return Object.values(categoriesMap.value).reduce((acc, list) => acc + (list?.length || 0), 0)
})

let searchDebounceTimer: any = null
const onSearchInput = (e: any) => {
  searchQuery.value = e.target.value
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(fetchKnowledgeList, 300)
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  fetchKnowledgeList()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-6 w-full overflow-hidden">
    <!-- 顶栏说明副标题 -->
    <div class="flex items-center justify-between pb-1">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        查阅客户端设置、网络节点连接教程与常见疑难排解文档。
      </p>

      <div class="px-3 py-1 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container)] flex items-center gap-1.5 shrink-0">
        <span class="material-symbols-outlined text-sm text-[var(--md-sys-color-primary)]">library_books</span>
        <span>共 {{ totalArticlesCount }} 篇教程</span>
      </div>
    </div>

    <!-- ========================================================
         🌟 模式 A：手机端原生导航栈（支持 Push/Pop 双向弹簧推屏）
         ======================================================== -->
    <div v-if="isMobile" class="w-full relative min-h-[500px]">
      <Transition
        :name="navDirection === 'push' ? 'mobile-nav-push' : 'mobile-nav-pop'"
        mode="out-in"
      >
        <!-- 页面 1：移动端目录列表 -->
        <div v-if="!isMobileReading" key="mobile-catalog" class="w-full flex flex-col gap-4">
          <md-outlined-text-field
            label="搜索教程关键字..."
            :value="searchQuery"
            @input="onSearchInput"
            class="w-full"
          >
            <span slot="leading-icon" class="material-symbols-outlined">search</span>
          </md-outlined-text-field>

          <div v-if="loading && totalArticlesCount === 0" class="py-16 flex justify-center">
            <md-circular-progress indeterminate></md-circular-progress>
          </div>

          <div v-else-if="totalArticlesCount === 0" class="py-16 text-center opacity-40 text-xs">
            未检索到相关教程
          </div>

          <!-- 分组卡片列表 -->
          <div v-else class="flex flex-col gap-5 pb-8">
            <div
              v-for="(articles, catName) in categoriesMap"
              :key="catName"
              class="flex flex-col gap-2"
            >
              <div class="px-2 text-xs font-black tracking-wider uppercase text-[var(--md-sys-color-primary)] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-base">folder</span>
                <span>{{ catName }}</span>
                <span class="text-[10px] opacity-50">({{ articles.length }})</span>
              </div>

              <div class="flex flex-col gap-2">
                <button
                  v-for="item in articles"
                  :key="item.id"
                  @click="handleSelectArticle(item)"
                  class="w-full text-left p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] active:scale-[0.98] transition-all flex items-center justify-between shadow-sm cursor-pointer"
                >
                  <span class="font-bold text-sm text-[var(--md-sys-color-on-surface)] truncate mr-2">{{ item.title }}</span>
                  <span class="material-symbols-outlined text-lg opacity-40 shrink-0">arrow_forward_ios</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 页面 2：移动端文章阅读器 -->
        <div v-else key="mobile-article" class="w-full">
          <div v-if="isDetailLoading" class="py-24 flex justify-center">
            <md-circular-progress indeterminate></md-circular-progress>
          </div>
          <KnowledgeArticleView
            v-else
            :article="selectedArticle"
            @back="handleBackToCatalog"
          />
        </div>
      </Transition>
    </div>

    <!-- ========================================================
         🌟 模式 B：桌面端双列分栏（右侧文章切换带有浮动淡入动效）
         ======================================================== -->
    <div v-else class="flex flex-row gap-6 w-full items-start">
      <!-- 左侧分类与搜索栏 -->
      <aside class="w-80 shrink-0 flex flex-col gap-4 sticky top-24">
        <md-outlined-text-field
          label="搜索教程关键字..."
          :value="searchQuery"
          @input="onSearchInput"
          class="w-full"
        >
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-outlined-text-field>

        <div v-if="loading && totalArticlesCount === 0" class="py-12 flex justify-center">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>

        <div v-else class="flex flex-col gap-4 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
          <div
            v-for="(articles, catName) in categoriesMap"
            :key="catName"
            class="flex flex-col gap-1.5"
          >
            <div class="px-3 py-1 text-xs font-black tracking-wider uppercase text-[var(--md-sys-color-primary)] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">folder</span>
              <span>{{ catName }}</span>
              <span class="text-[10px] opacity-50">({{ articles.length }})</span>
            </div>

            <div class="flex flex-col gap-1">
              <button
                v-for="item in articles"
                :key="item.id"
                @click="handleSelectArticle(item)"
                class="w-full text-left px-4 py-3 rounded-2xl text-xs font-semibold transition-all flex items-center justify-between group cursor-pointer"
                :class="selectedArticle?.id === item.id
                  ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-sm'
                  : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] opacity-80 hover:opacity-100'"
              >
                <span class="truncate mr-2">{{ item.title }}</span>
                <span class="material-symbols-outlined text-sm opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧文章主体 (点击切换文章带有非线性平滑过渡) -->
      <main class="flex-1 w-full min-w-0">
        <Transition name="desktop-article-swap" mode="out-in">
          <div v-if="isDetailLoading" key="loading" class="py-24 flex justify-center">
            <md-circular-progress indeterminate></md-circular-progress>
          </div>
          <KnowledgeArticleView
            v-else
            :key="selectedArticle?.id || 'empty'"
            :article="selectedArticle"
            @back="handleBackToCatalog"
          />
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* =========================================================
   🌟 手机端：Android 17 Spring 导航推屏过渡动效 (Push & Pop)
   ========================================================= */
.mobile-nav-push-enter-active,
.mobile-nav-push-leave-active,
.mobile-nav-pop-enter-active,
.mobile-nav-pop-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.35, 0.64, 1);
  will-change: transform, opacity;
}

/* 进场：目录向左微退，文章从右侧滑入 */
.mobile-nav-push-enter-from {
  opacity: 0;
  transform: translate3d(48px, 0, 0);
}
.mobile-nav-push-leave-to {
  opacity: 0;
  transform: translate3d(-32px, 0, 0);
}

/* 返回：目录从左侧复位，文章向右滑出 */
.mobile-nav-pop-enter-from {
  opacity: 0;
  transform: translate3d(-48px, 0, 0);
}
.mobile-nav-pop-leave-to {
  opacity: 0;
  transform: translate3d(32px, 0, 0);
}

/* =========================================================
   🌟 桌面端：文章切换非线性浮现动效 (Float & Cross-Fade)
   ========================================================= */
.desktop-article-swap-enter-active,
.desktop-article-swap-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
  will-change: transform, opacity;
}

.desktop-article-swap-enter-from {
  opacity: 0;
  transform: translate3d(0, 16px, 0) scale(0.98);
}
.desktop-article-swap-leave-to {
  opacity: 0;
  transform: translate3d(0, -10px, 0) scale(0.99);
}
</style>