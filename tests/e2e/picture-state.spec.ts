import { expect, test } from '@playwright/test';

test('level zero keeps main results concealed and stable through hints locale orientation and mastery review', async ({ page }) => {
  await page.goto('/'); await page.locator('input[name=level][value="0"]').check();
  await page.getByRole('radio',{name:'5 exercises',exact:true}).check(); await page.locator('.start-button').click();
  const result=page.locator('.picture-group').nth(2);
  const missed: {equation:string|null;first:string;answer:number}[]=[];
  const answer=async()=>page.locator('[data-term]').evaluateAll(parts=>Number(parts[0].textContent)+Number(parts[1].textContent));
  const enter=async(value:string)=>page.getByRole('textbox').fill(value);
  for(let i=0;i<5;i++) {
    const expected=await answer();
    await expect(result).toHaveClass(/picture-unknown/); await expect(result.locator('svg')).toHaveCount(0);
    if(i===0||i===4) {
      missed.push({equation:await page.locator('.equation').getAttribute('aria-label'),first:await page.locator('.picture-group').first().evaluate(el => [...el.querySelectorAll('svg')].map(svg => svg.outerHTML).join('')),answer:expected});
      await enter('abc'); await page.locator('.answer-button').click(); await expect(result).toHaveClass(/picture-unknown/);
      await enter('99'); await page.locator('.answer-button').click(); await expect(result).toHaveClass(/picture-unknown/);
    }
    if(i===0) {
      await page.locator('.hint-button').click(); await page.getByRole('button',{name:'Show next hint'}).click();await page.getByRole('button',{name:'Show next hint'}).click();
      await expect(page.getByTestId('worked-solution')).toBeVisible();await page.keyboard.press('Escape');await expect(result).toHaveClass(/picture-unknown/);
      await enter('007'); const pictures=await page.locator('.picture-group').first().evaluate(el => [...el.querySelectorAll('svg')].map(svg => svg.outerHTML).join(''));
      await page.locator('.settings-button').click();await page.getByRole('button',{name:'Slovenčina'}).click();await page.keyboard.press('Escape');
      await expect(page.getByRole('textbox')).toHaveValue('007'); expect(await page.locator('.picture-group').first().evaluate(el => [...el.querySelectorAll('svg')].map(svg => svg.outerHTML).join(''))).toBe(pictures);
      await page.setViewportSize({width:568,height:320});await expect(result).toHaveAttribute('aria-label','Chýbajúci počet');
      await page.locator('.settings-button').click();await page.getByRole('button',{name:'English'}).click();await page.keyboard.press('Escape');await page.setViewportSize({width:1366,height:768});
    }
    await enter(String(expected));await page.locator('.answer-button').click();await expect(result).not.toHaveClass(/picture-unknown/);await expect(result.locator('svg')).toHaveCount(expected);
    await page.locator('.answer-button').click();
  }
  const fresh=async(index:number)=>{
    await expect(page.locator('.equation')).toHaveAttribute('aria-label',missed[index].equation!);
    expect(await page.locator('.picture-group').first().evaluate(el => [...el.querySelectorAll('svg')].map(svg => svg.outerHTML).join(''))).toBe(missed[index].first);
    await expect(result).toHaveClass(/picture-unknown/);await expect(page.getByRole('textbox')).toHaveValue('');
  };
  await fresh(0);await enter('99');await page.locator('.answer-button').click();await enter(String(missed[0].answer));await page.locator('.answer-button').click();await page.locator('.answer-button').click();
  await fresh(1);await enter(String(missed[1].answer));await page.locator('.answer-button').click();await page.locator('.answer-button').click();
  await fresh(0);await page.locator('.hint-button').click();await page.keyboard.press('Escape');await enter(String(missed[0].answer));await page.locator('.answer-button').click();await page.locator('.answer-button').click();
  await fresh(0);await enter('');await page.locator('.answer-button').click();await enter(String(missed[0].answer));await page.locator('.answer-button').click();await page.locator('.answer-button').click();
  await expect(page.locator('.summary')).toBeVisible();await expect(page.locator('.first-try')).toContainText('3 / 5');
});
