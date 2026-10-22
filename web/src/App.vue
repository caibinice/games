<script setup>
import { ref, onErrorCaptured } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const failure = ref('');
onErrorCaptured((error) => {
  failure.value = error.message;
  return false;
});
const reload = () => window.location.reload();
</script>
<template>
  <section v-if="failure" class="app-error" role="alert">
    <h1>页面暂时没有准备好</h1>
    <p>{{ failure }}</p>
    <a href="/games/">返回游戏大厅</a><button @click="reload">重新载入</button>
  </section>
  <template v-else
    ><RouterView :key="$route.path" /><a
      v-if="
        ['tank', 'contra', 'paopaotang', 'lianliankan'].includes(route.meta.game) &&
        !route.path.endsWith('/online.html')
      "
      class="online-entry"
      :href="'/games/' + route.meta.game + '/online.html'"
      data-online-entry
      >双人联机 · 匹配 / 开房 ↗</a
    ></template
  >
</template>
<style>
.online-entry {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 70;
  padding: 13px 19px;
  border: 1px solid #d7f6d8a0;
  border-radius: 14px;
  background: #1b4038ed;
  color: #dcf6da !important;
  text-decoration: none;
  font: 600 13px/1.4 system-ui;
  box-shadow: 0 8px 35px #0004;
}
body.immersive .online-entry {
  display: none;
}
@media (max-width: 600px) {
  .online-entry {
    right: 12px;
    bottom: 12px;
    padding: 10px 14px;
    font-size: 12px;
  }
}

.app-error {
  padding: 40px;
  font: 16px/1.8 system-ui;
  background: #121a25;
  color: #fff;
  min-height: 100dvh;
}
.app-error a {
  color: #8ce9ca;
}
</style>
