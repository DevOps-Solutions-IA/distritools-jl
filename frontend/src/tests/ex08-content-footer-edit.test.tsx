import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { FooterRouteEditor } from '@/components/admin/FooterRouteEditor';
import { saveFooterGroups, validateFooterGroups } from '@/lib/api/footer';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/footer', () => ({
  saveFooterGroups: vi.fn(),
  validateFooterGroups: vi.fn(),
}));
it('automatic blur validation cannot swallow save and stale rejection cannot overwrite persisted success', async () => {
  let rejectBlur: (failure: Error) => void = () => {};
  let acceptSave: (value: unknown) => void = () => {};
  vi.mocked(validateFooterGroups)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectBlur = reject;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acceptSave = resolve;
        }),
    );
  vi.mocked(saveFooterGroups).mockResolvedValue({ id: 'draft' });
  render(
    <FooterRouteEditor
      revision={{
        id: 'draft',
        status: 'draft',
        groupsJson: [
          {
            title: 'Grupo',
            links: [{ label: 'Catálogo', href: '/productos' }],
          },
        ],
      }}
    />,
  );
  fireEvent.blur(screen.getByLabelText('Ruta interna'));
  expect(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeEnabled();
  fireEvent.submit(
    screen.getByRole('form', { name: 'Editar destinos del footer' }),
  );
  await waitFor(() => expect(validateFooterGroups).toHaveBeenCalledTimes(2));
  await act(async () => {
    rejectBlur(new Error('Obsolete route rejection'));
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => {
    acceptSave({ valid: true });
  });
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Borrador guardado',
  );
  expect(saveFooterGroups).toHaveBeenCalledWith(expect.anything(), 'draft');
});

it('retains typed permission failures from the content domain and never sends a save', async () => {
  vi.clearAllMocks();
  const save = vi.fn();
  render(
    <FooterRouteEditor
      revision={{
        id: 'draft',
        status: 'draft',
        groupsJson: [
          {
            title: 'Grupo',
            links: [{ label: 'Catálogo', href: '/productos' }],
          },
        ],
      }}
      validateGroups={async () => {
        const failure = new Error('Permiso de edición revocado.');
        Object.assign(failure, { kind: 'forbidden', status: 403 });
        throw failure;
      }}
      saveGroups={save}
    />,
  );
  fireEvent.submit(
    screen.getByRole('form', { name: 'Editar destinos del footer' }),
  );
  expect(await screen.findByRole('alert')).toHaveAttribute(
    'data-state',
    'forbidden',
  );
  expect(save).not.toHaveBeenCalled();
});
