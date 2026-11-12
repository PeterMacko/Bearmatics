import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const language of ['en', 'sk']) for (const [width, height] of [[320,568], [438,628], [439,628], [754,655], [360,640], [390,844], [568,320], [844,390], [1024,400], [1024,600], [1366,768], [1920,1080], [620,640], [621,640], [950,640], [951,640]]) {
  test(`menu matrix ${language} ${width}x${height}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width, height }); await page.goto('/');
    if (language === 'sk') {
      await page.locator('.settings-button').click(); await page.getByRole('button', { name: 'Slovenčina' }).click(); await page.keyboard.press('Escape');
    }
    await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
    const list = page.locator('.level-options');
    const geometry = await page.evaluate(() => {
      const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right }; };
      const l = document.querySelector('.level-options')!;
      return { width:innerWidth, height:innerHeight, mode:document.querySelector('.workspace')!.getAttribute('data-menu-mode'),
        pageHeight:document.documentElement.scrollHeight, pageWidth:document.documentElement.scrollWidth,
        header:rect(document.querySelector('.menu-heading')!), bear:rect(document.querySelector('.companion')!),
        gear:rect(document.querySelector('.settings-button')!), footer:rect(document.querySelector('.menu-controls')!),
        list:{ ...rect(l), client:l.clientHeight, scroll:l.scrollHeight, top:l.scrollTop },
        cards:[...document.querySelectorAll('.level-option')].map(rect),
        targets:[...document.querySelectorAll('.session-options label, .start-button')].map(rect) };
    });
    await writeFile(testInfo.outputPath('geometry.json'), JSON.stringify(geometry, null, 2));
    await page.screenshot({ path:testInfo.outputPath('menu.png') });
    expect(geometry.pageHeight).toBeLessThanOrEqual(height);
    expect(geometry.pageWidth).toBeLessThanOrEqual(width);
    expect(geometry.header.y).toBeGreaterThanOrEqual(0);
    expect(geometry.header.bottom).toBeLessThanOrEqual(geometry.list.y);
    expect(geometry.footer.bottom).toBeLessThanOrEqual(height);
    expect(geometry.gear.width).toBeGreaterThanOrEqual(44);
    expect(geometry.gear.height).toBeGreaterThanOrEqual(44);
    expect(geometry.bear.right).toBeLessThanOrEqual(geometry.header.x);
    for (const target of [...geometry.cards, ...geometry.targets]) expect(target.height).toBeGreaterThanOrEqual(48);
    // No gratuitous overflow when the entire intrinsic grid has ample room.
    // A single column needs height as well as width; 1366x768 now legitimately scrolls.
    if (width >= 1366 && height >= 1000) expect(geometry.list.scroll).toBeLessThanOrEqual(geometry.list.client);
    const selected = await page.locator('input[name=level]:checked').inputValue();
    if (geometry.list.scroll > geometry.list.client) {
      await list.hover(); await page.mouse.wheel(0,2000);
      await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(geometry.list.top);
      expect(await page.locator('input[name=level]:checked').inputValue()).toBe(selected);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await list.hover(); await page.mouse.wheel(0,-2000);
      await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(0);
    }
    // Native arrow-key selection, focus reveal and Tab escape in DOM order.
    await page.locator('input[name=level]').first().evaluate(el => (el as HTMLInputElement).focus({ preventScroll:true }));
    for (let n=0;n<8;n++) {
      if (n) await page.keyboard.press('ArrowDown');
      const radio = page.locator('input[name=level]').nth(n);
      await expect(radio).toBeFocused();
      if (n) await expect(radio).toBeChecked();
      const box = (await page.locator('.level-option').nth(n).boundingBox())!;
      const bounds = (await list.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(bounds.y + 7);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height - 7);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      // Real visible text ranges must fit the card, not just its target box.
      const clipped = await page.locator('.level-option').nth(n).evaluate(el => {
        const box = el.getBoundingClientRect(); const walker = document.createTreeWalker(el,NodeFilter.SHOW_TEXT); const bad:string[]=[];
        while(walker.nextNode()) { if (!walker.currentNode.textContent?.trim()) continue; const r=document.createRange(); r.selectNodeContents(walker.currentNode);
          for(const t of r.getClientRects()) if(t.left<box.left-1||t.right>box.right+1||t.top<box.top-1||t.bottom>box.bottom+1) bad.push(walker.currentNode.textContent!); }
        return bad;
      });
      expect(clipped).toEqual([]);
    }
    await page.keyboard.press('Tab'); await expect(page.locator('input[name=size]:checked')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('.start-button')).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(page.locator('input[name=size]:checked')).toBeFocused();
    expect(errors).toEqual([]);
  });
}


test('selected level and count survive settings, locale, orientation and all composition boundaries', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:360,height:640 }); await page.goto('/');
  await page.locator('input[name=level]').last().check();
  await page.locator('input[name=size]').last().check();
  await page.locator('.settings-button').click();
  await expect(page.locator('.workspace')).toHaveAttribute('inert','');
  await expect(page.locator('.site-header')).toHaveAttribute('inert','');
  await page.getByRole('button',{ name:'Slovenčina' }).click();
  await page.keyboard.press('Escape'); await expect(page.locator('.settings-button')).toBeFocused();
  for(const [width,height] of [[568,320],[620,640],[621,640],[950,640],[951,640],[320,568],[390,844]]) {
    await page.setViewportSize({width,height});
    await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode','contained');
    await expect(page.locator('input[name=level]').last()).toBeChecked();
    await expect(page.locator('input[name=size]').last()).toBeChecked();
    await expect(page.locator('.level-option').last()).toBeInViewport({ratio:1});
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  await page.locator('.settings-button').click(); await page.getByRole('button',{name:'English'}).click();
  await page.keyboard.press('Escape'); await expect(page.locator('.settings-button')).toBeFocused();
  await page.locator('.start-button').click();
  await expect(page.locator('.exercise-position')).toHaveText('Exercise 1 of 20');
  await expect(page.locator('.level-pill')).toHaveText('Level 7');
  await expect(page.getByRole('heading',{name:'Bearmatics',level:1})).toHaveCount(1);
  await expect(page.locator('.brand-mark')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('preserved-practice.png')});
});

for (const language of ['en','sk']) for(const [width,height] of [[320,568],[568,320],[1024,600]]) {
  test(`menu root-text enlargement ${language} ${width}x${height}`, async ({page},testInfo) => {
    const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize({width,height}); await page.goto('/');
    if(language==='sk') { await page.locator('.settings-button').click(); await page.getByRole('button',{name:'Slovenčina'}).click(); await page.keyboard.press('Escape'); }
    await page.evaluate(()=>{ document.documentElement.style.fontSize='200%'; });
    // Wait for content-aware measurement, not an assumed enlargement breakpoint.
    await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
    const mode=await page.locator('.workspace').getAttribute('data-menu-mode');
    const data=await page.evaluate(()=>({ pageHeight:document.documentElement.scrollHeight, pageWidth:document.documentElement.scrollWidth,
      listClient:document.querySelector('.level-options')!.clientHeight,listScroll:document.querySelector('.level-options')!.scrollHeight }));
    await writeFile(testInfo.outputPath('enlarged-geometry.json'),JSON.stringify({width,height,language,mode,...data},null,2));
    expect(data.pageWidth).toBeLessThanOrEqual(width);
    if(mode==='flow') { expect(data.pageHeight).toBeGreaterThan(height); expect(data.listScroll-data.listClient).toBeLessThanOrEqual(1); }
    else { expect(data.pageHeight).toBeLessThanOrEqual(height); await expect(page.locator('.start-button')).toBeInViewport(); }
    for(const card of await page.locator('.level-option').all()) {
      await card.scrollIntoViewIfNeeded(); await expect(card).toBeInViewport();
      expect(await card.evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
      expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await page.locator('.start-button').scrollIntoViewIfNeeded(); await expect(page.locator('.start-button')).toBeInViewport();
    await page.screenshot({path:testInfo.outputPath('enlarged.png'),fullPage:true});
    await page.locator('.settings-button').click(); await page.keyboard.press('Escape');
    await expect(page.locator('.settings-button')).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('emulated touch drag scrolls only the level list without changing selection', async ({browser,browserName},testInfo) => {
  test.skip(browserName!=='chromium','CDP touch gesture is Chromium-only; Firefox wheel/keyboard covered separately');
  const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,baseURL:testInfo.project.use.baseURL});
  try {
    const page=await context.newPage(); await page.goto('/');
    expect(await page.evaluate(()=>navigator.maxTouchPoints)).toBeGreaterThan(0);
    const list=page.locator('.level-options'); const box=(await list.boundingBox())!;
    await list.evaluate(el=>{el.scrollTop=0;});
    const cdp=await context.newCDPSession(page);
    const x=box.x+box.width/2, y=box.y+box.height-20;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let n=1;n<=12;n++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-n*12}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>scrollY)).toBe(0);
    await expect(page.locator('input[name=level][value="1"]')).toBeChecked();
    await expect(page.locator('.start-button')).toBeInViewport();
    await page.screenshot({path:testInfo.outputPath('touch-drag.png')});
  } finally { await context.close(); }
});

test('native level radios accept pointer checks without label interception in both engines', async ({page}) => {
  await page.goto('/');
  for(const radio of await page.locator('input[name=level]').all()) {
    await radio.check({timeout:3000}); await expect(radio).toBeChecked();
  }
});

test('Slovak phone heading does not split a word to reserve the entire gear column', async ({ page }) => {
  await page.setViewportSize({ width:320, height:568 }); await page.goto('/');
  await page.locator('.settings-button').click(); await page.getByRole('button', { name:'Slovenčina' }).click(); await page.keyboard.press('Escape');
  const lines = await page.locator('.selection h2').evaluate(el => {
    const node=el.firstChild!; const text=node.textContent!; const range=document.createRange();
    range.setStart(node,text.indexOf('vyberieme')); range.setEnd(node,text.length); return range.getClientRects().length;
  });
  expect(lines).toBe(1);
});

test('impossible height uses readable document flow and recovers after resize and text change', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 180 }); await page.goto('/');
  await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'flow');
  const list = page.locator('.level-options');
  expect(await list.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  for (const option of await page.locator('.level-option').all()) {
    await option.scrollIntoViewIfNeeded(); await expect(option).toBeInViewport();
  }
  await page.locator('.start-button').scrollIntoViewIfNeeded();
  await expect(page.locator('.start-button')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(180);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'flow');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await expect(page.locator('.workspace')).toHaveAttribute('data-menu-mode', 'contained');
  await page.screenshot({ path: testInfo.outputPath('recovered.png') });
});

for (const [width, height] of [[320, 568], [1024, 400]]) {
  test(`only levels scroll at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    const list = page.locator('.level-options');
    const before = await list.evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, top: el.scrollTop, page: scrollY,
      heading: document.querySelector('.menu-heading')!.getBoundingClientRect().top,
      start: document.querySelector('.start-button')!.getBoundingClientRect().bottom }));
    await testInfo.attach('before', { body: JSON.stringify(before), contentType: 'application/json' });
    expect(before.start).toBeLessThanOrEqual(height);
    expect(before.scroll).toBeGreaterThan(before.client);
    await list.hover(); await page.mouse.wheel(0, 2000);
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(before.top);
    expect(await page.evaluate(() => scrollY)).toBe(before.page);
    expect(await page.locator('.menu-heading').evaluate(el => el.getBoundingClientRect().top)).toBe(before.heading);
    expect(await page.locator('.start-button').evaluate(el => el.getBoundingClientRect().bottom)).toBe(before.start);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
  });
}

test('phone bear sits left beside the heading without a vacant branding row', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const bear = (await page.locator('.companion').boundingBox())!;
  const heading = (await page.locator('.selection h2').boundingBox())!;
  const gear = (await page.locator('.settings-button').boundingBox())!;
  expect(bear.x + bear.width).toBeLessThanOrEqual(heading.x);
  expect(bear.y).toBeLessThan(heading.y + heading.height);
  expect(heading.y).toBeLessThan(bear.y + bear.height);
  expect(Math.min(bear.y, heading.y)).toBeLessThan(40);
  expect(gear.width).toBeGreaterThanOrEqual(44);
  expect(gear.height).toBeGreaterThanOrEqual(44);
  expect(heading.y).toBeGreaterThanOrEqual(gear.y + gear.height);
  await page.screenshot({ path: testInfo.outputPath('composition.png') });
});
