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
