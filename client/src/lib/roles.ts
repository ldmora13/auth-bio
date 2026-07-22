export function isAdminOnly(role?: string | null): boolean {
    return role === 'ADMIN';
}

export function canAccessUsersPage(role?: string | null): boolean {
    return role === 'ADMIN' || role === 'ADVISOR';
}

export function canCreateAdvisor(role?: string | null): boolean {
    return role === 'ADMIN';
}
