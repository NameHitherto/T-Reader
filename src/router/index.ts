import {createRouter, createWebHashHistory, RouteRecordRaw} from 'vue-router';
import MainContent from '../components/MainContent.vue';
import BookMark from '../components/BookMark.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: MainContent
  },
  {
    path: '/bookmark',
    name: 'Bookmark',
    component: BookMark
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;