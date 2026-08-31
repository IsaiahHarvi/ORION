import { env } from '$env/dynamic/public';

/**
 * Base URL for the ORION API.
 *
 * Read at runtime rather than inlined by Vite at build time: the published
 * image has to work for whoever is hosting it, not only for the domain it was
 * built on. Defaults to a same-origin `/api`, which is the documented topology
 * -- one ingress serving the GUI at `/` and the API at `/api` -- so a
 * self-hoster needs no configuration at all. Set PUBLIC_ORION_API_URL when the
 * API is on another origin, as it is when running the two dev servers.
 */
export function apiBaseUrl(): string {
	return env.PUBLIC_ORION_API_URL || '/api';
}

export function buildApiUrl(pathOrUrl: string, apiBase = apiBaseUrl()): string {
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	return `${apiBase.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\.?\//, '')}`;
}
