import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'
import { createPinia } from 'pinia'

const app = createApp(App)


// 注入路由
app.use(router)
app.use(createPinia())

// 挂载至 index.html 的 #app 根节点
app.mount('#app')