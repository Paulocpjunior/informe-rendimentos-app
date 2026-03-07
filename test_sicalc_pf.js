const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte');
  await page.click('#optionPF');
  console.log('PF clicked');
  await page.waitForTimeout(2000);
  const html = await page.content();
  if (html.includes('dataNascimento')) console.log('dataNascimento found');
  if (html.includes('dtNascimento')) console.log('dtNascimento found');
  console.log(html.substring(html.indexOf('Nascimento') - 100, html.indexOf('Nascimento') + 200));
  await browser.close();
})();
