const fs = require('node:fs/promises');
const path = require('node:path');

const source = path.resolve(__dirname, '../src/template/Template.pdf');
const destinationDirectory = path.resolve(__dirname, '../dist/template');
const destination = path.join(destinationDirectory, 'Template.pdf');

fs.mkdir(destinationDirectory, { recursive: true })
    .then(() => fs.copyFile(source, destination))
    .catch((error) => {
        console.error(`Failed to copy PDF template: ${error.message}`);
        process.exitCode = 1;
    });
