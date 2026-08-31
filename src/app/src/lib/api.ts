export function buildApiUrl(pathOrUrl: string, apiBase = import.meta.env.VITE_API_URL): string {
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	if (!apiBase) throw new Error('VITE_API_URL is not configured');
	return `${apiBase.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\.?\//, '')}`;
}
