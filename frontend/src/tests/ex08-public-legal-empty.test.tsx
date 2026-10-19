import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PrivacyPage from '@/app/politica-de-privacidad/page';
import { getPublishedLegal } from '@/lib/api/legal';

// Keep the page, publication reader and renderer real; the shell requires unrelated cart/network contexts.
vi.mock('@/components/layout/StorefrontShell', () => ({
  StorefrontShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
const pageKey = 'politica-de-privacidad';
const timestamp = '2026-10-14T20:00:00.000Z';
const publication = (content: unknown) => ({
  pageKey, slug: pageKey, title: 'Technical empty publication', version: 3,
  publishedAt: timestamp, content,
});
const emptyContents = [
  { text: '' }, { notice: '' }, { sections: [] },
];
function respond(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('recognized empty legal publication contract', () => {
  it.each(emptyContents)('retains actual publication metadata and empty content %#', async (content) => {
    respond(publication(content));
    const result = await getPublishedLegal(pageKey);
    expect(result).toEqual({ status: 'published', document: publication(content) });
  });

  it.each(emptyContents)('shows the saved publication as empty, without claiming service failure %#', async (content) => {
    respond(publication(content));
    const view = render(await PrivacyPage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Technical empty publication');
    expect(screen.getByText('Documento publicado')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(view.container.querySelector('time')).toHaveAttribute('datetime', timestamp);
    expect(screen.getByRole('status')).toHaveTextContent(/versión publicada.*no contiene texto/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Aviso de revisión pendiente')).not.toBeInTheDocument();
    expect(view.container.querySelector('article section')).toBeNull();
  });

  it.each([
    { text: ' \n ', notice: '\t', sections: [] },
    { sections: [{ title: '', body: '   ' }] },
  ])('truthfully identifies recognized whitespace-only publication content %#', async (content) => {
    respond(publication(content));
    render(await PrivacyPage());
    expect(screen.getByRole('status')).toHaveTextContent(/versión publicada.*no contiene texto/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    { text: 'Actual saved text' }, { notice: 'Actual saved notice' },
    { sections: [{ title: 'Actual heading', body: 'Actual section body' }] },
  ])('does not label nonempty published text as empty %#', async (content) => {
    respond(publication(content));
    render(await PrivacyPage());
    expect(screen.getByText('Documento publicado')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    {}, { unsupported: 'Not a recognized body' }, { text: null }, { notice: 0 },
    { sections: null }, { sections: [{}] }, { sections: [{ title: 'Title', body: {} }] },
  ])('keeps unsupported or malformed content unavailable %#', async (content) => {
    respond(publication(content));
    render(await PrivacyPage());
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByText('Documento publicado')).not.toBeInTheDocument();
    expect(screen.queryByText('Aviso de revisión pendiente')).not.toBeInTheDocument();
  });

  it.each([
    { ...publication({ text: '' }), publishedAt: null },
    { ...publication({ text: '' }), publishedById: 'private-actor' },
    { ...publication({ text: '' }), checklist: { private: true } },
    { ...publication({ text: '' }), pageKey: 'wrong-document' },
  ])('does not allow empty content to bypass publication identity or private metadata rejection %#', async (body) => {
    respond(body);
    render(await PrivacyPage());
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByText('Documento publicado')).not.toBeInTheDocument();
    expect(screen.queryByText('private-actor')).not.toBeInTheDocument();
  });
});
