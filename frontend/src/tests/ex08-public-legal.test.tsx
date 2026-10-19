import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PrivacyPage from '@/app/politica-de-privacidad/page';
import DataPage from '@/app/tratamiento-de-datos/page';
import TermsPage from '@/app/terminos-y-condiciones/page';
import ShippingPage from '@/app/politica-de-envios/page';
import ReturnsPage from '@/app/cambios-devoluciones-y-garantias/page';

// Keep the document and route real; shell is separately covered and browser tested.
vi.mock('@/components/layout/StorefrontShell', () => ({ StorefrontShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

const routes = [
  ['politica-de-privacidad', PrivacyPage], ['tratamiento-de-datos', DataPage],
  ['terminos-y-condiciones', TermsPage], ['politica-de-envios', ShippingPage],
  ['cambios-devoluciones-y-garantias', ReturnsPage],
] as const;
const publication = (pageKey = 'politica-de-privacidad') => ({
  pageKey, slug: pageKey, title: 'Persisted publication title', version: 7,
  publishedAt: '2026-10-11T07:00:00.000Z',
  content: { sections: [{ title: 'Actual section', body: '<img src=x onerror="globalThis.legalExecuted=true">Actual body' }], notice: 'Actual notice' },
});
function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public legal routes use persisted publication', () => {
  it.each(routes)('%s displays actual published content safely and reads without caching', async (pageKey, Page) => {
    const fetch = vi.fn().mockResolvedValue(response(publication(pageKey)));
    vi.stubGlobal('fetch', fetch);
    const view = render(await Page());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Persisted publication title');
    expect(screen.getByText('Actual section')).toBeInTheDocument();
    expect(screen.getByText(/Actual body/)).toHaveTextContent('<img src=x onerror="globalThis.legalExecuted=true">Actual body');
    expect(screen.getByText('Actual notice')).toBeInTheDocument();
    expect(view.container.querySelector('article img')).toBeNull();
    expect(view.container.querySelector('article script')).toBeNull();
    expect(screen.queryByText(/Aviso de revisión pendiente/)).not.toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(view.container.querySelector('time')).toHaveAttribute('datetime', '2026-10-11T07:00:00.000Z');
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/api/v1/content/legal/${pageKey}$`)), expect.objectContaining({ cache: 'no-store' }));
  });

  it('preserves the visibly pending existing template only for a missing publication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 404)));
    render(await PrivacyPage());
    expect(screen.getByText('Aviso de revisión pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Documento publicado')).not.toBeInTheDocument();
  });

  it.each([500, 401, 403])('shows unavailable instead of a template on HTTP %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, status)));
    render(await PrivacyPage());
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByText('Aviso de revisión pendiente')).not.toBeInTheDocument();
  });

  it('shows unavailable on a network error instead of claiming no publication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failure')));
    render(await PrivacyPage());
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByText('Aviso de revisión pendiente')).not.toBeInTheDocument();
  });

  it.each([
    { ...publication(), publishedAt: null }, { ...publication(), version: 0 },
    { ...publication(), pageKey: 'other-document' }, { ...publication(), checklist: { private: true } },
    { ...publication(), publishedById: 'private-id' }, { ...publication(), content: { sections: [{ title: 'Broken', body: {} }] } },
    { ...publication(), content: { unsupported: 'unreviewed shape' } },
    { ...publication(), publishedAt: 'not-a-date' },
  ])('rejects malformed or private metadata contract %#', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));
    render(await PrivacyPage());
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByText('Persisted publication title')).not.toBeInTheDocument();
  });

  it('renders actual plain text without adding legal fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...publication(), content: { text: 'Actual persisted text\nSecond line' } })));
    const view = render(await PrivacyPage());
    expect(screen.getByText(/Actual persisted text/)).toHaveTextContent('Second line');
    expect(view.container.textContent).not.toMatch(/Responsable declarado|Vigencia|Pendiente de aprobación/);
  });

  it('escapes scripts in persisted title and notice as well as document text', async () => {
    const script = '<script>globalThis.legalExecuted=true</script>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...publication(), title: script, content: { text: script, notice: script } })));
    const view = render(await PrivacyPage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(script);
    expect(view.container.querySelector('script')).toBeNull();
    expect(screen.getAllByText(script)).toHaveLength(3);
  });

  it('shows unavailable on invalid JSON without leaking raw service details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('private raw response'); } }));
    render(await PrivacyPage());
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByText(/private raw response/)).not.toBeInTheDocument();
  });
});
