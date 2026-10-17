<script setup>
import { ref, onErrorCaptured } from 'vue';
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
  <RouterView v-else :key="$route.path" />
</template>
<style>
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
