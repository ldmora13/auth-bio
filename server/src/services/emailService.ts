import { resend } from '../config/resend';

const biometricMethodLabels = {
    DACTILAR: 'Dactilar',
    FACIAL: 'Facial',
    OCULAR: 'Ocular',
} as const;

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

interface SendEmailRetryOptions extends EmailOptions {
    maxRetries?: number;
    baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_BIOMETRIC_METHODS = ['DACTILAR', 'FACIAL', 'OCULAR'] as const;

export const EmailService = {
    sendEmail: async ({ to, subject, html }: EmailOptions) => {
        try {
            const { data, error } = await resend.emails.send({
                from: 'noreplay <noreplay@updates.smartbiometrics.org>',
                to,
                subject,
                html,
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

    sendEmailWithRetry: async ({ to, subject, html, maxRetries = 3, baseDelayMs = 500 }: SendEmailRetryOptions) => {
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            const result = await EmailService.sendEmail({ to, subject, html });

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
        biometricMethods: ('DACTILAR' | 'FACIAL' | 'OCULAR')[];
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
    }

};
