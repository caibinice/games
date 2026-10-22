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
    <section class="lobby-online-links" aria-label="双人在线游戏">
      <h2>和朋友一起玩</h2>
      <p>快速匹配，或输入房间号加入。电脑和手机也能组队。</p>
      <nav>
        <a
          v-for="g in games.filter((g) =>
            ['tank', 'contra', 'paopaotang', 'lianliankan'].includes(g.id),
          )"
          :key="g.id"
          :href="g.base + 'online.html'"
          >{{ g.name }} · {{ g.id === 'lianliankan' ? '对战' : '合作' }} ↗</a
        >
      </nav>
    </section>
    <footer>
      手机也能玩 · 无广告 · 单机进度在本机，联机房间即时同步<br /><small
        >FISH'S PLAYGROUND · VUE 3</small
      >
    </footer>
  </main>
</template>

<style>
.lobby-online-links {
  margin-top: 32px;
  padding: 25px 28px;
  border: 1px solid #91ab9250;
  border-radius: 22px;
  background: #f6faf550;
}
.lobby-online-links h2 {
  font-size: 21px;
  margin: 0;
}
.lobby-online-links > p {
  font-size: 12px;
  margin: 9px 0 18px;
}
.lobby-online-links nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.lobby-online-links nav a {
  display: block;
  padding: 11px 17px;
  border: 1px solid #67897160;
  border-radius: 10px;
  color: #36583e;
  text-decoration: none;
  font-size: 12px;
  background: #ffffff80;
}
</style>
