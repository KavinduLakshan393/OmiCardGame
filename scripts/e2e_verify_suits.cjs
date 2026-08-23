const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PORT = 3002;
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'screenshots', 'e2e');

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
    console.log(`E2E Verification Server on port ${PORT}`);

    try {
        const browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();

        console.log('1. Loading game.html...');
        await page.goto(`http://localhost:${PORT}/game.html`);
        await page.waitForTimeout(500);

        console.log('2. Starting game...');
        await page.click('#start-btn');
        await page.waitForTimeout(1200);

        // Trump selection
        console.log('3. Waiting for trump selection...');
        try {
            await page.waitForSelector('#modal-overlay:not(.hidden)', { timeout: 3500 });
            console.log('3. Human trump modal open! Selecting Diamonds (♦)...');
            await page.locator('.suit-btn[data-suit="Diamonds"]').click();
        } catch {
            console.log('3. AI selected trump.');
        }

        // Wait for second deal to complete (8 cards in hand)
        console.log('4. Waiting for second deal of 4 cards (8 cards total)...');
        await page.waitForFunction(() => {
            const cards = document.querySelectorAll('#p0-hand .card');
            return cards.length === 8;
        }, { timeout: 8000 });
        const cardElements = await page.locator('#p0-hand .card').all();
        console.log(`Found ${cardElements.length} cards in player hand.`);
        assert.equal(cardElements.length, 8, 'Expected 8 cards in hand after 2nd deal');

        for (let i = 0; i < cardElements.length; i++) {
            const el = cardElements[i];
            const bgImage = await el.evaluate(node => window.getComputedStyle(node).backgroundImage);
            const parentWrapper = el.locator('xpath=..');
            const label = await parentWrapper.getAttribute('aria-label');
            const suit = await el.getAttribute('data-suit');
            const rank = await el.getAttribute('data-rank');

            console.log(` - Card #${i + 1}: Label="${label}" | suit="${suit}" | rank="${rank}" | CSS bg="${bgImage}"`);

            // Verify mapping: e.g. "Clubs" / "A" -> "CA.png"
            const suitInitial = suit.charAt(0).toUpperCase();
            const expectedFileName = `${suitInitial}${rank}.png`;
            assert.ok(
                bgImage.includes(expectedFileName),
                `Card ${rank} of ${suit} expected image ${expectedFileName} but got CSS ${bgImage}`
            );
        }
        console.log('✅ Hand card image mapping is 100% accurate!');

        // 5. Play tricks and verify Previous Trick popover
        console.log('\n5. Playing tricks and verifying previous trick records...');
        let tricksPlayed = 0;

        while (tricksPlayed < 8) {
            const handCount = await page.locator('#p0-hand .card-wrapper').count();
            if (handCount === 0) {
                console.log('All 8 cards played from hand.');
                break;
            }

            // Check if human turn is active
            const isHumanTurn = await page.locator('#player-0.active-turn').count() > 0;
            const validCards = page.locator('#p0-hand .card-wrapper:has(.card-valid)');

            if (isHumanTurn && await validCards.count() > 0) {
                const cardToPlay = validCards.first();
                const cardLabel = await cardToPlay.getAttribute('aria-label');
                const prevCount = await page.locator('#p0-hand .card-wrapper').count();
                console.log(`\nTrick ${tricksPlayed + 1} - Human playing: ${cardLabel} (hand had ${prevCount} cards)`);

                await cardToPlay.click();
                tricksPlayed++;

                // Wait for trick to resolve and hand count to decrease
                await page.waitForFunction(expectedCount => {
                    const count = document.querySelectorAll('#p0-hand .card-wrapper').length;
                    return count === expectedCount;
                }, prevCount - 1, { timeout: 12000 });

                console.log(`Hand successfully decreased to ${prevCount - 1} cards.`);

                // Wait for animations and AI
                await page.waitForTimeout(1800);

                // Verify Previous Trick button and popover
                const prevTrickBtn = page.locator('#previous-trick-btn');
                if (await prevTrickBtn.isVisible() && !await prevTrickBtn.isDisabled()) {
                    await prevTrickBtn.click();
                    await page.waitForTimeout(300);
                    const popoverTitle = await page.locator('#previous-trick-title').textContent();
                    console.log(`[Previous Trick Popover]: ${popoverTitle.trim()}`);
                    await page.screenshot({ path: path.join(outDir, `previous_trick_${tricksPlayed}.png`) });
                    await page.locator('#previous-trick-close').click();
                    await page.waitForTimeout(200);
                }

                // Verify the played card is no longer in South's hand
                const remainingCards = await page.locator('#p0-hand .card-wrapper').all();
                for (const rc of remainingCards) {
                    const rcLabel = await rc.getAttribute('aria-label');
                    assert.notEqual(rcLabel, cardLabel, `Card ${cardLabel} should have been removed from hand!`);
                }
            } else {
                await page.waitForTimeout(300);
            }
        }

        console.log('\n6. Checking Hand Result overlay...');
        await page.waitForTimeout(2000);
        const resultOverlay = page.locator('#result-overlay');
        if (await resultOverlay.isVisible()) {
            console.log('Hand Result Overlay is visible!');
            await page.screenshot({ path: path.join(outDir, 'hand_result_overlay.png') });
        }

        await browser.close();
        console.log('\n🎉 ALL E2E TESTS PASSED WITH ZERO ERRORS!');

    } catch (err) {
        console.error('E2E Test Failed:', err);
        process.exitCode = 1;
    } finally {
        server.close();
        process.exit(process.exitCode || 0);
    }
})();
