import { resend } from '../config/resend';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type BiometricMethod = 'DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | 'FACIAL' | 'OCULAR';

const biometricMethodLabels = {
    DACTILAR: 'Registro dactilar',
    DACTILAR_REGISTRO: 'Registro dactilar',
    DACTILAR_VERIFICACION: 'Verificación dactilar',
    FACIAL: 'Facial',
    OCULAR: 'Ocular',
} as const;

const FULL_FINGER_LABELS = [
    'Pulgar izquierdo',
    'Indice izquierdo',
    'Medio izquierdo',
    'Anular izquierdo',
    'Menique izquierdo',
    'Pulgar derecho',
    'Indice derecho',
    'Medio derecho',
    'Anular derecho',
    'Menique derecho',
] as const;

const LEFT_FINGER_LABELS = FULL_FINGER_LABELS.slice(0, 5);
const RIGHT_FINGER_LABELS = FULL_FINGER_LABELS.slice(5);

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{
        filename: string;
        content: Buffer;
    }>;
}

interface SendEmailRetryOptions extends EmailOptions {
    maxRetries?: number;
    baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_BIOMETRIC_METHODS: BiometricMethod[] = ['DACTILAR', 'DACTILAR_REGISTRO', 'DACTILAR_VERIFICACION', 'FACIAL', 'OCULAR'];

function createSeededRandom(seedInput: string) {
    let state = 0;
    for (let index = 0; index < seedInput.length; index += 1) {
        state = (state * 31 + seedInput.charCodeAt(index)) >>> 0;
    }

    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0xffffffff;
    };
}

function pickRandomItems(values: readonly string[], count: number, random: () => number) {
    const pool = [...values];
    const picked: string[] = [];

    while (pool.length > 0 && picked.length < count) {
        const randomIndex = Math.floor(random() * pool.length);
        const [item] = pool.splice(randomIndex, 1);
        picked.push(item);
    }

    return picked;
}

function resolveSimulatedFingerprintLabels(userId: string, methods: BiometricMethod[]) {
    const uniqueMethods = [...new Set(methods)];
    if (uniqueMethods.includes('DACTILAR') || uniqueMethods.includes('DACTILAR_REGISTRO')) {
        return [...FULL_FINGER_LABELS];
    }

    if (uniqueMethods.includes('DACTILAR_VERIFICACION')) {
        const random = createSeededRandom(userId);
        const leftSample = pickRandomItems(LEFT_FINGER_LABELS, 2, random);
        const rightSample = pickRandomItems(RIGHT_FINGER_LABELS, 2, random);
        return [...leftSample, ...rightSample];
    }

    return [];
}

async function generateBiometricSummaryPdf(payload: {
    userId: string;
    name: string;
    email: string;
    companyName?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    biometricMethods: BiometricMethod[];
    completedAt?: Date | null;
}) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);

    const width = page.getWidth();
    const height = page.getHeight();
    let cursorY = height - 60;

    page.drawText('Comprobante de verificacion biometrica', {
        x: 40,
        y: cursorY,
        size: 20,
        font: titleFont,
        color: rgb(0.08, 0.16, 0.31),
    });

    cursorY -= 28;
    page.drawText('Smart Biometrics - huellas simuladas para trazabilidad', {
        x: 40,
        y: cursorY,
        size: 10,
        font: bodyFont,
        color: rgb(0.38, 0.44, 0.54),
    });

    cursorY -= 30;
    const completedAtLabel = payload.completedAt
        ? payload.completedAt.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
        : 'N/D';
    const methodsLabel = [...new Set(payload.biometricMethods)]
        .map((method) => biometricMethodLabels[method])
        .join(', ');

    const dataRows = [
        `Cliente: ${payload.name}`,
        `Email: ${payload.email}`,
        `Cliente ID: ${payload.userId}`,
        `Documento: ${payload.documentType ?? 'N/D'} ${payload.documentNumber ?? ''}`.trim(),
        `Empresa: ${payload.companyName ?? 'N/D'}`,
        `Metodos completados: ${methodsLabel || 'N/D'}`,
        `Fecha de finalizacion: ${completedAtLabel}`,
    ];

    dataRows.forEach((row) => {
        page.drawText(row, {
            x: 40,
            y: cursorY,
            size: 11,
            font: bodyFont,
            color: rgb(0.12, 0.16, 0.2),
        });
        cursorY -= 18;
    });

    cursorY -= 14;
    page.drawText('Huellas simuladas', {
        x: 40,
        y: cursorY,
        size: 14,
        font: titleFont,
        color: rgb(0.08, 0.16, 0.31),
    });

    const fingerprintLabels = resolveSimulatedFingerprintLabels(payload.userId, payload.biometricMethods);
    if (fingerprintLabels.length === 0) {
        cursorY -= 20;
        page.drawText('Este flujo no incluyo componente dactilar.', {
            x: 40,
            y: cursorY,
            size: 11,
            font: bodyFont,
            color: rgb(0.45, 0.49, 0.56),
        });
    } else {
        const columns = 2;
        const boxWidth = (width - 100) / columns;
        const boxHeight = 92;
        const startY = cursorY - 20;

        fingerprintLabels.forEach((label, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const originX = 40 + col * boxWidth;
            const originY = startY - row * (boxHeight + 12);

            page.drawRectangle({
                x: originX,
                y: originY - boxHeight,
                width: boxWidth - 12,
                height: boxHeight,
                borderColor: rgb(0.78, 0.83, 0.91),
                borderWidth: 1,
                color: rgb(0.97, 0.98, 1),
            });

            const centerX = originX + 35;
            const centerY = originY - 46;
            for (let ring = 0; ring < 5; ring += 1) {
                page.drawEllipse({
                    x: centerX,
                    y: centerY,
                    xScale: 16 - ring * 2.4,
                    yScale: 22 - ring * 3,
                    borderColor: rgb(0.2, 0.42, 0.72),
                    borderWidth: 0.8,
                });
            }

            page.drawText(label, {
                x: originX + 70,
                y: originY - 32,
                size: 10,
                font: titleFont,
                color: rgb(0.1, 0.15, 0.24),
                maxWidth: boxWidth - 86,
            });
            page.drawText('Simulada', {
                x: originX + 70,
                y: originY - 50,
                size: 9,
                font: bodyFont,
                color: rgb(0.41, 0.46, 0.54),
            });
        });
    }

    const pdfBytes = await pdf.save();
    return Buffer.from(pdfBytes);
}

export const EmailService = {
    sendEmail: async ({ to, subject, html, attachments }: EmailOptions) => {
        try {
            const { data, error } = await resend.emails.send({
                from: 'noreplay <noreplay@updates.smartbiometrics.org>',
                to,
                subject,
                html,
                attachments,
            });
            if (error) {
                console.error('Resend error:', error);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Error sending email:', error);
            return null;
        }
    },

    sendEmailWithRetry: async ({ to, subject, html, attachments, maxRetries = 3, baseDelayMs = 500 }: SendEmailRetryOptions) => {
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            const result = await EmailService.sendEmail({ to, subject, html, attachments });

            if (result) {
                return result;
            }

            const isLastAttempt = attempt === maxRetries;
            console.error(`[EmailService] Attempt ${attempt}/${maxRetries} failed for ${to}`);
            if (!isLastAttempt) {
                await sleep(baseDelayMs * attempt);
            }
        }

        return null;
    },

    sendAdvisorOnboardingEmail: async (payload: {
        email: string;
        name: string;
        tempPassword: string;
        companyName?: string | null;
        companyLogoUrl?: string | null;
        portalUrl: string;
    }) => {
        const normalizedPortalUrl = payload.portalUrl.replace(/\/+$/, '');
        const logoUrl = payload.companyLogoUrl
            ? (payload.companyLogoUrl.startsWith('http') ? payload.companyLogoUrl : `${normalizedPortalUrl}${payload.companyLogoUrl}`)
            : null;

        const subject = 'Credenciales de acceso a Biometrics';
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2>Bienvenido(a), ${payload.name}</h2>
                <p>Tu registro como asesor se completó correctamente.</p>
                ${payload.companyName ? `<p><strong>Empresa asociada:</strong> ${payload.companyName}</p>` : '<p><strong>Empresa asociada:</strong> pendiente de asignación</p>'}
                ${logoUrl ? `<div style="margin: 12px 0 16px;"><img src="${logoUrl}" alt="Logo empresa" style="max-width: 180px; max-height: 72px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; padding: 6px; background: #fff;" /></div>` : ''}

                <div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin: 18px 0;">
                    <p style="margin: 4px 0;"><strong>Usuario:</strong> ${payload.email}</p>
                    <p style="margin: 4px 0;"><strong>Contraseña temporal:</strong> ${payload.tempPassword}</p>
                </div>

                <p><strong>Pasos para acceder:</strong></p>
                <ol>
                    <li>Ingresa al portal: <a href="${payload.portalUrl}">${payload.portalUrl}</a></li>
                    <li>Inicia sesión con las credenciales indicadas arriba.</li>
                    <li>Cambia tu contraseña en el primer inicio de sesión por seguridad.</li>
                </ol>

                <p>Si no reconoces este registro, contacta al administrador inmediatamente.</p>
            </div>
        `;

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
        });
    },

    sendClientBiometricEmail: async (payload: {
        id: string;
        email: string;
        name: string;
        companyName?: string | null;
        companyLogoUrl?: string | null;
        portalUrl: string;
        biometricMethods: BiometricMethod[];
    }) => {
        if (!payload.id || typeof payload.id !== 'string' || !UUID_REGEX.test(payload.id)) {
            console.error('[EmailService] sendClientBiometricEmail: clientId inválido o ausente:', payload.id);
            return null;
        }
        if (!Array.isArray(payload.biometricMethods) || payload.biometricMethods.length === 0) {
            console.error('[EmailService] sendClientBiometricEmail: biometricMethods está vacío o no es array');
            return null;
        }
        const uniqueValidMethods = [...new Set(payload.biometricMethods)].filter((m) =>
            VALID_BIOMETRIC_METHODS.includes(m)
        );
        if (uniqueValidMethods.length === 0) {
            console.error('[EmailService] sendClientBiometricEmail: no hay métodos biométricos válidos:', payload.biometricMethods);
            return null;
        }

        const normalizedPortalUrl = payload.portalUrl.replace(/\/+$/, '');
        const logoUrl = payload.companyLogoUrl
            ? (payload.companyLogoUrl.startsWith('http') ? payload.companyLogoUrl : `${normalizedPortalUrl}${payload.companyLogoUrl}`)
            : null;

        const verificationUrl = new URL(`${normalizedPortalUrl}/home`);
        verificationUrl.searchParams.set('clientId', payload.id);
        verificationUrl.searchParams.set('flow', 'quick-link');
        const verificationLink = verificationUrl.toString();

        const biometricLabels = uniqueValidMethods.map((m) => biometricMethodLabels[m]).join(', ');

        const subject = 'Solicitud de verificación biométrica';
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2>Bienvenido(a), ${payload.name}</h2>
                <p>Tu asesor ha solicitado el registro biométrico <strong>${biometricLabels}</strong>.</p>
                ${logoUrl ? `<div style="margin: 12px 0 16px;"><img src="${logoUrl}" alt="Logo empresa" style="max-width: 180px; max-height: 72px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; padding: 6px; background: #fff;" /></div>` : ''}
                <div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin: 18px 0;">
                    <p style="margin: 4px 0;"><strong>Usuario:</strong> ${payload.email}</p>
                    <p style="margin: 4px 0;"><strong>Verificación(es) solicitada(s):</strong> ${biometricLabels}</p>
                </div>

                <p><strong>Pasos para acceder:</strong></p>
                <ol>
                    <li>Ingresa al portal: <a href="${verificationLink}">${verificationLink}</a></li>
                    <li>Completa la(s) verificación(es) biométrica(s) indicada(s).</li>
                </ol>

                <p>Si no reconoces este registro, contacta al administrador inmediatamente.</p>
            </div>
        `;

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
        });
    },

    sendBiometricEnrollmentCompletedEmail: async (payload: {
        email: string;
        userId: string;
        name: string;
        companyName?: string | null;
        documentType?: string | null;
        documentNumber?: string | null;
        biometricMethods: BiometricMethod[];
        completedAt?: Date | null;
    }) => {
        const uniqueValidMethods = [...new Set(payload.biometricMethods)].filter((method) =>
            VALID_BIOMETRIC_METHODS.includes(method)
        );
        const biometricLabels = uniqueValidMethods.map((method) => biometricMethodLabels[method]).join(', ');
        const completedAt = payload.completedAt
            ? payload.completedAt.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
            : null;

        const subject = 'Solicitud biométrica completada correctamente';
        const pdfBuffer = await generateBiometricSummaryPdf({
            userId: payload.userId,
            name: payload.name,
            email: payload.email,
            companyName: payload.companyName,
            documentType: payload.documentType,
            documentNumber: payload.documentNumber,
            biometricMethods: uniqueValidMethods,
            completedAt: payload.completedAt,
        });
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2>Hola, ${payload.name}</h2>
                <p>Tu solicitud biométrica fue completada correctamente.</p>
                ${payload.companyName ? `<p><strong>Empresa:</strong> ${payload.companyName}</p>` : ''}
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
                    <p style="margin: 4px 0;"><strong>Solicitud completada:</strong> ${biometricLabels}</p>
                    ${completedAt ? `<p style="margin: 4px 0;"><strong>Fecha:</strong> ${completedAt}</p>` : ''}
                </div>
                <p>Adjunto a este correo se encuentra el documento de verificación.</p>

            </div>
        `;

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
            attachments: [
                {
                    filename: `biometria-${payload.userId}.pdf`,
                    content: pdfBuffer,
                },
            ],
        });
    }

};
