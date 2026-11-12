import { expect, test } from '@playwright/test';

for (const [width,height] of [[320,568],[568,320]]) for (const language of ['en','sk']) {
  test(`picture practice enlarged text remains scrollable ${width} ${language}`,async({page},info)=>{
    await page.setViewportSize({width,height});
    await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5}));
    await page.goto('/');
    if(language==='sk'){await page.locator('.settings-button').click();await page.getByRole('button',{name:'Slovenčina'}).click();await page.keyboard.press('Escape');}
    await page.locator('input[name=level][value="0"]').check();await page.locator('.start-button').click();
    const input=page.getByRole('textbox');await input.focus();await page.keyboard.type('12');
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for(const control of [input,page.locator('.answer-button'),page.locator('.hint-button')]){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();}
    await page.locator('.hint-button').click();
    const advance=page.getByRole('button',{name:language==='sk'?'Ďalšia pomôcka':'Show next hint'});await advance.click();await advance.click();
    await expect(page.getByTestId('worked-solution')).toBeVisible();
    await page.screenshot({path:info.outputPath('enlarged-hint.png')});
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(input).toHaveValue('12');await expect(page.locator('.picture-unknown')).toHaveCount(1);
    expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).not.toBe('hidden');
    await page.locator('.answer-button').scrollIntoViewIfNeeded();await expect(page.locator('.answer-button')).toBeInViewport();
  });
}
