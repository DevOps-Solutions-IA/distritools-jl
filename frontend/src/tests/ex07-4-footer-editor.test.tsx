import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FooterRouteEditor } from '@/components/admin/FooterRouteEditor';
import { saveFooterGroups, validateFooterGroups } from '@/lib/api/footer';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/footer', () => ({
  saveFooterGroups: vi.fn(),
  validateFooterGroups: vi.fn(),
}));
const groups = [
  { title: 'Catálogo', links: [{ label: 'Productos', href: '/productos' }] },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateFooterGroups).mockResolvedValue({ valid: true });
  vi.mocked(saveFooterGroups).mockResolvedValue({ id: 'new' });
});
it('validates introduced route on blur and displays concrete rejected destination', async () => {
  vi.mocked(validateFooterGroups).mockRejectedValue(
    new Error('El producto no está publicado.'),
  );
  render(
    <FooterRouteEditor
      revision={{ id: 'draft', status: 'draft', groupsJson: groups }}
    />,
  );
  fireEvent.change(screen.getByLabelText('Ruta interna'), {
    target: { value: '/productos/missing' },
  });
  fireEvent.blur(screen.getByLabelText('Ruta interna'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'El producto no está publicado.',
  );
  expect(saveFooterGroups).not.toHaveBeenCalled();
});
it('validates before saving and patches only draft revisions', async () => {
  render(
    <FooterRouteEditor
      revision={{ id: 'draft', status: 'draft', groupsJson: groups }}
    />,
  );
  fireEvent.submit(
    screen.getByRole('form', { name: 'Editar destinos del footer' }),
  );
  await waitFor(() =>
    expect(saveFooterGroups).toHaveBeenCalledWith(groups, 'draft'),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Borrador guardado',
  );
});
it('published corrections create new draft without editing published revision', async () => {
  render(
    <FooterRouteEditor
      revision={{ id: 'published', status: 'published', groupsJson: groups }}
    />,
  );
  fireEvent.submit(
    screen.getByRole('form', { name: 'Editar destinos del footer' }),
  );
  await waitFor(() =>
    expect(saveFooterGroups).toHaveBeenCalledWith(groups, undefined),
  );
});
it('denied validation never sends a draft mutation', async () => {
  vi.mocked(validateFooterGroups).mockRejectedValue(
    new Error('Permiso footer.write requerido.'),
  );
  render(
    <FooterRouteEditor revision={{ status: 'draft', groupsJson: groups }} />,
  );
  fireEvent.submit(
    screen.getByRole('form', { name: 'Editar destinos del footer' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Permiso footer.write requerido.',
  );
  expect(saveFooterGroups).not.toHaveBeenCalled();
});

it('allows and saves a valid combined catalog filter longer than the former 240-character input cap', async () => {
  const href = `/productos?q=${'herramienta'.repeat(17)}&category=${'industrial-'.repeat(7)}&brand=${'marca-'.repeat(7)}`;
  expect(href.length).toBeGreaterThan(240);
  render(
    <FooterRouteEditor
      revision={{ id: 'draft', status: 'draft', groupsJson: groups }}
    />,
  );
  const input = screen.getByLabelText('Ruta interna') as HTMLInputElement;
  expect(input.maxLength).toBeGreaterThanOrEqual(href.length);
  fireEvent.change(input, { target: { value: href } });
  fireEvent.submit(
    screen.getByRole('form', { name: 'Editar destinos del footer' }),
  );
  const changed = [{ ...groups[0], links: [{ ...groups[0].links[0], href }] }];
  await waitFor(() =>
    expect(validateFooterGroups).toHaveBeenCalledWith(changed),
  );
  await waitFor(() =>
    expect(saveFooterGroups).toHaveBeenCalledWith(changed, 'draft'),
  );
});
