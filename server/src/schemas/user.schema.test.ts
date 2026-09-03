import { describe, expect, it } from 'vitest';
import { completeBiometricEnrollmentSchema, updateUserSchema } from './user.schema';

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

describe('updateUserSchema', () => {
  it('accepts empty optional fields sent by the client editor', async () => {
    await expect(updateUserSchema.parseAsync({
      body: {
        email: 'updated@example.com',
        name: 'Updated Client',
        address: 'Main Street',
        phone: '',
        birthDate: '',
        profilePhotoUrl: 'https://media.smartbiometrics.org/company/profile.jpg',
        documentType: 'CC',
        documentNumber: '12345678',
        caseNumber: '',
        processNumber: '',
        formId: '',
        nativeCountry: '',
        sex: '',
        validFrom: '',
        cardExpires: '',
        migratoryStatus: '',
        receivedDate: '',
        deadline: '',
      },
      params: { id: 'user-id' },
    })).resolves.toMatchObject({
      body: {
        email: 'updated@example.com',
        phone: undefined,
        profilePhotoUrl: 'https://media.smartbiometrics.org/company/profile.jpg',
      },
    });
  });
});
