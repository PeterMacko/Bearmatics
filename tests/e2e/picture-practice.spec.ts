import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const [width, height] of [[320,568],[360,640],[390,844],[568,320],[1024,600],[1366,768],[1920,1080]]) for (const lang of ['en','sk']) {
  test(`picture practice fits ${width}x${height} ${lang}`, async ({ page }, info) => {
    await page.setViewportSize({width,height});
    await page.addInitScript(() => Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5}));
    const errors: string[] = []; page.on('pageerror', e=>errors.push(e.message));
    await page.goto('/');
    if(lang==='sk') { await page.locator('.settings-button').click(); await page.getByRole('button',{name:'Slovenčina'}).click(); await page.keyboard.press('Escape'); }
    await expect(page.locator('.level-option')).toHaveCount(8);
    for(const card of await page.locator('.level-option').all()) { await card.scrollIntoViewIfNeeded(); await expect(card).toBeInViewport(); const box=(await card.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); }
    await page.locator('input[name=level][value="0"]').check(); await page.locator('.start-button').click();
    await expect(page.getByRole('textbox')).toHaveAttribute('readonly','');
    for (const target of await page.locator('.number-pad button, .answer-button, .hint-button, input[type=text], .corner-button').all()) {
      const b = (await target.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
    }
    for (const pip of await page.locator('[data-picture-pip]').all()) {
      const b=(await pip.boundingBox())!; expect(b.width).toBeGreaterThanOrEqual(20); expect(b.height).toBeGreaterThanOrEqual(20);
    }
    const boxes: Record<string, unknown> = {};
    for(const s of ['.bear','.equation','.number-pad','.answer-button','.hint-button']) {
      const b=(await page.locator(s).boundingBox())!; boxes[s]=b;
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x+b.width).toBeLessThanOrEqual(width+1); expect(b.y+b.height).toBeLessThanOrEqual(height+1);
    }
    boxes.terms=await page.locator('[data-term]').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().toJSON()));
    for(let i=0;i<3;i++) {
      const group=(await page.locator('.picture-group').nth(i).boundingBox())!;
      const term=(await page.locator('[data-term]').nth(i).boundingBox())!;
      expect(Math.abs(group.x+group.width/2-term.x-term.width/2)).toBeLessThan(2);
      expect(group.y).toBeGreaterThanOrEqual(term.y+term.height);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('.picture-unknown svg')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('practice.png'),fullPage:true});
    await writeFile(info.outputPath('geometry.json'),JSON.stringify(boxes,null,2));
    expect(errors).toEqual([]);
  });
}
