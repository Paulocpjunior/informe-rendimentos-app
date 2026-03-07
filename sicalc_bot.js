/**
 * SicalcWeb Automation Bot (v2.1)
 * Este script automatiza o preenchimento no portal oficial SicalcWeb.
 * Requer: npm install playwright
 */

const fs = require('fs');
const path = require('path');

async function runSicalcBot() {
    let playwright;
    try {
        playwright = require('playwright');
    } catch (e) {
        console.error('\n❌ ERRO: Playwright não encontrado!');
        console.error('Por favor, execute: npm install playwright');
        console.error('E depois: npx playwright install chromium\n');
        process.exit(1);
    }

    const { chromium } = playwright;

    const args = process.argv.slice(2).reduce((acc, arg) => {
        const [k, v] = arg.split('=');
        if (k && v) acc[k.replace('--', '')] = v;
        return acc;
    }, {});

    if (!args.cpf || !args.code || !args.period || !args.value) {
        console.log('\nUso: node sicalc_bot.js --cpf=000.000.000-00 --code=3208 --period=01/2025 --value=1500.00');
        process.exit(1);
    }

    console.log('\n🚀 Iniciando Automação SicalcWeb...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    try {
        await page.goto('https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte');

        // PASSO 1 - Identificação
        console.log('🔹 Preenchendo CPF...');
        await page.click('#optionPF');
        await page.fill('#cpfFormatado', args.cpf);

        console.log('\n⚠️  Aguardando resolução do hCaptcha...');
        console.log('Resolva o desafio e o script continuará automaticamente assim que a página mudar.');

        // O hCaptcha redireciona para a página de código de receita. 
        // Esperamos o campo de código aparecer.
        await page.waitForSelector('#codigoReceita', { timeout: 0 });

        // PASSO 2 - Código da Receita
        console.log('🔹 Preenchendo Código da Receita:', args.code);
        await page.fill('#codigoReceita', args.code);
        await page.keyboard.press('Enter');

        // PASSO 3 - Dados do DARF
        console.log('🔹 Preenchendo Período e Valor...');
        await page.waitForSelector('#periodoApuracao');
        await page.fill('#periodoApuracao', args.period);
        await page.fill('#valorPrincipal', args.value);

        // Clica em Calcular
        await page.click('input[value="Calcular"], button:has-text("Calcular")');

        // PASSO 4 - Tabela de Resultados
        console.log('🔹 Processando Tabela de Resultados...');
        await page.waitForSelector('table.table-striped', { timeout: 20000 });

        // Seleciona a linha (checkbox)
        const checkbox = await page.locator('table input[type="checkbox"]').first();
        await checkbox.check();

        // PASSO 5 - Emissão e Download
        console.log('🔹 Emitindo DARF Oficial (Download)...');

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 60000 }),
            page.click('input[value="Emitir Darf"], button:has-text("Emitir Darf")')
        ]);

        const fileName = `DARF_OFICIAL_${args.cpf.replace(/\D/g, '')}.pdf`;
        const downloadPath = path.join(process.cwd(), fileName);
        await download.saveAs(downloadPath);

        console.log(`\n✅ SUCESSO! DARF gerado e salvo em:`);
        console.log(`👉 ${downloadPath}\n`);

    } catch (err) {
        console.error('\n❌ Erro durante a automação:', err.message);
    } finally {
        await page.waitForTimeout(3000);
        await browser.close();
        console.log('Navegador fechado.');
    }
}

runSicalcBot();
