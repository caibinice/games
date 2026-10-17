<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps({ id: String, title: String });
const emit = defineEmits(['close']);
const modal = ref();
let previous;
function keyboard(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
  if (e.key === 'Tab') {
    const all = [...modal.value.querySelectorAll('button:not(:disabled),input,select,a[href]')];
    if (!all.length) return;
    const first = all[0],
      last = all.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
onMounted(() => {
  previous = document.activeElement;
  modal.value.querySelector('button,input')?.focus();
  document.addEventListener('keydown', keyboard, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keyboard, true);
  previous?.focus?.({ preventScroll: true });
});
</script>
<template>
  <div class="game-modal-backdrop" @click.self="emit('close')">
    <dialog ref="modal" open class="modal" :id="id" aria-modal="true" :aria-label="title">
      <button class="close" :data-close="id" aria-label="关闭" @click="emit('close')">×</button
      ><span class="eyebrow">FISH'S PLAYGROUND</span>
      <h2>{{ title }}</h2>
      <slot />
    </dialog>
  </div>
</template>
<style>
.game-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  background: #03070bd9;
  padding: 14px;
}
.game-modal-backdrop > .modal {
  position: relative;
  inset: auto;
  display: block;
  margin: 0;
  width: min(520px, 100%);
  max-width: 100%;
  max-height: calc(100% - 12px);
  overflow: auto;
  color: var(--ink, #e4f1ff);
  background: var(--panel, #162436);
  border: 1px solid var(--line, #3e5265);
  padding: 26px;
  border-radius: 8px;
}
.game-modal-backdrop h2 {
  padding-right: 30px;
}
.game-modal-backdrop .close {
  position: absolute;
  right: 14px;
  top: 14px;
}
.game-modal-backdrop .dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 18px;
}
.game-modal-backdrop .cheat-options {
  display: grid;
  gap: 8px;
}
.game-modal-backdrop .cheat-option {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.game-modal-backdrop .cheat-option input {
  width: 21px;
  height: 21px;
  flex: 0 0 21px;
  accent-color: var(--accent, #85e7cc);
}
.game-modal-backdrop .cheat-option strong {
  font-size: 14px;
  display: block;
}
.game-modal-backdrop .cheat-option small {
  display: block;
  font-size: 11px;
  color: var(--muted, #8eacc3);
  line-height: 1.7;
  margin-top: 4px;
}
@media (max-height: 450px) {
  .game-modal-backdrop > .modal {
    padding: 17px 22px;
  }
  .game-modal-backdrop .cheat-options {
    grid-template-columns: 1fr 1fr;
  }
  .game-modal-backdrop .cheat-option {
    padding: 7px;
  }
  .game-modal-backdrop .cheat-option small {
    font-size: 10px;
  }
  .game-modal-backdrop p {
    margin: 8px 0;
    font-size: 11px;
  }
}
</style>
