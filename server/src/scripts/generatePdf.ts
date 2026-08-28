import fs from 'node:fs/promises';
import path from 'node:path';
import PDFService from '../services/PDFService';

type FingerSelection = {
    hand: 'left' | 'right';
    finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
};

const VALID_FINGERS = new Set<FingerSelection['finger']>([
    'thumb',
    'index',
    'middle',
    'ring',
    'pinky',
]);

function parseBiometricMethod(value?: string): 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | undefined {
    if (!value) return undefined;

    const normalized = value.trim().toUpperCase();
    if (normalized === 'REGISTRATION' || normalized === 'DACTILAR_REGISTRO') return 'DACTILAR_REGISTRO';
    if (normalized === 'VERIFICATION' || normalized === 'DACTILAR_VERIFICACION') return 'DACTILAR_VERIFICACION';

    throw new Error(`Método inválido: ${value}. Usa registration o verification.`);
}

function parseSelectedFingers(value?: string): FingerSelection[] | undefined {
    if (!value) return undefined;

    const selections = value.split(',').map((item) => {
        const [hand, finger] = item.trim().toLowerCase().split(':');
        if ((hand !== 'left' && hand !== 'right') || !VALID_FINGERS.has(finger as FingerSelection['finger'])) {
            throw new Error(`Dedo inválido: ${item}. Usa left/right y thumb/index/middle/ring/pinky.`);
        }

        return { hand, finger } as FingerSelection;
    });

    const left = selections.filter(({ hand }) => hand === 'left');
    const right = selections.filter(({ hand }) => hand === 'right');
    const unique = new Set(selections.map(({ hand, finger }) => `${hand}:${finger}`));
    if (selections.length < 4 || selections.length > 10 || left.length < 2 || left.length > 5 || right.length < 2 || right.length > 5 || unique.size !== selections.length) {
        throw new Error('La verificación requiere entre 2 y 5 dedos por mano, sin repetir.');
    }

    return selections;
}

async function main() {
    const userId = process.argv[2];
    const methodArgumentIndex = process.argv.indexOf('--method');
    const biometricMethod = parseBiometricMethod(
        methodArgumentIndex >= 0 ? process.argv[methodArgumentIndex + 1] : undefined
    );
    const fingersArgumentIndex = process.argv.indexOf('--fingers');
    const selectedFingers = parseSelectedFingers(
        fingersArgumentIndex >= 0 ? process.argv[fingersArgumentIndex + 1] : undefined
    );

    if (!userId) {
        throw new Error('Uso: npm run generate-pdf -- <userId> [--method registration|verification] [--fingers left:thumb,left:index,right:ring,right:pinky]');
    }

    if (selectedFingers && biometricMethod !== 'DACTILAR_VERIFICACION') {
        throw new Error('El argumento --fingers requiere --method verification.');
    }

    const pdf = await PDFService({ userId, biometricMethod, selectedFingers });
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