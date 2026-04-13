import {createRouter, createWebHashHistory, RouteRecordRaw} from 'vue-router';
import MainContent from '@/views/MainContent.vue';
import BookMark from '@/views/BookMark.vue';
import Experiment from '@/views/Experiment.vue';
import AboutView from '@/views/AboutView.vue';

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
  },
  {
    path: '/about',
    name: 'About',
    component: AboutView
  },
  {
    path: '/experiment',
    name: 'Experiment',
    component: Experiment
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;