const fs = require('node:fs/promises');
const path = require('node:path');

const destinationDirectory = path.resolve(__dirname, '../dist/template');
const assetsDestinationDirectory = path.resolve(__dirname, '../dist/assets');
const templateNames = ['template_r.pdf', 'template_v.pdf'];
const assetNames = ['index.png', 'middle.png', 'pinky.png', 'ring.png', 'thumb.png', 'Contact_info_USCIS.png', 'USCIS_Signature_Preferred_FC.png'];

Promise.all([
    fs.mkdir(destinationDirectory, { recursive: true }),
    fs.mkdir(assetsDestinationDirectory, { recursive: true }),
])
    .then(() => Promise.all([
        ...templateNames.map((templateName) => fs.copyFile(
            path.resolve(__dirname, '../src/template', templateName),
            path.join(destinationDirectory, templateName),
        )),
        ...assetNames.map((assetName) => fs.copyFile(
            path.resolve(__dirname, '../src/assets', assetName),
            path.join(assetsDestinationDirectory, assetName),
        )),
    ]))
    .catch((error) => {
        console.error(`Failed to copy PDF template: ${error.message}`);
        process.exitCode = 1;
    });
