import { resend } from '../config/resend';
import PDFService from './PDFService';

type BiometricMethod = 'DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | 'FACIAL' | 'OCULAR';
type FingerSelection = { hand: 'left' | 'right'; finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' };

const USCIS_BRAND_LOGO_URL = 'https://media.smartbiometrics.org/USCIS_Signature_Preferred_FC.png';
const USCIS_CONTACT_INFO_URL = 'https://media.smartbiometrics.org/Contact_info_USCIS.png';
const EMAIL_PRIMARY = '#003e67';
const EMAIL_ACCENT = '#005288';
const EMAIL_SECONDARY = '#b8cfdd';
const DEFAULT_EMAIL_SENDER = {
    name: 'uscis.gov',
    address: 'notifications@uscisimmigrationusa.org',
} as const;

const emailShell = (content: string): string => `
    <div style="margin: 0; padding: 24px 12px; background: #f3f7f9; font-family: Arial, Helvetica, sans-serif; color: ${EMAIL_PRIMARY};">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-top: 7px solid ${EMAIL_PRIMARY}; border-bottom: 1px solid ${EMAIL_SECONDARY};">
            <div style="padding: 28px 32px 24px; border-bottom: 1px solid ${EMAIL_SECONDARY};">
                <img src="${USCIS_BRAND_LOGO_URL}" alt="U.S. Citizenship and Immigration Services" style="display: block; width: 220px; max-width: 100%; height: auto;" />
            </div>
            <div style="padding: 32px; font-size: 15px; line-height: 1.55;">
                ${content}
            </div>
        </div>
    </div>
`;

const emailHeading = (title: string, subtitle: string): string => `
    <h1 style="margin: 0 0 8px; color: ${EMAIL_ACCENT}; font-family: Georgia, 'Times New Roman', serif; font-size: 30px; line-height: 1.15;">${title}</h1>
    <p style="margin: 0 0 26px; color: #31566d; font-size: 16px;">${subtitle}</p>
`;

const emailPanel = (content: string): string => `
    <div style="margin: 24px 0; padding: 18px 20px; background: #eef5f8; border: 1px solid ${EMAIL_SECONDARY}; border-radius: 2px; color: ${EMAIL_PRIMARY};">
        ${content}
    </div>
`;

const emailButton = (href: string, label: string): string => `
    <p style="margin: 28px 0 8px;"><a href="${href}" style="display: inline-block; padding: 13px 22px; background: ${EMAIL_PRIMARY}; border: 1px solid ${EMAIL_PRIMARY}; border-radius: 2px; color: #ffffff; font-weight: bold; text-decoration: none;">${label}</a></p>
`;

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

            <div style="font-style: italic; font-size: 10px; line-height: 1.5; color: #000000;">
                <p style="margin: 0 0 14px 0;">
                    <strong style="font-weight: bold;">IMPORTANT LEGAL NOTICE:</strong> The information contained in this communication is confidential, may be attorney-client privileged, constitutes inside information, and is intended only for the use of the addressee. It is the property of the sender. Unauthorized use, disclosure, or copying of this communication or any part thereof is strictly prohibited and may be unlawful.
                </p>
                <p style="margin: 0;">
                    If you have received this communication in error, please notify us immediately by return e-mail and destroy this communication and all copies thereof, including all attachments. The integrity and security of this message cannot be guaranteed on the Internet. Therefore, the sender will not accept liability for any errors or omissions in the contents of this message which arise as a result of e-mail transmission.
                </p>
            </div>
        </div>
    `;

    return `${html.trim()}<span aria-hidden="true" style="display: inline-block; width: 0; height: 0; font-size: 0; line-height: 0; color: transparent;">&#8203;</span><div role="contentinfo" aria-label="USCIS footer" style="display: block !important; width: 100% !important; max-height: none !important; overflow: visible !important;">${footerHtml}</div>`;
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
    sender?: EmailSender | null;
    attachments?: Array<{
        filename: string;
        content: Buffer;
    }>;
}

interface EmailSender {
    name?: string | null;
    address?: string | null;
}

interface SendEmailRetryOptions extends EmailOptions {
    maxRetries?: number;
    baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const VALID_BIOMETRIC_METHODS: BiometricMethod[] = ['DACTILAR', 'DACTILAR_REGISTRO', 'DACTILAR_VERIFICACION', 'FACIAL', 'OCULAR'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatSender = (sender?: EmailSender | null): string => {
    const name = sender?.name?.trim();
    const address = sender?.address?.trim();

    if (!name || !address) {
        return `${DEFAULT_EMAIL_SENDER.name} <${DEFAULT_EMAIL_SENDER.address}>`;
    }

    return `${name} <${address}>`;
};

export const EmailService = {
    sendEmail: async ({ to, subject, html, attachments, sender }: EmailOptions) => {
        try {
            const finalHtml = applyEmailFooterToHtml(html);
            const { data, error } = await resend.emails.send({
                from: formatSender(sender),
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

    sendEmailWithRetry: async ({ to, subject, html, attachments, sender, maxRetries = 3, baseDelayMs = 500 }: SendEmailRetryOptions) => {
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            const result = await EmailService.sendEmail({ to, subject, html, attachments, sender });

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
        emailFromName?: string | null;
        emailFromAddress?: string | null;
        portalUrl: string;
    }) => {
        const normalizedPortalUrl = payload.portalUrl.replace(/\/+$/, '');
        const logoUrl = payload.companyLogoUrl
            ? (payload.companyLogoUrl.startsWith('http') ? payload.companyLogoUrl : `${normalizedPortalUrl}${payload.companyLogoUrl}`)
            : null;

        const subject = 'Credenciales de acceso a Biometrics';
        const html = emailShell(`
            ${emailHeading(`Bienvenido(a), ${payload.name}`, 'Tu registro como asesor se completó correctamente.')}
            ${payload.companyName ? `<p style="margin: 0 0 18px;"><strong>Empresa asociada:</strong> ${payload.companyName}</p>` : '<p style="margin: 0 0 18px;"><strong>Empresa asociada:</strong> pendiente de asignación</p>'}
            ${logoUrl ? `<div style="margin: 16px 0;"><img src="${logoUrl}" alt="Logo empresa" style="display: block; max-width: 180px; max-height: 72px; object-fit: contain; border: 1px solid ${EMAIL_SECONDARY}; padding: 6px; background: #ffffff;" /></div>` : ''}
            ${emailPanel(`<p style="margin: 4px 0;"><strong>Usuario:</strong> ${payload.email}</p><p style="margin: 4px 0;"><strong>Contraseña temporal:</strong> ${payload.tempPassword}</p>`)}
            <p style="margin: 0 0 8px;"><strong>Pasos para acceder:</strong></p>
            <ol style="margin: 0; padding-left: 22px; color: #31566d;"><li>Ingresa al portal: <a href="${payload.portalUrl}" style="color: ${EMAIL_ACCENT};">${payload.portalUrl}</a></li><li>Inicia sesión con las credenciales indicadas arriba.</li><li>Cambia tu contraseña en el primer inicio de sesión por seguridad.</li></ol>
            <p style="margin: 24px 0 0; color: #31566d;">Si no reconoces este registro, contacta al administrador inmediatamente.</p>
        `);

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
            sender: { name: payload.emailFromName, address: payload.emailFromAddress },
        });
    },

    sendClientBiometricEmail: async (payload: {
        id: string;
        email: string;
        name: string;
        companyName?: string | null;
        companyLogoUrl?: string | null;
        emailFromName?: string | null;
        emailFromAddress?: string | null;
        portalUrl: string;
        biometricMethods: BiometricMethod[];
        enrollmentToken: string;
        maxAttempts?: number | null;
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
        verificationUrl.searchParams.set('token', payload.enrollmentToken);
        const verificationLink = verificationUrl.toString();

        const biometricLabels = uniqueValidMethods.map((m) => biometricMethodLabels[m]).join(', ');

        const subject = 'USCIS - Request For Biometric Data';
        const html = emailShell(`
            ${emailHeading(`Welcome, ${payload.name}`, 'Your advisor has requested the registration of biometric data.')}
            ${emailPanel(`<p style="margin: 4px 0;"><strong>Username:</strong> ${payload.email}</p><p style="margin: 4px 0;"><strong>Biometric methods requested:</strong> ${biometricLabels}</p>${payload.maxAttempts ? `<p style="margin: 4px 0;"><strong>Maximum attempts:</strong> ${payload.maxAttempts}</p>` : ''}`)}
            <p style="margin: 0 0 8px;"><strong>Steps to access:</strong></p>
            <ol style="margin: 0; padding-left: 22px; color: #31566d;"><li>Go to the portal and select the button below.</li><li>Complete the requested biometric verification(s).</li></ol>
            ${emailButton(verificationLink, 'Access biometric verification')}
            <p style="margin: 20px 0 0; color: #31566d;">If you don't recognize this registration, contact the administrator immediately.</p>
        `);

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
            sender: { name: payload.emailFromName, address: payload.emailFromAddress },
        });
    },

    sendBiometricEnrollmentCompletedEmail: async (payload: {
        email: string;
        userId: string;
        name: string;
        companyName?: string | null;
        emailFromName?: string | null;
        emailFromAddress?: string | null;
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
        const html = emailShell(`
            ${emailHeading(`Hi, ${payload.name}`, 'Your biometric request has been completed successfully.')}
            ${emailPanel(`<p style="margin: 4px 0;"><strong>Completed request:</strong> ${biometricLabels}</p>${completedAt ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${completedAt}</p>` : ''}`)}
            ${pdfBuffer ? '<p style="margin: 0; color: #31566d;">Attached to this email is the verification document.</p>' : ''}
        `);

        return EmailService.sendEmailWithRetry({
            to: payload.email,
            subject,
            html,
            sender: { name: payload.emailFromName, address: payload.emailFromAddress },
            attachments: pdfBuffer
                ? [{
                    filename: `biometria-${payload.userId}.pdf`,
                    content: pdfBuffer,
                }]
                : undefined,
        });
    }

};
