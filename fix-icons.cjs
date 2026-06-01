const sharp = require('sharp');
const fs = require('fs');

async function processIcon(size) {
  const file = `public/icon-${size}.png`;
  const tempFile = `public/icon-${size}-temp.png`;
  
  if (!fs.existsSync(file)) return;

  await sharp(file)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .flatten({ background: '#ffffff' })
    .toFile(tempFile);

  fs.renameSync(tempFile, file);
  console.log(`Processed ${file}`);
}

async function run() {
  await processIcon(192);
  await processIcon(512);
}

run().catch(console.error);
