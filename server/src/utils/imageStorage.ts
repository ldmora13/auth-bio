import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { AppError } from './AppError';

const mimeToExtension: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

function sanitizeFolderName(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase() || 'company';
}

export async function persistImageDataUrl(input: {
    dataUrl: string;
    companyName: string;
    filePrefix: string;
}): Promise<string> {
    const match = input.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
        throw new AppError('Invalid image payload format', 400);
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[2];
    const extension = mimeToExtension[mimeType];

    if (!extension) {
        throw new AppError('Unsupported image format', 400);
    }

    const companyFolder = sanitizeFolderName(input.companyName);
    const publicRoot = process.env.CLIENT_PUBLIC_DIR
        ? path.resolve(process.env.CLIENT_PUBLIC_DIR)
        : path.resolve(process.cwd(), '..', 'client', 'public');

    const targetFolder = path.join(publicRoot, companyFolder);
    await mkdir(targetFolder, { recursive: true });

    const fileName = `${input.filePrefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
    const filePath = path.join(targetFolder, fileName);

    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(filePath, buffer);

    return `/${companyFolder}/${fileName}`;
}
