const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte');
  await page.click('#optionPF');
  await page.waitForTimeout(2000);
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, name: i.name, type: i.type, placeholder: i.placeholder }));
  });
  console.log('Inputs:', inputs);
  await browser.close();
})();
