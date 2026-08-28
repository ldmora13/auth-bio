const fs = require('node:fs/promises');
const path = require('node:path');

const destinationDirectory = path.resolve(__dirname, '../dist/template');
const templateNames = ['template_r.pdf', 'template_v.pdf'];

fs.mkdir(destinationDirectory, { recursive: true })
    .then(() => Promise.all(templateNames.map((templateName) => fs.copyFile(
        path.resolve(__dirname, '../src/template', templateName),
        path.join(destinationDirectory, templateName),
    ))))
    .catch((error) => {
        console.error(`Failed to copy PDF template: ${error.message}`);
        process.exitCode = 1;
    });
