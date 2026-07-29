import { registry } from '../lib/openApi';
import { z } from 'zod';

registry.registerPath({
    method: 'get',
    path: '/stats/users',
    description: 'Get total number of users',
    summary: 'Get User Stats',
    tags: ['Stats'],
    security: [{ cookieAuth: [] }],
    responses: {
        200: {
            description: 'User stats',
            content: {
                'application/json': {
                    schema: z.object({
                        stats: z.object({
                            totalUsers: z.number(),
                        }),
                    }),
                },
            },
        },
        401: { description: 'Unauthorized' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/stats/dashboard',
    description: 'Get dashboard stats segmented by authenticated user role',
    summary: 'Get Dashboard Stats',
    tags: ['Stats'],
    security: [{ cookieAuth: [] }],
    responses: {
        200: {
            description: 'Dashboard stats for admin or advisor',
            content: {
                'application/json': {
                    schema: z.object({
                        stats: z.record(z.string(), z.any()),
                    }),
                },
            },
        },
        401: { description: 'Unauthorized' },
    },
});
