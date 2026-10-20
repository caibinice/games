<script setup>
import { ref, watch } from 'vue';
import { JET_COOLDOWN, JET_COST } from '../../../games/racer/public/engine.mjs';
const props = defineProps({
  disabled: Boolean,
  cooldown: Number,
  energy: Number,
  airborne: Boolean,
  nitro: Boolean,
  forced: Number,
  reverse: Number,
});
const emit = defineEmits(['lane', 'jet', 'boost']);
const pressed = ref('');
function action(name, stamp = performance.now()) {
  if (props.disabled) return;
  if (name === 'left' || name === 'right') emit('lane', name === 'left' ? -1 : 1, stamp);
  else emit(name);
}
function down(e, name) {
  e.preventDefault();
  if (props.disabled) return;
  pressed.value = name;
  action(name, e.timeStamp);
  e.currentTarget.setPointerCapture(e.pointerId);
}
function release() {
  pressed.value = '';
}
function click(e, name) {
  if (e.detail === 0) action(name, e.timeStamp);
}
watch(
  () => props.disabled,
  () => release(),
);
</script>
<template>
  <div class="lane-pad" :class="{ reversed: reverse > 0 }" aria-label="左右换道">
    <span>{{ reverse > 0 ? '方向颠倒 ' + reverse.toFixed(1) + 's' : '点击换一格' }}</span>
    <button
      type="button"
      data-lane="left"
      aria-label="向左换道一格"
      :disabled="disabled"
      :class="{ pressed: pressed === 'left' }"
      @pointerdown="down($event, 'left')"
      @pointerup="release"
      @pointercancel="release"
      @lostpointercapture="release"
      @click="click($event, 'left')"
    >
      <b>←</b><small>左</small>
    </button>
    <button
      type="button"
      data-lane="right"
      aria-label="向右换道一格"
      :disabled="disabled"
      :class="{ pressed: pressed === 'right' }"
      @pointerdown="down($event, 'right')"
      @pointerup="release"
      @pointercancel="release"
      @lostpointercapture="release"
      @click="click($event, 'right')"
    >
      <b>→</b><small>右</small>
    </button>
  </div>
  <button
    type="button"
    class="racer-skill jet-skill"
    data-input="jet"
    aria-label="喷气腾跃"
    :disabled="disabled"
    :aria-disabled="airborne || cooldown > 0 || energy < JET_COST"
    :class="{ cooling: cooldown > 0, pressed: pressed === 'jet' }"
    :style="{ '--cooldown-angle': Math.max(0, Math.min(1, cooldown / JET_COOLDOWN)) * 360 + 'deg' }"
    @pointerdown="down($event, 'jet')"
    @pointerup="release"
    @pointercancel="release"
    @lostpointercapture="release"
    @click="click($event, 'jet')"
  >
    <strong data-jet-countdown>{{
      cooldown > 0 ? cooldown.toFixed(1) + 's' : energy < JET_COST ? '缺能量' : '↑'
    }}</strong
    ><span>{{ airborne ? '腾空中' : '喷气腾跃' }}</span
    ><small>{{
      cooldown > 0 ? '冷却中' : energy < JET_COST ? '需要 ' + JET_COST + '%' : '点击起跳'
    }}</small>
  </button>
  <button
    type="button"
    class="racer-skill boost-skill"
    data-input="boost"
    :disabled="disabled"
    :aria-pressed="nitro || forced > 0"
    aria-label="切换氮气加速"
    :class="{ enabled: nitro || forced > 0, locked: forced > 0, pressed: pressed === 'boost' }"
    @pointerdown="down($event, 'boost')"
    @pointerup="release"
    @pointercancel="release"
    @lostpointercapture="release"
    @click="click($event, 'boost')"
  >
    <strong>{{ forced > 0 ? forced.toFixed(1) + 's' : 'N₂' }}</strong
    ><span>{{ forced > 0 ? '全速锁定' : nitro ? '氮气 开' : '氮气 关' }}</span
    ><small>{{ forced > 0 ? '免费加速' : nitro ? '再点关闭' : '点击开启' }}</small>
  </button>
</template>
<style>
.lane-pad {
  position: absolute;
  z-index: 24;
  left: max(20px, env(safe-area-inset-left));
  bottom: max(24px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: 96px 96px;
  gap: 10px;
  touch-action: none;
  user-select: none;
}
.lane-pad > span {
  grid-column: 1/-1;
  text-align: center;
  font-size: 11px;
  color: #e0f5ed;
  letter-spacing: 1px;
  text-shadow: 0 1px 5px #0009;
}
.lane-pad > button {
  height: 90px;
  width: 96px;
  border-radius: 21px;
  border: 2px solid #dcfff780;
  background: linear-gradient(155deg, #a4c9d05c, #173b424f);
  box-shadow:
    inset 0 0 20px #b2e8e620,
    0 4px 15px #0004;
  color: white;
  display: grid;
  place-content: center;
  gap: 1px;
  padding: 0;
  touch-action: none;
}
.lane-pad b {
  font: 44px/1 system-ui;
}
.lane-pad small {
  font-size: 11px;
  opacity: 0.8;
}
.lane-pad.reversed > span {
  color: #e0bdff;
}
.lane-pad.reversed > button {
  border-color: #bd8ceeb0;
  background: linear-gradient(155deg, #a07cc065, #27244970);
}
.lane-pad > button.pressed {
  background: #b9eee8b8;
  color: #173b3b;
  transform: scale(0.98);
}
.lane-pad > button:disabled {
  opacity: 0.4;
}
.racer-skill {
  position: absolute;
  z-index: 24;
  bottom: max(23px, env(safe-area-inset-bottom));
  right: max(21px, env(safe-area-inset-right));
  width: 92px;
  height: 92px;
  border: 2px solid #dbfff2a1;
  border-radius: 50%;
  padding: 8px 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 3px;
  touch-action: none;
  user-select: none;
  background: radial-gradient(circle at 30% 20%, #a2d7dcaa, #17393caa);
  color: #fff;
  box-shadow:
    0 5px 20px #0005,
    inset 0 0 20px #d3fff32b;
}
.racer-skill strong {
  font: 23px/1 monospace;
}
.racer-skill span {
  font-size: 12px;
}
.racer-skill small {
  font-size: 8px;
  opacity: 0.72;
}
.jet-skill.cooling {
  border-color: #e4c78b;
  background: conic-gradient(#d5b77199 var(--cooldown-angle), #294b4fbb var(--cooldown-angle));
  color: #fff4da;
}
.jet-skill.cooling strong {
  font-size: 22px;
}
.boost-skill {
  width: 75px;
  height: 75px;
  right: 129px;
  bottom: 24px;
  background: #223a4f8c;
  border-color: #a7c4d770;
  gap: 2px;
}
.boost-skill strong {
  font-size: 20px;
}
.boost-skill span {
  font-size: 10px;
}
.boost-skill small {
  font-size: 7px;
}
.boost-skill.enabled {
  border-color: #e0e6a5;
  background: radial-gradient(circle, #9fb573bf, #354930bf);
  box-shadow: 0 0 24px #a9e69a44;
}
.boost-skill.locked {
  border-color: #ffdb8a;
  background: radial-gradient(circle, #bb9041b8, #63432cbd);
}
.racer-skill.pressed {
  transform: scale(0.96);
}
.racer-skill:disabled {
  opacity: 0.4;
}
body:not(.immersive) .lane-pad,
body:not(.immersive) .racer-skill {
  position: fixed;
}
.racer-shell.compact.play-full .lane-pad {
  bottom: 16px;
  grid-template-columns: 86px 86px;
  gap: 8px;
}
.racer-shell.compact.play-full .lane-pad > button {
  width: 86px;
  height: 80px;
}
.racer-shell.compact.play-full .racer-skill {
  bottom: 17px;
  width: 84px;
  height: 84px;
}
.racer-shell.compact.play-full .boost-skill {
  width: 68px;
  height: 68px;
  right: 119px;
}
@media (max-height: 360px) {
  .lane-pad {
    bottom: 16px;
    grid-template-columns: 86px 86px;
    gap: 8px;
  }
  .lane-pad > button {
    width: 86px;
    height: 80px;
  }
  .racer-skill {
    bottom: 17px;
    width: 84px;
    height: 84px;
  }
  .boost-skill {
    width: 68px;
    height: 68px;
    right: 119px;
  }
}
</style>
