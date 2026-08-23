const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'assets', 'cards');
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

console.log('Fixing card assets in:', dir);

// 1. Move C*.png (which are actually Hearts) to TEMP_HEARTS_*.png
ranks.forEach(r => {
    const src = path.join(dir, `C${r}.png`);
    const dst = path.join(dir, `TEMP_HEARTS_${r}.png`);
    if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
    }
});

// 2. Move D*.png (which are actually Clubs) to C*.png
ranks.forEach(r => {
    const src = path.join(dir, `D${r}.png`);
    const dst = path.join(dir, `C${r}.png`);
    if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
    }
});

// 3. Move H*.png (which are actually Diamonds) to D*.png
ranks.forEach(r => {
    const src = path.join(dir, `H${r}.png`);
    const dst = path.join(dir, `D${r}.png`);
    if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
    }
});

// 4. Move TEMP_HEARTS_*.png (Hearts) to H*.png
ranks.forEach(r => {
    const src = path.join(dir, `TEMP_HEARTS_${r}.png`);
    const dst = path.join(dir, `H${r}.png`);
    if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
    }
});

console.log('Verification:');
['C7.png', 'D7.png', 'H7.png', 'S7.png'].forEach(f => {
    console.log(f, fs.statSync(path.join(dir, f)).size);
});
console.log('Card asset filenames successfully corrected!');
