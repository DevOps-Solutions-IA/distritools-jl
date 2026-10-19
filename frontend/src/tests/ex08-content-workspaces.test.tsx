import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LegalWorkspace } from '@/features/admin/content/LegalWorkspace';
import { FooterWorkspace } from '@/features/admin/content/FooterWorkspace';
import {
  contentRequest,
  ContentRequestError,
} from '@/features/admin/content/api';
import type {
  FooterSnapshot,
  LegalRevision,
} from '@/features/admin/content/contracts';

it('restores an archived footer only after confirmation and keeps it a draft', async () => {
  const old = {
    id: 'old',
    status: 'archived' as const,
    version: 1,
    groupsJson: [
      { title: 'Grupo', links: [{ label: 'Catálogo', href: '/productos' }] },
    ],
    links: [],
  };
  const initial: FooterSnapshot = {
    data: old,
    published: null,
    history: [old],
    requiresReview: false,
    routeAlerts: [],
  };
  const created = { ...old, id: 'new', version: 2, status: 'draft' as const };
  vi.mocked(contentRequest)
    .mockResolvedValueOnce(created)
    .mockResolvedValueOnce({
      ...initial,
      data: created,
      history: [created, old],
    });
  render(
    <FooterWorkspace
      initial={initial}
      permissions={['footer.read', 'footer.write']}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Restaurar versión como borrador' }),
  );
  expect(contentRequest).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar restauración del footer' }),
  );
  await waitFor(() =>
    expect(contentRequest).toHaveBeenCalledWith(
      'footer',
      expect.anything(),
      'POST',
      { groups: old.groupsJson },
    ),
  );
  expect(
    await screen.findByText(
      'Versión restaurada como borrador. Requiere revisión, aprobación y publicación.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Publicar versión' }),
  ).not.toBeInTheDocument();
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/features/admin/content/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/content/api')>()),
  contentRequest: vi.fn(),
}));
const row: LegalRevision = {
  id: 'draft',
  pageKey: 'privacy',
  title: 'Documento existente',
  slug: 'privacy',
  status: 'draft',
  version: 3,
  publishedAt: null,
  content: {
    sections: [{ title: 'Sección existente', body: 'Texto existente' }],
  },
  checklist: { responsable: false },
};
const detail = {
  pageKey: row.pageKey,
  history: [row],
  requirements: ['responsable'],
  published: null,
  draft: row,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(contentRequest).mockResolvedValue(detail);
});
async function open() {
  fireEvent.click(screen.getByRole('button', { name: row.title }));
  await screen.findByLabelText('Título');
}
it('reads persisted preview; edits and dirty form cannot transition or change document', async () => {
  render(
    <LegalWorkspace
      initial={[row]}
      permissions={['legal.read', 'legal.write', 'legal.review']}
    />,
  );
  await open();
  fireEvent.click(
    screen.getByRole('button', { name: 'Previsualizar versión guardada' }),
  );
  expect(
    await screen.findByRole('article', { name: 'Vista previa guardada' }),
  ).toHaveTextContent('Texto existente');
  expect(contentRequest).toHaveBeenLastCalledWith(
    'legal/privacy',
    expect.anything(),
  );
  fireEvent.change(screen.getByLabelText('Título'), {
    target: { value: 'Cambio pendiente' },
  });
  expect(
    screen.getByRole('button', { name: 'Enviar a revisión' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: row.title })).toBeDisabled();
  expect(
    screen.queryByRole('article', { name: 'Vista previa guardada' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
  expect(screen.getByLabelText('Título')).toHaveValue(row.title);
});
it('requires explicit confirmation and never reports successful publication on denied or unavailable backend', async () => {
  const approved = { ...row, status: 'approved' as const };
  vi.mocked(contentRequest).mockResolvedValue({
    ...detail,
    history: [approved],
    draft: approved,
  });
  render(
    <LegalWorkspace
      initial={[approved]}
      permissions={['legal.read', 'legal.write', 'legal.publish']}
    />,
  );
  await open();
  expect(screen.getByLabelText('Título')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar versión' }));
  expect(contentRequest).toHaveBeenCalledTimes(1);
  vi.mocked(contentRequest).mockRejectedValue(
    new ContentRequestError('forbidden', 403, 'Permiso denegado.'),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar publicar versión' }),
  );
  expect(await screen.findByRole('alert')).toHaveAttribute(
    'data-state',
    'forbidden',
  );
  expect(
    screen.queryByText(
      'Estado guardado. La versión se volvió a consultar en el servicio.',
    ),
  ).not.toBeInTheDocument();
  expect(contentRequest).toHaveBeenLastCalledWith(
    'legal/draft/publish',
    expect.anything(),
    'POST',
  );
});
it('hides writes for legal read-only and keeps a denied detail as failure instead of empty success', async () => {
  render(<LegalWorkspace initial={[row]} permissions={['legal.read']} />);
  await open();
  expect(screen.getByLabelText('Título')).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Guardar borrador' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Enviar a revisión' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Crear borrador desde esta versión' }),
  ).not.toBeInTheDocument();
  vi.mocked(contentRequest).mockRejectedValue(
    new ContentRequestError('auth_required', 401, 'Sesión requerida.'),
  );
  fireEvent.click(screen.getByRole('button', { name: row.title }));
  expect(await screen.findByRole('alert')).toHaveAttribute(
    'data-state',
    'auth_required',
  );
  expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
    'href',
    '/admin/login',
  );
  expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();
});
it('footer reports real published version and invalidated link reasons, and read-only cannot edit', async () => {
  const revision = {
    id: 'f',
    status: 'published' as const,
    version: 2,
    publishedAt: '2026-10-11T00:00:00Z',
    groupsJson: [
      {
        title: 'Catálogo',
        links: [{ label: 'Producto', href: '/productos/item' }],
      },
    ],
    links: [
      {
        id: 'link',
        label: 'Producto',
        href: '/productos/item',
        isVisible: true,
      },
    ],
  };
  const initial: FooterSnapshot = {
    data: { ...revision, id: 'd', status: 'draft', version: 4 },
    published: revision,
    history: [{ ...revision, id: 'd', status: 'draft', version: 4 }, revision],
    requiresReview: true,
    routeAlerts: [
      {
        id: 'alert',
        createdAt: '2026-10-11',
        version: 2,
        invalidLinks: [{ linkId: 'link', reason: 'Producto no publicado' }],
      },
    ],
  };
  render(<FooterWorkspace initial={initial} permissions={['footer.read']} />);
  expect(screen.getByText('v2', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Producto: Producto no publicado',
  );
  expect(
    screen.queryByRole('form', { name: 'Editar destinos del footer' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Aprobar versión' }),
  ).not.toBeInTheDocument();
  vi.mocked(contentRequest).mockRejectedValue(
    new ContentRequestError('server_error', 500, 'Servicio indisponible.'),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualizar desde el servicio' }),
  );
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.dataset.state === 'server_error'),
    ).toBe(true),
  );
  expect(screen.getByText('v2', { exact: true })).toBeInTheDocument();
});
