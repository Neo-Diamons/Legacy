import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { ProjectCard } from './ProjectCard';

const project = { id: 'p-1', name: 'Website', color: '#4f8ef7', createdAt: '2026-01-14' };
const progressOf = () => screen.getByRole('progressbar').getAttribute('aria-valuenow');

describe('ProjectCard', () => {
  test('is a button that reports clicks when it has a handler', () => {
    const onClick = vi.fn();
    render(<ProjectCard project={project} stats={{ taskCount: 0, completedTaskCount: 0 }} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Website/ }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button')).toHaveClass('project-card-clickable');
  });

  test.each(['Enter', ' '])('activates on the "%s" key', (key) => {
    const onClick = vi.fn();
    render(<ProjectCard project={project} stats={{ taskCount: 0, completedTaskCount: 0 }} onClick={onClick} />);

    const card = screen.getByRole('button', { name: /Website/ });
    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key });
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('ignores other keys and keys pressed on inner elements', () => {
    const onClick = vi.fn();
    render(<ProjectCard project={project} stats={{ taskCount: 0, completedTaskCount: 0 }} onClick={onClick} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /Website/ }), { key: 'a' });
    fireEvent.keyDown(screen.getByText('Website'), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  test('is inert, not a fake button, without a handler', () => {
    render(<ProjectCard project={project} stats={{ taskCount: 0, completedTaskCount: 0 }} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.querySelector('.project-card')).not.toHaveAttribute('tabindex');
    expect(screen.getByText('Website').closest('.project-card')).not.toHaveClass('project-card-clickable');
  });

  test('paints the project color on its dot', () => {
    render(<ProjectCard project={project} stats={{ taskCount: 0, completedTaskCount: 0 }} />);
    expect(document.querySelector('.project-dot')).toHaveStyle({ backgroundColor: '#4f8ef7' });
  });

  test.each([
    [0, 0, 'Aucune tâche', '0'],
    [3, 0, '0/3 tâches terminées', '0'],
    [3, 1, '1/3 tâches terminées', '33'],
    [3, 2, '2/3 tâches terminées', '67'],
    [4, 4, '4/4 tâches terminées', '100'],
  ])('%i tasks, %i done -> "%s" at %s%%', (taskCount, completedTaskCount, label, progress) => {
    render(<ProjectCard project={project} stats={{ taskCount, completedTaskCount }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(progressOf()).toBe(progress);
  });
});
