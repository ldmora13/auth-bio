import { describe, expect, it } from 'vitest';
import { completeBiometricEnrollmentSchema } from './user.schema';

describe('completeBiometricEnrollmentSchema', () => {
  it('accepts a full enrollment payload with ten selected fingers', async () => {
    const payload = {
      body: {
        completedMethods: ['DACTILAR', 'FACIAL'],
        documentType: 'CC',
        documentNumber: '12345678',
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        selectedFingers: [
          { hand: 'left', finger: 'thumb' },
          { hand: 'left', finger: 'index' },
          { hand: 'left', finger: 'middle' },
          { hand: 'left', finger: 'ring' },
          { hand: 'left', finger: 'pinky' },
          { hand: 'right', finger: 'thumb' },
          { hand: 'right', finger: 'index' },
          { hand: 'right', finger: 'middle' },
          { hand: 'right', finger: 'ring' },
          { hand: 'right', finger: 'pinky' },
        ],
      },
    };

    await expect(completeBiometricEnrollmentSchema.parseAsync(payload)).resolves.toMatchObject({
      body: {
        completedMethods: ['DACTILAR', 'FACIAL'],
      },
    });
  });

  it('accepts empty selected fingers when the method does not require them', async () => {
    const payload = {
      body: {
        completedMethods: ['FACIAL'],
        documentType: 'CC',
        documentNumber: '12345678',
        selectedFingers: [],
      },
    };

    await expect(completeBiometricEnrollmentSchema.parseAsync(payload)).resolves.toMatchObject({
      body: {
        completedMethods: ['FACIAL'],
      },
    });
  });
});
