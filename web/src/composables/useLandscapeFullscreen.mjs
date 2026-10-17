import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
export function useLandscapeFullscreen(mobile = false) {
  const active = ref(false),
    native = ref(false),
    width = ref(innerWidth),
    height = ref(innerHeight),
    message = ref('');
  let busy = false,
    disposed = false;
  const rotated = computed(() => mobile && active.value && height.value > width.value);
  const viewport = computed(() => ({
    width: rotated.value ? height.value : width.value,
    height: rotated.value ? width.value : height.value,
  }));
  function resize() {
    width.value = window.visualViewport?.width || innerWidth;
    height.value = window.visualViewport?.height || innerHeight;
  }
  async function enter() {
    if (busy || active.value) return;
    busy = true;
    active.value = true;
    document.body.classList.add('immersive');
    try {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {}
      if (disposed) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        return;
      }
      native.value = !!document.fullscreenElement;
      if (mobile)
        try {
          await screen.orientation?.lock?.('landscape');
        } catch {}
      if (disposed) {
        try {
          screen.orientation?.unlock?.();
        } catch {}
        return;
      }
      resize();
      message.value = native.value ? '已进入全屏横屏布局' : '已进入窗口内横屏沉浸模式';
    } finally {
      busy = false;
    }
  }
  async function exit() {
    if (busy) return;
    busy = true;
    active.value = false;
    document.body.classList.remove('immersive');
    try {
      screen.orientation?.unlock?.();
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
    } finally {
      native.value = false;
      busy = false;
      resize();
    }
  }
  function changed() {
    if (native.value && !document.fullscreenElement) {
      active.value = false;
      native.value = false;
      document.body.classList.remove('immersive');
      try {
        screen.orientation?.unlock?.();
      } catch {}
    } else if (document.fullscreenElement) native.value = true;
    resize();
  }
  onMounted(() => {
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', changed);
    resize();
  });
  onBeforeUnmount(() => {
    disposed = true;
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
    document.removeEventListener('fullscreenchange', changed);
    document.body.classList.remove('immersive');
    try {
      screen.orientation?.unlock?.();
    } catch {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });
  return {
    active,
    native,
    rotated,
    viewport,
    message,
    enter,
    exit,
    toggle: () => (active.value ? exit() : enter()),
  };
}
