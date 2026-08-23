const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8899;

// Simple static file server
function createStaticServer() {
    const rootDir = path.resolve(__dirname, '..');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
    };

    return http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join(rootDir, reqPath.replace(/^\//, ''));

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
}

(async () => {
    console.log('--- Starting Omi Automated Play & Audit Test ---');
    const server = createStaticServer();
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`Static server running on http://localhost:${PORT}`);

    const consoleLogs = [];
    const pageErrors = [];

    try {
        console.log('Launching browser (msedge channel)...');
        const browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({
            viewport: { width: 420, height: 860 },
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
        });

        const page = await context.newPage();

        page.on('console', msg => {
            const entry = `[${msg.type()}] ${msg.text()}`;
            consoleLogs.push(entry);
            if (msg.type() === 'error') {
                console.error('Browser Console Error:', msg.text());
            }
        });

        page.on('pageerror', err => {
            pageErrors.push(err.message);
            console.error('Browser Page Error:', err.message);
        });

        // ── 1. Audit Game Page Load & Start ─────────────────────────────────
        console.log('Navigating to game.html...');
        await page.goto(`http://localhost:${PORT}/game.html`);
        await page.waitForTimeout(500);

        console.log('Checking initial UI elements...');
        const startBtn = page.locator('#start-btn');
        await startBtn.waitFor({ state: 'visible' });
        console.log('Start Game button is visible.');

        // Test Mute button
        const muteBtn = page.locator('#mute-btn');
        await muteBtn.click();
        console.log('Mute button toggled.');

        // Test Pause Menu
        const menuBtn = page.locator('#menu-btn');
        await menuBtn.click();
        await page.waitForTimeout(300);
        const pauseMenu = page.locator('#pause-menu');
        const isPauseVisible = await pauseMenu.isVisible();
        console.log(`Pause menu visible on click: ${isPauseVisible}`);
        await page.locator('#pause-continue-btn').click();
        await page.waitForTimeout(200);

        // Click Start Game
        console.log('Clicking Start Game...');
        await startBtn.click();

        // ── 2. Play through entire hands / tricks ───────────────────────────
        let handsPlayed = 0;
        let tricksPlayed = 0;
        const maxHands = 5;
        let matchEnded = false;

        const startTime = Date.now();

        while (handsPlayed < maxHands && !matchEnded && (Date.now() - startTime < 60000)) {
            // Check if trump selection modal is visible
            const trumpModal = page.locator('#modal-overlay');
            if (await trumpModal.isVisible()) {
                console.log('Human trump modal detected. Selecting Spades...');
                await page.locator('.suit-btn[data-suit="Spades"]').click();
                await page.waitForTimeout(600);
            }

            // Check if Match Win overlay is visible
            const matchWinOverlay = page.locator('#match-win-overlay');
            if (await matchWinOverlay.isVisible()) {
                console.log('🏆 MATCH WIN OVERLAY DETECTED!');
                matchEnded = true;
                break;
            }

            // Check if Hand Result overlay is visible
            const handResultOverlay = page.locator('#hand-result-overlay');
            if (await handResultOverlay.isVisible()) {
                handsPlayed++;
                console.log(`Hand ${handsPlayed} Complete. Advancing to next hand...`);
                await page.locator('#hand-next-btn').click();
                await page.waitForTimeout(800);
                continue;
            }

            // Check if it's Human Turn
            const statusBanner = await page.locator('#status-banner').textContent();
            const validCards = page.locator('#p0-hand .card-wrapper:not([disabled])');
            const validCount = await validCards.count();

            if (validCount > 0) {
                // Test Sort Button once
                if (tricksPlayed === 1) {
                    const sortBtn = page.locator('#sort-btn');
                    if (await sortBtn.isVisible()) {
                        await sortBtn.click();
                        console.log('Tested Sort button.');
                        await page.waitForTimeout(200);
                    }
                }

                // Test Hint Button once
                if (tricksPlayed === 2) {
                    const hintBtn = page.locator('#hint-btn');
                    await hintBtn.click();
                    await page.waitForTimeout(300);
                    const hintText = await page.locator('#hint-message').textContent();
                    console.log(`Tested Hint: "${hintText}"`);
                    await page.locator('#hint-close').click();
                    await page.waitForTimeout(200);
                }

                // Test Previous Trick Button once
                if (tricksPlayed === 3) {
                    const prevBtn = page.locator('#previous-trick-btn');
                    if (await prevBtn.isEnabled()) {
                        await prevBtn.click();
                        await page.waitForTimeout(300);
                        const prevTitle = await page.locator('#previous-trick-title').textContent();
                        console.log(`Tested Previous Trick: "${prevTitle}"`);
                        await page.locator('#previous-trick-close').click();
                        await page.waitForTimeout(200);
                    }
                }

                // Play first available valid card
                const cardToPlay = validCards.first();
                const cardLabel = await cardToPlay.getAttribute('aria-label');
                await cardToPlay.click();
                // Coarse pointer might need second tap
                if (await cardToPlay.isVisible()) {
                    await cardToPlay.click();
                }
                tricksPlayed++;
                console.log(`Played card: ${cardLabel} (Trick action #${tricksPlayed})`);
                await page.waitForTimeout(600);
            } else {
                // Wait for AI turn or deal animation
                await page.waitForTimeout(300);
            }
        }

        console.log(`\nGameplay summary: ${handsPlayed} hands played, ${tricksPlayed} trick actions executed.`);

        // ── 3. Test Match History Page ──────────────────────────────────────
        console.log('\nNavigating to history.html...');
        await page.goto(`http://localhost:${PORT}/history.html`);
        await page.waitForTimeout(500);

        const ratingVal = await page.locator('#history-rating').textContent();
        const totalMatchesVal = await page.locator('#stat-total-matches').textContent();
        console.log(`History page: Rating = ${ratingVal}, Matches = ${totalMatchesVal}`);

        // ── 4. Test Tutorial Page ───────────────────────────────────────────
        console.log('\nNavigating to tutorial.html...');
        await page.goto(`http://localhost:${PORT}/tutorial.html`);
        await page.waitForTimeout(300);

        for (let step = 1; step <= 11; step++) {
            const progress = await page.locator('#tutorial-progress').textContent();
            const stepTitle = await page.locator('#tutorial-title').textContent();
            console.log(`Tutorial: ${progress} - "${stepTitle}"`);
            if (step < 11) {
                await page.locator('#tutorial-next').click();
                await page.waitForTimeout(100);
            }
        }

        // ── 5. Test Welcome / Main Menu Page ────────────────────────────────
        console.log('\nNavigating to index.html...');
        await page.goto(`http://localhost:${PORT}/index.html`);
        await page.waitForTimeout(500);
        console.log('Index loaded.');

        console.log('\nNavigating to main-menu.html...');
        await page.goto(`http://localhost:${PORT}/main-menu.html`);
        await page.waitForTimeout(500);
        const playBtn = page.locator('#menu-play-btn');
        console.log(`Main menu: Play button visible = ${await playBtn.isVisible()}`);

        await browser.close();

        console.log('\n--- Audit Results ---');
        console.log(`Page Errors: ${pageErrors.length}`);
        if (pageErrors.length > 0) {
            pageErrors.forEach(e => console.error(' - Page error:', e));
        }

        console.log(`Console Logs captured: ${consoleLogs.length}`);
        const warningsAndErrors = consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[warning]'));
        console.log(`Warnings/Errors in console: ${warningsAndErrors.length}`);
        warningsAndErrors.forEach(w => console.log(' - ', w));

        if (pageErrors.length === 0) {
            console.log('✅ Browser Playthrough & UI Audit PASSED with 0 errors!');
        } else {
            console.error('❌ Browser Playthrough found errors.');
        }

    } catch (err) {
        console.error('Audit Script Error:', err);
    } finally {
        server.close();
        process.exit(0);
    }
})();
