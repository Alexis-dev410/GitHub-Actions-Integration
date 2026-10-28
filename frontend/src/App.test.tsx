import { fireEvent, render, screen } from '@testing-library/react';
import NavBarLoggedOutView from './components/NavBarLoggedOutView';
import Note from './components/Note';

test('offers signup and login and dispatches the selected action', () => {
  const signup = jest.fn();
  const login = jest.fn();
  render(<NavBarLoggedOutView onSignUpClicked={signup} onLoginClicked={login} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
  expect(signup).toHaveBeenCalledTimes(1);
  expect(login).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
  expect(login).toHaveBeenCalledTimes(1);
});

test('renders a note and opens it when its title is clicked', () => {
  const note = { _id: 'example', title: 'CI workshop', text: 'Publish our images',
    createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z' };
  const open = jest.fn();
  render(<Note note={note} onNoteClicked={open} onDeleteNoteClicked={jest.fn()} />);
  expect(screen.getByText('Publish our images')).toBeInTheDocument();
  fireEvent.click(screen.getByText('CI workshop'));
  expect(open).toHaveBeenCalledWith(note);
});
