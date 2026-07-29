/** Can list users API (advisors/clients). */
export function canListUsersForStaff(role: string): boolean {
    return role === 'ADMIN' || role === 'ADVISOR';
}

/** Can create users. */
export function canCreateUsers(role: string): boolean {
    return role === 'ADMIN' || role === 'ADVISOR';
}

/** Can manage companies. */
export function canManageCompanies(role: string): boolean {
    return role === 'ADMIN';
}

/** What roles can a user create? */
export function allowedRolesToCreate(creatorRole: string): string[] {
    if (creatorRole === 'ADMIN') {
        return ['ADVISOR'];
    }
    if (creatorRole === 'ADVISOR') {
        return ['CLIENT'];
    }
    return [];
}
