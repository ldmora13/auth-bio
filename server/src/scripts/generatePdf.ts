import fs from 'node:fs/promises';
import path from 'node:path';
import PDFService from '../services/PDFService';

async function main() {
    const userId = process.argv[2];

    if (!userId) {
        throw new Error('Uso: npm run generate-pdf -- <userId>');
    }

    const pdf = await PDFService({ userId });
    const outputPath = path.resolve(
        process.cwd(),
        `biometria-${userId}.pdf`
    );

    await fs.writeFile(outputPath, pdf);

    console.log(`PDF generado en: ${outputPath}`);
}

main().catch((error) => {
    console.error('Error generando PDF:', error);
    process.exitCode = 1;
});