import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { skinPanel } from '../public/growth-ui.mjs';
import { createMeta } from '../public/progression.mjs';
import {
  ensureNative,
  nativeSupply,
  upgradeNativeSkin,
  equipNativeSkin,
} from '../public/native-progression.mjs';
describe('observed native full-screen form page', () => {
  it('uses independent room art and a dedicated dynamic-model canvas, not a whole screenshot', () => {
    const html = skinPanel(createMeta(), 2, 82001);
    expect(html).toContain('data-native-form="82001"');
    expect(html).toContain('native-form-footer');
    expect(html).toContain('返回核心');
    expect(html).toContain('炫彩幻形页面待迁移');
    expect(html).toContain('幻技页面待迁移');
    expect(html).not.toContain('original-ui');
    const css = readFileSync(new URL('../public/ui.css', import.meta.url), 'utf8');
    expect(css).toContain('.overlay[data-kind="form"]{padding:0');
    expect(css).toContain('zmzg_hx_bg.webp');
  });
  it('sorts owned forms first and exposes real equip/unset/star actions with source costs', () => {
    const p = createMeta();
    nativeSupply(p);
    upgradeNativeSkin(p, 82004);
    equipNativeSkin(p, 82004);
    const html = skinPanel(p, 2, 82004),
      carousel = html.slice(html.indexOf('aria-label="幻形列表"'));
    expect(carousel.indexOf('data-growth-skin-view="82004"')).toBeLessThan(
      carousel.indexOf('data-growth-skin-view="82001"'),
    );
    expect(html).toContain('data-growth-skin-unset="82004"');
    expect(html).toContain('data-growth-skin-up="82004"');
    expect(ensureNative(p).skinSlots[2]).toBe(82004);
  });
  it('disposes a modal preview before replacing or closing the modal', () => {
    const app = readFileSync(new URL('../public/original-app.mjs', import.meta.url), 'utf8');
    expect(app).toMatch(/function modal\([\s\S]*?\)\s*\{\s*clearNativeForm\(\)/);
    expect(app).toMatch(/clearNativeForm\(\);\s*const was\s*=\s*resumeOnClose/);
  });
});
