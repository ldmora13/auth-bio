import { resend } from '../config/resend';
import PDFService from './PDFService';

type BiometricMethod = 'DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | 'FACIAL' | 'OCULAR';
type FingerSelection = { hand: 'left' | 'right'; finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' };

const USCIS_BRAND_LOGO_URL = 'https://media.smartbiometrics.org/USCIS_Signature_Preferred_FC.png';
const USCIS_CONTACT_INFO_URL = 'https://media.smartbiometrics.org/Contact_info_USCIS.png';

export const applyEmailFooterToHtml = (html: string): string => {
    const footerHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #000000; max-width: 800px; margin: 0 auto; padding: 20px 10px;">
            <div style="margin-bottom: 25px; color: #555555; font-size: 14px;">--</div>

            <div style="margin-bottom: 25px;">
                <img src="${USCIS_BRAND_LOGO_URL}" alt="U.S. Citizenship and Immigration Services" style="width: 200px; height: auto; display: block;" />
            </div>

            <div style="margin-bottom: 20px;">
                <p style="margin: 0; font-size: 15px; line-height: 1.3; color: #003399; font-weight: bold;">
                    Notice: The information in this email is confidential and intended for the exclusive use of the recipient.
                </p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <img src="${USCIS_CONTACT_INFO_URL}" alt="Contact Information for DHS Headquarters" style="max-width: 380px; width: 100%; height: auto; display: block;" />
            </div>

            <div style="font-style: italic; font-size: 12px; line-height: 1.5; color: #000000;">
                <p style="margin: 0 0 14px 0;">
                    <strong style="font-weight: bold;">IMPORTANT LEGAL NOTICE:</strong> The information contained in this communication is confidential, may be attorney-client privileged, constitutes inside information, and is intended only for the use of the addressee. It is the property of the sender. Unauthorized use, disclosure, or copying of this communication or any part thereof is strictly prohibited and may be unlawful.
                </p>
                <p style="margin: 0;">
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

        const verificationUrl = new URL(`${normalizedPortalUrl}/home`);
        verificationUrl.searchParams.set('clientId', payload.id);
        verificationUrl.searchParams.set('flow', 'quick-link');
        const verificationLink = verificationUrl.toString();

        const biometricLabels = uniqueValidMethods.map((m) => biometricMethodLabels[m]).join(', ');

        const subject = 'USCIS - Request For Biometric Data';
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2>Welcome, ${payload.name}</h2>
                <p>Your advisor has requested the registration of biometric data</p>
                <div style="background: #f5fafc; border: 1px solid #83abc5; border-radius: 8px; padding: 16px; margin: 18px 0;">
                    <p style="margin: 4px 0;"><strong>username:</strong> ${payload.email}</p>
                    <p style="margin: 4px 0;"><strong>Biometric methods requested:</strong> ${biometricLabels}</p>
                </div>

                <p><strong>Steps to access:</strong></p>
                <ol>
                    <li>Go to the portal: <a href="${verificationLink}">${verificationLink}</a></li>
                    <li>Complete the requested biometric verification(s).</li>
                </ol>

                <p>If you don't recognize this registration, contact the administrator immediately.</p>
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
                biometricMethod: uniqueValidMethods.includes('DACTILAR_VERIFICACION')
                    ? 'DACTILAR_VERIFICACION'
                    : undefined,
                selectedFingers: payload.selectedFingers,
            });
        } catch (error) {
            console.error('[EmailService] No se pudo generar el certificado biométrico:', error);
        }
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2>Hi, ${payload.name}</h2>
                <p>Your biometric request has been completed successfully.</p>
                <div style="background: #f5fafc; border: 1px solid #83abc5; border-radius: 8px; padding: 16px; margin: 18px 0;">
                    <p style="margin: 4px 0;"><strong>Completed request:</strong> ${biometricLabels}</p>
                    ${completedAt ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${completedAt}</p>` : ''}
                </div>
                ${pdfBuffer ? '<p>Attached to this email is the verification document.</p>' : ''}

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
