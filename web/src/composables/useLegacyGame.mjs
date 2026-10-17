import { onMounted, onBeforeUnmount } from 'vue';
import { createRuntimeScope } from './runtimeScope.mjs';
export function useLegacyGame(id) {
  const scope = createRuntimeScope();
  onMounted(async () => {
    try {
      const runtime = await import(/* @vite-ignore */ `/games/${id}/runtime.mjs`);
      if (!scope.disposed) runtime.mountGame(scope);
    } catch (error) {
      console.error(error);
      document.querySelector('#vue-root')?.setAttribute('data-runtime-error', error.message);
    }
  });
  onBeforeUnmount(() => scope.dispose());
  return scope;
}
