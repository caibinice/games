<script setup>
defineProps({ type: String });
const shapes = {
  energy: 'M9 12h20v21H9z M16 12V6h10v6 M9 12 6 7l5-2 5 7 M15 21h8m-4-4v12',
  reverse:
    'M9 17 5 4l11 8M25 12 36 4l-4 14M10 14q10-9 21 0v13q-11 11-21 0z M12 20l5 2m11-2-5 2M16 29h8',
  fullSpeed: 'M23 3 8 23h11l-3 15 18-24H23z',
  ghost: 'M20 3 9 19l11 18 11-18z M9 19h22M20 3v34 M3 13l3-3m27 21 4-4',
  repair: 'M5 14h30v21H5z M14 14V7h12v7 M20 19v11m-6-5h12',
};
</script>
<template>
  <svg viewBox="0 0 40 40" class="pickup-icon" :data-pickup-icon="type" aria-hidden="true">
    <path
      :d="shapes[type]"
      fill="currentColor"
      fill-opacity=".16"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
<style>
.pickup-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  filter: drop-shadow(0 0 5px currentColor);
}
.help-items .pickup-icon {
  width: 27px;
  height: 27px;
  vertical-align: middle;
  margin-right: 7px;
}
</style>
