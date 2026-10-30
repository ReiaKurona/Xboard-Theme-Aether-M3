import { createRouter, createWebHashHistory } from 'vue-router'
import { loadingBar } from '../utils/loadingBar'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/auth/AuthView.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/',
    component: () => import('../layouts/DashboardLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/dashboard/Home.vue')
      },
      // 🌟 正确：作为 DashboardLayout 的子路由放入 children 内部
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/profile/Index.vue')
      },
      {
        path: 'plan',
        name: 'Plan',
        component: () => import('../views/plan/Index.vue')
      },
      {
        path: 'order',
        name: 'OrderList',
        component: () => import('../views/order/Index.vue')
      },
      {
        path: 'order/:trade_no',
        name: 'OrderDetail',
        component: () => import('../views/order/Detail.vue')
      },
      // 在 DashboardLayout 的 children 数组内确认：
      {
        path: 'servers',
        name: 'Servers',
        component: () => import('../views/servers/Index.vue')
      },
      // 在 DashboardLayout 的 children 数组内追加：
      {
        path: 'knowledge',
        name: 'Knowledge',
        component: () => import('../views/knowledge/Index.vue')
      },
      // 在 DashboardLayout 的 children 数组内确认或追加：
      {
        path: 'tickets',
        name: 'Tickets',
        component: () => import('../views/tickets/Index.vue')
      },
      // 确认在 DashboardLayout 的 children 数组内有：
      {
        path: 'invite',
        name: 'Invite',
        component: () => import('../views/invite/Index.vue')
      },
      // 在 DashboardLayout 的 children 数组内追加：
      {
        path: 'download',
        name: 'DownloadCenter',
        component: () => import('../views/download/Index.vue')
      },
      // 在 DashboardLayout 的 children 数组内追加：
      {
        path: 'activities',
        name: 'Activities',
        component: () => import('../views/activities/Index.vue')
      }
    ]
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 🌟 1. 路由开始切换：立刻拉起进度条流光与粒子
// 🌟 升级为 Vue Router 4+ 标准规范，消除控制台 [VUE_ROUTER_R0025] 黄色警告
router.beforeEach((to, _from) => {
  loadingBar.start()

  const token = localStorage.getItem('auth_data')
  if (to.meta.requiresAuth && !token) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && token) {
    return { name: 'Dashboard' }
  }
  return true
})

// 🌟 2. 路由渲染就绪：瞬间冲刺至 100% 触发粒子星芒爆裂并渐隐
router.afterEach(() => {
  loadingBar.finish()
})

// 🌟 3. 路由异常兜底
router.onError(() => {
  loadingBar.fail()
})