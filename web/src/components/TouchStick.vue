<script setup>
import { ref, reactive, watch, onBeforeUnmount } from 'vue';
const props = defineProps({ rotated: Boolean, fourWay: Boolean, disabled: Boolean });
const emit = defineEmits(['change']);
const zone = ref(),
  pressed = ref(false),
  base = reactive({ x: 82, y: 82 }),
  thumb = reactive({ x: 0, y: 0 });
let pointer = null;
function point(e) {
  const r = zone.value.getBoundingClientRect();
  return props.rotated
    ? { x: e.clientY - r.top, y: r.right - e.clientX }
    : { x: e.clientX - r.left, y: e.clientY - r.top };
}
function update(e) {
  const p = point(e),
    dx = p.x - base.x,
    dy = p.y - base.y,
    d = Math.hypot(dx, dy),
    limit = 44;
  thumb.x = dx * Math.min(1, limit / (d || 1));
  thumb.y = dy * Math.min(1, limit / (d || 1));
  let x = d > 9 ? dx / (d || 1) : 0,
    y = d > 9 ? dy / (d || 1) : 0;
  if (props.fourWay) {
    if (Math.abs(x) > Math.abs(y)) y = 0;
    else x = 0;
  }
  emit('change', { left: x < -0.35, right: x > 0.35, up: y < -0.35, down: y > 0.35 });
}
function down(e) {
  if (props.disabled || pointer !== null) return;
  e.preventDefault();
  pointer = e.pointerId;
  zone.value.setPointerCapture(pointer);
  const p = point(e);
  base.x = Math.max(55, Math.min(zone.value.clientWidth - 55, p.x));
  base.y = Math.max(55, Math.min(zone.value.clientHeight - 55, p.y));
  pressed.value = true;
  update(e);
}
function move(e) {
  if (e.pointerId === pointer) {
    e.preventDefault();
    update(e);
  }
}
function release(e) {
  if (e && e.pointerId !== pointer) return;
  pointer = null;
  pressed.value = false;
  thumb.x = thumb.y = 0;
  emit('change', {});
}
onBeforeUnmount(() => release());
watch(
  () => props.disabled,
  (v) => {
    if (v) release();
  },
);
</script>
<template>
  <div
    ref="zone"
    class="floating-stick-zone"
    data-joystick
    aria-label="移动摇杆"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="release"
    @pointercancel="release"
    @lostpointercapture="release"
  >
    <div
      class="floating-stick"
      :class="{ pressed }"
      :style="pressed ? { left: base.x + 'px', top: base.y + 'px' } : {}"
    >
      <span class="stick-directions">✥</span
      ><span
        class="stick-thumb"
        :style="{ transform: `translate(${thumb.x}px,${thumb.y}px)` }"
      ></span>
    </div>
    <small v-if="!pressed">拖动摇杆</small>
  </div>
</template>
<style>
.floating-stick-zone {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 39%;
  height: 66%;
  z-index: 22;
  touch-action: none;
  user-select: none;
}
.floating-stick {
  position: absolute;
  width: 110px;
  height: 110px;
  left: 82px;
  top: calc(100% - 84px);
  transform: translate(-50%, -50%);
  border: 2px solid #ffffff45;
  border-radius: 50%;
  background: radial-gradient(circle, #0a152025, #11212d45);
  box-shadow:
    inset 0 0 24px #fff1,
    0 3px 20px #0004;
  pointer-events: none;
  display: grid;
  place-items: center;
}
.stick-thumb {
  width: 49px;
  height: 49px;
  background: linear-gradient(145deg, #ffffff6b, #a2d8ed36);
  border: 2px solid #e1f7ff9c;
  box-shadow: 0 4px 12px #0005;
  border-radius: 50%;
}
.stick-directions {
  position: absolute;
  color: #ffffff30;
  font-size: 72px;
}
.floating-stick.pressed {
  border-color: #a7efffb3;
  background: #1d597542;
}
.floating-stick-zone > small {
  position: absolute;
  left: 57px;
  bottom: 12px;
  font-size: 10px;
  color: #d1edf8a6;
  pointer-events: none;
}
body:not(.immersive) .floating-stick-zone {
  height: 160px;
  width: 49%;
  position: fixed;
}
</style>
