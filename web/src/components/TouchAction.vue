<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
const props = defineProps({ action: String, label: String, disabled: Boolean, small: Boolean });
const emit = defineEmits(['change']);
const pressed = ref(false);
let pointer = null;
function down(e) {
  if (props.disabled || pointer !== null) return;
  e.preventDefault();
  pointer = e.pointerId;
  e.currentTarget.setPointerCapture(pointer);
  pressed.value = true;
  emit('change', true);
}
function up(e) {
  if (e && e.pointerId !== pointer) return;
  pointer = null;
  pressed.value = false;
  emit('change', false);
}
onBeforeUnmount(() => up());
watch(
  () => props.disabled,
  (v) => {
    if (v) up();
  },
);
</script>
<template>
  <button
    class="floating-action"
    :class="{ pressed, small }"
    :data-input="action"
    :aria-label="label"
    :disabled="disabled"
    @pointerdown="down"
    @pointerup="up"
    @pointercancel="up"
    @lostpointercapture="up"
  >
    <span>{{ label }}</span
    ><small>{{
      action === 'jump'
        ? 'K / Space'
        : action === 'jet'
          ? 'Space'
          : action === 'boost'
            ? 'Shift'
            : 'J'
    }}</small>
  </button>
</template>
<style>
.floating-action {
  position: absolute;
  z-index: 24;
  right: max(24px, env(safe-area-inset-right));
  bottom: max(30px, env(safe-area-inset-bottom));
  width: 86px;
  height: 86px;
  border-radius: 50%;
  padding: 0;
  border: 3px solid #d0f1ff80;
  background: radial-gradient(circle at 30% 20%, #94b5c888, #1c314c99);
  box-shadow:
    0 5px 20px #0005,
    inset 0 0 18px #fff2;
  color: white;
  touch-action: none;
  user-select: none;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 5px;
  font-size: 16px;
  letter-spacing: 1px;
}
.floating-action.small {
  width: 66px;
  height: 66px;
  right: 126px;
  bottom: 27px;
  border-color: #cae4b67d;
  background: radial-gradient(circle at 20% 20%, #74956d88, #263d3b99);
  font-size: 13px;
}
.floating-action small {
  font: 8px monospace;
  opacity: 0.6;
}
.floating-action.pressed {
  background: #c8efffc4;
  color: #102434;
  box-shadow: 0 0 24px #9decff88;
  transform: scale(0.96);
}
body:not(.immersive) .floating-action {
  position: fixed;
  bottom: 30px;
}
body:not(.immersive) .floating-action.small {
  bottom: 30px;
}
.floating-action:disabled {
  opacity: 0.4;
}
</style>
