/**
 * SicalcWeb Automation Bot
 * Usage: node sicalc_bot.js --cpf=82960712153 --code=3208 --period=12/2025 --value=550.00
 */
const { chromium } = require('playwright');

async function runSicalcBot() {
    const args = process.argv.slice(2).reduce((acc, arg) => {
        const [k, v] = arg.split('=');
        acc[k.replace('--', '')] = v;
        return acc;
    }, {});

    if (!args.cpf || !args.code || !args.period || !args.value) {
        console.error('Missing arguments! --cpf --code --period --value');
        process.exit(1);
    }

    const browser = await chromium.launch({ headless: false }); // Needs head for captcha
    const page = await browser.newPage();

    console.log('--- Iniciando SicalcWeb ---');
    await page.goto('https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte');

    // Passo 1: Identificação
    console.log('Preenchendo identificação...');
    await page.click('#optionPF');
    await page.fill('#cpfFormatado', args.cpf);

    console.log('\n⚠️  ATENÇÃO: Resolva o hCaptcha no navegador agora.');
    console.log('O script aguardará você clicar em "Continuar" após resolver o desafio.');

    // Aguarda o usuário avançar para a próxima tela manualmente
    await page.waitForSelector('#codigoReceita', { timeout: 0 });

    // Passo 2: Código da Receita
    console.log('Preenchendo Código da Receita...');
    await page.fill('#codigoReceita', args.code);
    await page.keyboard.press('Enter');

    // Passo 3: Dados do DARF
    console.log('Preenchendo valores...');
    await page.waitForSelector('#periodoApuracao');
    await page.fill('#periodoApuracao', args.period);
    await page.fill('#valorPrincipal', args.value);

    await page.click('button:has-text("Calcular")');

    // Passo 4: Emissão
    console.log('Finalizando emissão...');
    await page.waitForSelector('table.table-striped');
    await page.click('input[name="selecionarTudo"]'); // Seleciona o item calculado
    await page.click('button:has-text("Emitir DARF")');

    console.log('\n✅ DARF Gerado com Sucesso!');
    console.log('O download deve iniciar automaticamente.');

    // Aguarda um pouco antes de fechar
    await page.waitForTimeout(5000);
    await browser.close();
}

runSicalcBot().catch(err => {
    console.error('Erro no bot:', err);
    process.exit(1);
});
