import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import MainContent from '@/views/MainContent.vue'
import BookMark from '@/views/BookMark.vue'
import CloudSyncView from '@/views/CloudSyncView.vue'
import SettingsView from '@/views/SettingsView.vue'
import AboutView from '@/views/AboutView.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: MainContent,
    meta: { title: '书架' },
  },
  {
    path: '/bookmark',
    name: 'Bookmark',
    component: BookMark,
    meta: { title: '笔记' },
  },
  {
    path: '/sync',
    name: 'Sync',
    component: CloudSyncView,
    meta: { title: '云同步' },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { title: '设置' },
  },
  {
    path: '/about',
    name: 'About',
    component: AboutView,
    meta: { title: '关于' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
