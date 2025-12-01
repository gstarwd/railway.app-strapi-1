const ensureAdminUrlPath = (rawUrl: string | undefined) => {
  const fallback = '/admin';
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  if (!value || value === '/') {
    return fallback;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const cleanedPath = parsed.pathname.replace(/\/+$/, '');
      parsed.pathname = cleanedPath && cleanedPath !== '' ? cleanedPath : '/admin';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return fallback;
    }
  }

  const withoutTrailingSlash = value.replace(/\/+$/, '');

  return withoutTrailingSlash || fallback;
};

export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  url: ensureAdminUrlPath(env('ADMIN_URL', '/admin')),
});
