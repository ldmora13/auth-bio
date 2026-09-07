import { registry } from '../lib/openApi';

registry.registerPath({
    method: 'get',
    path: '/biometric-requests',
    description: 'List biometric enrollment requests with email delivery status (Admin only)',
    summary: 'Get Biometric Requests',
    tags: ['BiometricRequests'],
    security: [{ cookieAuth: [] }],
    responses: {
        200: { description: 'List of biometric requests' },
        403: { description: 'Forbidden' },
        401: { description: 'Unauthorized' },
    },
});