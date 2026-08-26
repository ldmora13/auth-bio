import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { db } from '../lib/db';

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

	write(secondPage, processNumber, { x: 55, y: 400, width: 120, size: 12, align: 'center' });
	write(secondPage, user.migratoryStatus ?? 'N/D', { x: 185, y: 400, width: 105, size: 10, align: 'center' });
	write(secondPage, formatStoredDate(user.receivedDate), { x: 190, y: 338, width: 130, size: 12 });
	write(secondPage, formatStoredDate(user.deadline), { x: 190, y: 312, width: 130, size: 12 });

	return Buffer.from(await pdf.save());
}