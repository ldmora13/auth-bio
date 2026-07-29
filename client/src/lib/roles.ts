export function isAdminOnly(role?: string | null): boolean {
    return role === 'ADMIN';
}

export function canCreateAdvisor(role?: string | null): boolean {
    return role === 'ADMIN';
}

export function canCreateClient(role?: string | null): boolean {
    return role === 'ADVISOR';
}

export function canManageCompanies(role?: string | null): boolean {
    return role === 'ADMIN';
}

export function canAccessCompanies(role?: string | null): boolean {
    return role === 'ADMIN' || role === 'ADVISOR';
}

export function canManageClients(role?: string | null): boolean {
    return role === 'ADVISOR';
}
