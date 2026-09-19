import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import App from '../src/App';


const item = (id: string, name: string, completed = false) => ({ id, name, completed });

class MockWebSocket {
	static instances: MockWebSocket[] = [];
	listeners: Record<string, ((event: { data: string }) => void)[]> = {};

	constructor() {
		MockWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: (event: { data: string }) => void) {
		(this.listeners[type] ??= []).push(listener);
	}

	removeEventListener() {}

	close() {}

	emit(type: string, data: unknown) {
		for (const listener of this.listeners[type] ?? []) listener({ data: JSON.stringify(data) });
	}
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	MockWebSocket.instances = [];
});

describe('App', () => {
	beforeEach(() => {
		vi.stubGlobal('WebSocket', MockWebSocket);
	});

	test('shows loading and empty-list message', async () => {
		let resolveItems: (items: unknown[]) => void = () => undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise((resolve) => {
						resolveItems = (items) => resolve({ json: () => Promise.resolve(items) });
					})
			)
		);

		render(<App />);

		expect(screen.getByText('Loading...')).toBeInTheDocument();
		resolveItems([]);

		expect(await screen.findByText('No items yet! Add one above!')).toBeInTheDocument();
	});

	test('adds an item through the form', async () => {
		const createdItem = item('1', 'Write tests');
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({ json: () => Promise.resolve([]) })
			.mockResolvedValueOnce({ json: () => Promise.resolve(createdItem) });
		vi.stubGlobal('fetch', fetchMock);

		render(<App />);
		const input = await screen.findByPlaceholderText('New Item');
		const addButton = screen.getByRole('button', { name: 'Add Item' });

		expect(addButton).toBeDisabled();
		fireEvent.change(input, { target: { value: createdItem.name } });
		fireEvent.click(addButton);

		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'/items',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ name: createdItem.name }),
			})
		);

		const [socket] = MockWebSocket.instances;
		socket.emit('message', { type: 'item.created', item: createdItem });

		expect(await screen.findByText(createdItem.name)).toBeInTheDocument();
		expect(screen.getByPlaceholderText('New Item')).toHaveValue('');
	});

	test('toggles completion and removes an item', async () => {
		const firstItem = item('1', 'First item');
		const completedItem = item('2', 'Done item', true);
		const updatedItem = item('1', 'First item', true);
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({ json: () => Promise.resolve([firstItem, completedItem]) })
			.mockResolvedValueOnce({ json: () => Promise.resolve(updatedItem) })
			.mockResolvedValueOnce({});
		vi.stubGlobal('fetch', fetchMock);

		render(<App />);
		expect(await screen.findByText(firstItem.name)).toBeInTheDocument();
		expect(screen.getByText(completedItem.name).closest('.item')).toHaveClass('completed');

		fireEvent.click(screen.getByRole('button', { name: 'Mark item as complete' }));
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			`/items/${firstItem.id}`,
			expect.objectContaining({
				method: 'PUT',
				body: JSON.stringify({ name: firstItem.name, completed: true }),
			})
		);

		const [socket] = MockWebSocket.instances;
		socket.emit('message', { type: 'item.updated', item: updatedItem });
		expect(await screen.findByRole('button', { name: 'Mark item as incomplete' })).toBeInTheDocument();

		const updatedItemContainer = screen.getByText(updatedItem.name).closest('.item');
		fireEvent.click(within(updatedItemContainer as HTMLElement).getByRole('button', { name: 'Remove Item' }));
		expect(fetchMock).toHaveBeenNthCalledWith(3, `/items/${updatedItem.id}`, { method: 'DELETE' });

		socket.emit('message', { type: 'item.deleted', id: updatedItem.id });
		await waitFor(() => expect(screen.queryByText(updatedItem.name)).not.toBeInTheDocument());
		expect(screen.getByText(completedItem.name)).toBeInTheDocument();
	});
});
