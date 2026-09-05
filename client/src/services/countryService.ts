import api from '../lib/api';

export interface CountryOption {
    code: string;
    name: string;
}

export async function getCountryOptions(signal?: AbortSignal): Promise<CountryOption[]> {
    const { data } = await api.get<{ countries: CountryOption[] }>('/countries', { signal });
    return data.countries;
}
