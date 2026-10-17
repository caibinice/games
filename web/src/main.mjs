import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
const routePages = {
  pindou: () => import('./pages/legacy/PindouPage.vue'),
  goose: () => import('./pages/legacy/GoosePage.vue'),
  lianliankan: {
    pc: () => import('./pages/legacy/LianliankanPcPage.vue'),
    mobile: () => import('./pages/legacy/LianliankanMobilePage.vue'),
  },
  paopaotang: {
    pc: () => import('./pages/legacy/PaopaotangPcPage.vue'),
    mobile: () => import('./pages/legacy/PaopaotangMobilePage.vue'),
  },
};
const mobile = () => matchMedia('(pointer:coarse)').matches || innerWidth < 760;
const routes = [
  { path: '/', component: () => import('./pages/LobbyPage.vue'), meta: { game: 'lobby' } },
];
for (const [id, pages] of Object.entries(routePages)) {
  if (typeof pages === 'function')
    routes.push({
      path: `/${id}/:file(index.html)?`,
      component: pages,
      meta: { game: id, platform: 'auto' },
    });
  else {
    routes.push(
      { path: `/${id}/`, redirect: () => `/${id}/${mobile() ? 'mobile' : 'pc'}.html` },
      { path: `/${id}/index.html`, redirect: () => `/${id}/${mobile() ? 'mobile' : 'pc'}.html` },
    );
    for (const platform of ['pc', 'mobile'])
      routes.push({
        path: `/${id}/${platform}.html`,
        component: pages[platform],
        meta: { game: id, platform },
      });
  }
}
for (const id of ['tank', 'contra', 'racer']) {
  routes.push(
    { path: `/${id}/`, redirect: () => `/${id}/${mobile() ? 'mobile' : 'pc'}.html` },
    { path: `/${id}/index.html`, redirect: () => `/${id}/${mobile() ? 'mobile' : 'pc'}.html` },
  );
  for (const platform of ['pc', 'mobile'])
    routes.push({
      path: `/${id}/${platform}.html`,
      component:
        id === 'racer'
          ? () => import('./pages/RacerPage.vue')
          : () => import('./pages/ClassicPage.vue'),
      props: { id, platform },
      meta: { game: id, platform },
    });
}
routes.push({ path: '/:pathMatch(.*)*', redirect: '/' });
const router = createRouter({ history: createWebHistory('/games/'), routes });
router.beforeEach((to) => {
  document.body.dataset.game = to.meta.game;
  document.body.dataset.platform = to.meta.platform || '';
  document.body.dataset.framework = 'vue3';
});
const app = createApp(App);
app.use(router);
router.isReady().then(() => {
  app.mount('#vue-root');
  document.querySelector('#vue-root').dataset.framework = 'vue3';
});
