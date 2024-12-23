import {createRouter, createWebHashHistory, RouteRecordRaw} from 'vue-router';
import MainContent from '../components/MainContent.vue';
import BookMark from '../components/BookMark.vue';
import Experiment from '../components/Experiment.vue';

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