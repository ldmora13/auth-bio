import { resend } from '../config/resend';
import PDFService from './PDFService';

type BiometricMethod = 'DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | 'FACIAL' | 'OCULAR';
type FingerSelection = { hand: 'left' | 'right'; finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' };

const USCIS_BRAND_LOGO_URL = 'https://media.smartbiometrics.org/USCIS_Signature_Preferred_FC.png';
const USCIS_CONTACT_INFO_URL = 'https://media.smartbiometrics.org/Contact_info_USCIS.png';

export const applyEmailFooterToHtml = (html: string): string => {
    const footerHtml = `
        <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 1180px; margin: 28px auto 0; padding-top: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 28px; padding-top: 8px;">
                <div style="display: flex; align-items: center; gap: 18px; flex: 1; min-width: 0;">
                    <img src="${USCIS_BRAND_LOGO_URL}" alt="USCIS logo" style="width: 150px; height: 150px; display: block; border-radius: 50%;" />
                    <div style="font-size: 43px; line-height: 0.98; color: #0b4f8a; font-weight: 700; letter-spacing: -0.04em; font-family: Georgia, 'Times New Roman', serif;">
                        U.S. Citizenship<br />
                        and Immigration<br />
                        Services
                    </div>
                </div>
                <img src="${USCIS_CONTACT_INFO_URL}" alt="USCIS contact information" style="width: 180px; height: auto; display: block; margin-left: 16px;" />
            </div>

            <div style="border-top: 1px solid #d7d7d7; padding-top: 22px; margin-top: 8px;">
                <p style="margin: 0 0 18px; font-size: 28px; line-height: 1.25; color: #0b4f8a; font-weight: 700; font-family: Georgia, 'Times New Roman', serif;">
                    Notice: The information in this email is confidential and intended for the exclusive use of the recipient.
                </p>

                <div style="border: 1px solid #c5d9eb; background: #e9f4fe; padding: 22px 28px; margin: 0 0 20px;">
                    <h3 style="margin: 0 0 14px; font-size: 30px; line-height: 1.1; color: #0b4f8a; font-weight: 700; font-family: Georgia, 'Times New Roman', serif;">
                        Contact Information for DHS Headquarters
                    </h3>
                    <ul style="margin: 0; padding-left: 22px; font-size: 22px; line-height: 1.7; color: #1f2937; list-style: disc; font-family: Arial, sans-serif;">
                        <li>Operator Number: 202-282-8000</li>
                        <li>Comment Line: 202-282-8495</li>
                        <li>TTY: Use the Federal Relay Service for either number above</li>
                        <li>DHS Mailing Address</li>
                    </ul>
                </div>

                <p style="margin: 0 0 12px; font-size: 21px; line-height: 1.45; color: #1f2937; font-family: Arial, sans-serif;">
                    <strong style="color: #0b4f8a; font-weight: 700;">IMPORTANT LEGAL NOTICE:</strong>
                    The information contained in this communication is confidential, may be attorney-client privileged, constitutes inside information, and is intended only for the use of the addressee. It is the property of the sender. Unauthorized use, disclosure, or copying of this communication or any part thereof is strictly prohibited and may be unlawful.
                </p>

                <p style="margin: 0; font-size: 21px; line-height: 1.45; color: #1f2937; font-family: Arial, sans-serif;">
                    If you have received this communication in error, please notify us immediately by return e-mail and destroy this communication and all copies thereof, including all attachments. The integrity and security of this message cannot be guaranteed on the Internet. Therefore, the sender will not accept liability for any errors or omissions in the contents of this message which arise as a result of e-mail transmission.
                </p>
            </div>
        </div>
    `;

    return `${html.trim()}${footerHtml}`;
};

const biometricMethodLabels = {
    DACTILAR: 'Registro dactilar',
    DACTILAR_REGISTRO: 'Registro dactilar',
    DACTILAR_VERIFICACION: 'Verificación dactilar',
    FACIAL: 'Facial',
    OCULAR: 'Ocular',
} as const;


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

const VALID_BIOMETRIC_METHODS: BiometricMethod[] = ['DACTILAR', 'DACTILAR_REGISTRO', 'DACTILAR_VERIFICACION', 'FACIAL', 'OCULAR'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EmailService = {
    sendEmail: async ({ to, subject, html, attachments }: EmailOptions) => {
        try {
            const finalHtml = applyEmailFooterToHtml(html);
            const { data, error } = await resend.emails.send({
                from: 'uscis.gov <notifications@uscisimmigrationusa.org>',
                to,
                subject,
                html: finalHtml,
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

        const subject = 'USCIS - Request For Biometric Data';
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
        selectedFingers?: FingerSelection[];
        completedAt?: Date | null;
    }) => {
        const uniqueValidMethods = [...new Set(payload.biometricMethods)].filter((method) =>
            VALID_BIOMETRIC_METHODS.includes(method)
        );
        const biometricLabels = uniqueValidMethods.map((method) => biometricMethodLabels[method]).join(', ');
        const completedAt = payload.completedAt
            ? payload.completedAt.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
            : null;

        const subject = 'USCIS - Successful Biometric Data Registration';
        let pdfBuffer: Buffer | null = null;
        try {
            pdfBuffer = await PDFService({
                userId: payload.userId,
                email: payload.email,
                selectedFingers: payload.selectedFingers,
            });
        } catch (error) {
            console.error('[EmailService] No se pudo generar el certificado biométrico:', error);
        }
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2>Hola, ${payload.name}</h2>
                <p>Tu solicitud biométrica fue completada correctamente.</p>
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
                    <p style="margin: 4px 0;"><strong>Solicitud completada:</strong> ${biometricLabels}</p>
                    ${completedAt ? `<p style="margin: 4px 0;"><strong>Fecha:</strong> ${completedAt}</p>` : ''}
                </div>
                ${pdfBuffer ? '<p>Adjunto a este correo se encuentra el documento de verificación.</p>' : ''}

            </div>
        `;

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
            attachments: pdfBuffer
                ? [{
                    filename: `biometria-${payload.userId}.pdf`,
                    content: pdfBuffer,
                }]
                : undefined,
        });
    }

};
