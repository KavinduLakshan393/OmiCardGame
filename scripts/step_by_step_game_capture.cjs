const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'screenshots', 'flow');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(rootDir, reqPath.replace(/^\//, ''));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('404');
        return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

(async () => {
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`Step-by-step capture server on port ${PORT}`);

    try {
        const browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({
            viewport: { width: 430, height: 932 },
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
        });
        const page = await context.newPage();

        console.log('1. Loading game.html...');
        await page.goto(`http://localhost:${PORT}/game.html`);
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(outDir, '01_initial_load.png') });

        console.log('2. Clicking Start Game...');
        await page.click('#start-btn');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(outDir, '02_after_start_first_deal.png') });

        // Check for trump modal
        const modal = page.locator('#modal-overlay');
        if (await modal.isVisible()) {
            console.log('3. Trump modal is visible. Taking screenshot...');
            await page.screenshot({ path: path.join(outDir, '03_trump_selection_modal.png') });
            console.log('4. Choosing Spades as trump...');
            await page.locator('.suit-btn[data-suit="Spades"]').click();
            await page.waitForTimeout(2000); // wait for 2nd deal
            await page.screenshot({ path: path.join(outDir, '04_after_second_deal.png') });
        } else {
            console.log('AI is choosing trump...');
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(outDir, '04_after_ai_trump_deal.png') });
        }

        // Play 3 tricks and capture each
        for (let trick = 1; trick <= 3; trick++) {
            console.log(`\n--- Playing Trick ${trick} ---`);
            // Wait until South has a turn
            for (let i = 0; i < 20; i++) {
                const validCards = page.locator('#p0-hand .card-wrapper:not([disabled])');
                if (await validCards.count() > 0) {
                    console.log(`South turn detected for trick ${trick}. Valid cards available: ${await validCards.count()}`);
                    await page.screenshot({ path: path.join(outDir, `05_trick_${trick}_before_play.png`) });
                    
                    // Click card (two taps for coarse pointer)
                    const card = validCards.first();
                    const label = await card.getAttribute('aria-label');
                    console.log(`South playing: ${label}`);
                    await card.click();
                    await page.waitForTimeout(300);
                    if (await card.isVisible()) {
                        await card.click();
                    }
                    await page.waitForTimeout(2500); // wait for trick to play out and collect
                    await page.screenshot({ path: path.join(outDir, `06_trick_${trick}_after_resolution.png`) });
                    break;
                }
                await page.waitForTimeout(500);
            }
        }

        console.log('\nCapturing HUD and scoreboard state...');
        const nsTricks = await page.locator('#ns-tricks').textContent();
        const ewTricks = await page.locator('#ew-tricks').textContent();
        const nsTokens = await page.locator('#ns-tokens').textContent();
        const ewTokens = await page.locator('#ew-tokens').textContent();
        console.log(`Scoreboard: NS Tricks = ${nsTricks}, EW Tricks = ${ewTricks} | NS Tokens = ${nsTokens}, EW Tokens = ${ewTokens}`);

        await browser.close();
        console.log(`\nAll step-by-step screenshots saved to ${outDir}`);

    } catch (err) {
        console.error('Capture error:', err);
    } finally {
        server.close();
        process.exit(0);
    }
})();
