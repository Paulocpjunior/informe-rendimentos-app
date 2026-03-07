const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte');
  await page.click('#optionPF');
  await page.waitForTimeout(2000);
  const dataNascimentoId = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const birthLabel = labels.find(l => l.textContent.includes('Data de Nascimento'));
    return birthLabel ? birthLabel.getAttribute('for') : 'Not found';
  });
  console.log('ID do campo Data de Nascimento:', dataNascimentoId);
  await browser.close();
})();
