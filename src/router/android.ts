import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import MainPage from '../android/Main.vue';
import AndroidReader from '../android/Reader.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: MainPage
  },
  {
    path: '/reader/:bookId',
    name: 'AndroidReader',
    component: AndroidReader,
    props: true
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;