<script setup>
import { ref, onMounted } from 'vue';
const games = ref([]),
  failed = ref(false);
onMounted(async () => {
  try {
    const r = await fetch('/games/catalog.json');
    if (!r.ok) throw Error('catalog');
    games.value = await r.json();
  } catch {
    failed.value = true;
  }
});
</script>
<template>
  <main>
    <a class="back" href="/">← Fish 的小站</a
    ><span class="eyebrow">A LITTLE BREAK, A LOT OF JOY</span>
    <h1>今天，玩点什么？<span>✦</span></h1>
    <p>给忙碌的生活，留一点好玩的空隙。</p>
    <section id="games" aria-label="选择游戏">
      <a
        v-for="game in games"
        :key="game.id"
        class="game"
        :href="game.base"
        :style="{ '--accent': game.color }"
        ><span class="art">{{ game.symbol }}</span>
        <h2>{{ game.name }}</h2>
        <p>{{ game.description }}</p>
        <span class="arrow">开始玩 ↗</span></a
      >
      <p v-if="failed" role="alert">游戏列表暂未加载，刷新再试。</p>
    </section>
    <footer>
      手机也能玩 · 无广告 · 进度只留在你的设备<br /><small>FISH'S PLAYGROUND · VUE 3</small>
    </footer>
  </main>
</template>
