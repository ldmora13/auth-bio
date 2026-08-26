import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { db } from '../lib/db';
import { getR2Config } from '../config/r2';

type PDFServiceOptions = { userId?: string; email?: string };

const TEMPLATE_PATH = path.resolve(__dirname, '../template/Template.pdf');
const formatDate = (value: Date | null) => value
	? value.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
	: 'N/D';

const formatStoredDate = (value: string | null) => {
	if (!value) return 'N/D';
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? value : formatDate(date);
};

type SupportedImageType = 'jpg' | 'png';

function detectImageType(bytes: Uint8Array): SupportedImageType | null {
	if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'jpg';
	}

	if (
		bytes.length > 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return 'png';
	}

	return null;
}

async function loadProfileImageBytes(profilePhotoUrl: string): Promise<Uint8Array | null> {
	if (!profilePhotoUrl) return null;

	const r2 = getR2Config();

	const readFromR2 = async (objectKey: string) => {
		if (!r2 || !objectKey) return null;
		const object = await r2.client.send(new GetObjectCommand({
			Bucket: r2.bucketName,
			Key: objectKey,
		}));
		if (!object.Body) return null;

		const body = object.Body as any;
		if (typeof body.transformToByteArray === 'function') {
			return new Uint8Array(await body.transformToByteArray());
		}

		const chunks: Buffer[] = [];
		for await (const chunk of body as AsyncIterable<Uint8Array>) {
			chunks.push(Buffer.from(chunk));
		}
		return new Uint8Array(Buffer.concat(chunks));
	};

	const getObjectKeyFromRemoteUrl = (rawUrl: string) => {
		if (!r2) return null;
		const sourceUrl = new URL(rawUrl);
		const publicUrl = new URL(r2.publicUrl);
		if (sourceUrl.hostname !== publicUrl.hostname) {
			return null;
		}

		return decodeURIComponent(sourceUrl.pathname.replace(/^\/+/, ''));
	};

	if (profilePhotoUrl.startsWith('http://') || profilePhotoUrl.startsWith('https://')) {
		try {
			const response = await fetch(profilePhotoUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch profile photo: ${response.status}`);
			}
			return new Uint8Array(await response.arrayBuffer());
		} catch (error) {
			const objectKey = getObjectKeyFromRemoteUrl(profilePhotoUrl);
			if (objectKey) {
				const r2ImageBytes = await readFromR2(objectKey);
				if (r2ImageBytes) return r2ImageBytes;
			}
			throw error;
		}
	}

	if (profilePhotoUrl.startsWith('/')) {
		const objectKey = decodeURIComponent(profilePhotoUrl.replace(/^\/+/, ''));
		const r2ImageBytes = await readFromR2(objectKey);
		if (r2ImageBytes) return r2ImageBytes;
		throw new Error(`Failed to load profile photo from R2: ${objectKey}`);
	}

	return await fs.readFile(path.resolve(profilePhotoUrl));
}

async function drawUserPhoto(page: PDFPage, pdf: PDFDocument, profilePhotoUrl?: string | null) {
	if (!profilePhotoUrl) return;

	try {
		const imageBytes = await loadProfileImageBytes(profilePhotoUrl);
		if (!imageBytes) return;

		const type = detectImageType(imageBytes);
		if (!type) {
			console.warn(`[PDFService] Unsupported profile photo format for ${profilePhotoUrl}. Only JPG/PNG can be embedded.`);
			return;
		}

		const embedded = type === 'jpg'
			? await pdf.embedJpg(imageBytes)
			: await pdf.embedPng(imageBytes);

		const box = {
			x: 435,
			y: 245,
			width: 155,
			height: 210,
		};

		const scale = Math.min(box.width / embedded.width, box.height / embedded.height);
		const width = embedded.width * scale;
		const height = embedded.height * scale;
		const x = box.x + (box.width - width) / 2;
		const y = box.y + (box.height - height) / 2;

		page.drawImage(embedded, { x, y, width, height });
	} catch (error) {
		console.warn('[PDFService] Could not embed profile photo in PDF:', error);
	}
}

export default async function PDFService({ userId, email }: PDFServiceOptions): Promise<Buffer> {
	if (!userId && !email) throw new Error('PDFService requires userId or email');

	const user = userId
		? await db.user.findUnique({ where: { id: userId }, include: { empresa: true } })
		: await db.user.findUnique({ where: { email: email! }, include: { empresa: true } });
	if (!user) throw new Error(`User not found for PDF generation: ${userId ?? email}`);

	const pdf = await PDFDocument.load(await fs.readFile(TEMPLATE_PATH));
	const [firstPage, secondPage] = pdf.getPages();
	const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
	const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
	const color = rgb(0.05, 0.05, 0.05);

	const write = (page: PDFPage, value: string, options: { x: number; y: number; width: number; size?: number; font?: PDFFont; align?: 'left' | 'center' }) => {
		const font = options.font ?? boldFont;
		const size = options.size ?? 15;
		const textWidth = font.widthOfTextAtSize(value, size);
		page.drawText(value, {
			x: options.align === 'center' ? options.x + Math.max(0, (options.width - textWidth) / 2) : options.x,
			y: options.y,
			size,
			font,
			color,
		});
	};

	const birthDate = formatDate(user.birthDate);
	const documentNumber = user.documentNumber ?? 'N/D';
	const caseNumber = user.caseNumber ?? 'N/D';
	const processNumber = user.processNumber ?? 'N/D';
	const formId = user.formId ?? documentNumber;

	write(firstPage, `Form ${formId}, Biometric data`, { x: 215, y: 605, width: 185, align: 'center' });
	write(firstPage, caseNumber, { x: 225, y: 460, width: 185, align: 'center' });
	write(firstPage, processNumber, { x: 225, y: 406, width: 187, align: 'center' });
	write(firstPage, documentNumber, { x: 225, y: 360, width: 170, size: 13, align: 'center' });
	write(firstPage, user.name.toUpperCase(), { x: 18, y: 319, width: 205, size: 13 });
	write(firstPage, (user.nativeCountry ?? 'N/D').toUpperCase(), { x: 18, y: 270, width: 205, align: 'center' });
	write(firstPage, `${birthDate} / ${user.sex ?? 'N/D'}`, { x: 230, y: 270, width: 180, size: 13, align: 'center' });
	write(firstPage, documentNumber, { x: 18, y: 222, width: 170, size: 13, align: 'center' });
	write(firstPage, `Valid From ${formatStoredDate(user.validFrom)} - Card Expires ${formatStoredDate(user.cardExpires)}`, { x: 18, y: 205, width: 205, size: 8, font: regularFont, align: 'center' });
	write(firstPage, user.migratoryStatus ?? 'N/D', { x: 225, y: 210, width: 105, size: 10, align: 'center' });
	await drawUserPhoto(firstPage, pdf, user.profilePhotoUrl);

	write(secondPage, processNumber, { x: 55, y: 400, width: 120, size: 12, align: 'center' });
	write(secondPage, user.migratoryStatus ?? 'N/D', { x: 185, y: 400, width: 105, size: 10, align: 'center' });
	write(secondPage, formatStoredDate(user.receivedDate), { x: 190, y: 338, width: 130, size: 12 });
	write(secondPage, formatStoredDate(user.deadline), { x: 190, y: 312, width: 130, size: 12 });

	return Buffer.from(await pdf.save());
}