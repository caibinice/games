import { resolveNativeLayout } from './native-layout.mjs';

export function bihaiSlots(page, height = 1334) {
  const nodes = resolveNativeLayout(page, { height }),
    parent = nodes.find((n) => n.name === 'm_itemNodeRoot'),
    byId = new Map(nodes.map((n) => [n.rectId, n]));
  return parent.children
    .map((id) => byId.get(id))
    .filter((n) => /^m_itemChildNode/.test(n.name))
    .map((frame, i) => ({
      cell: i + 1,
      frame,
      prize: nodes.find((n) => n.path === frame.path + '/m_tfRewardRoot'),
    }));
}

// The native UI samples highlight nodes without replacement per visual pass;
// that is separate from the server's prize selection and does not remove prizes.
export async function animateBihaiDraw(root, rows, skip = false) {
  if (skip || !root?.isConnected) return;
  const slots = [...root.querySelectorAll('[data-bihai-cell]')],
    target = rows.at(-1)?.slot;
  const clear = () => slots.forEach((n) => n.classList.remove('bihai-active'));
  try {
    for (let pass = 0; pass < 2; pass++) {
      const remaining = [...slots];
      while (remaining.length) {
        if (!root.isConnected) return;
        const index = Math.floor(Math.random() * remaining.length),
          node = remaining.splice(index, 1)[0];
        clear();
        node.classList.add('bihai-active');
        await new Promise((resolve) => setTimeout(resolve, 55 + pass * 25));
      }
    }
    clear();
    slots.find((n) => Number(n.dataset.bihaiCell) === target)?.classList.add('bihai-active');
    await new Promise((resolve) => setTimeout(resolve, 350));
  } finally {
    if (!root.isConnected) clear();
  }
}
