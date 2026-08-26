import { S3Client } from '@aws-sdk/client-s3';

type R2Config = {
	client: S3Client;
	bucketName: string;
	publicUrl: string;
};

let r2Config: R2Config | null | undefined;

function normalizePublicUrl(value: string): string {
	if (value.startsWith('http://') || value.startsWith('https://')) {
		return value.replace(/\/$/, '');
	}

	return `https://${value.replace(/^\/+/, '').replace(/\/$/, '')}`;
}

export function getR2Config(): R2Config | null {
	if (r2Config !== undefined) {
		return r2Config;
	}

	const accountId = process.env.R2_ACCOUNT_ID?.trim();
	const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
	const bucketName = process.env.R2_BUCKET_NAME?.trim();
	const configuredPublicUrl = process.env.R2_PUBLIC_URL?.trim();
	const publicUrl = configuredPublicUrl ? normalizePublicUrl(configuredPublicUrl) : undefined;

	const configuredValues = [accountId, accessKeyId, secretAccessKey, bucketName, publicUrl];
	if (configuredValues.every(Boolean)) {
		r2Config = {
			client: new S3Client({
				region: 'auto',
				endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
				credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
			}),
			bucketName: bucketName!,
			publicUrl: publicUrl!,
		};
	} else if (configuredValues.every((value) => !value)) {
		r2Config = null;
	} else {
		throw new Error(
			'R2 configuration is incomplete. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL.'
		);
	}

	return r2Config;
}
