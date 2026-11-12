import dotenv from 'dotenv';

dotenv.config();

export const smtpHost = process.env.SMTP_HOST?.trim();
export const smtpPort = Number(process.env.SMTP_PORT ?? '587');
export const smtpSecure = process.env.SMTP_SECURE === 'true';
export const smtpUser = process.env.SMTP_USER?.trim();
export const smtpPassword = process.env.SMTP_PASS;
