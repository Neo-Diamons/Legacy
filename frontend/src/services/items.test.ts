import { describe, expect, test, vi } from 'vitest';

import { createItem, deleteItem, fetchItems, openItemSocket, updateItem } from './items';
import { errorResponse, item, jsonResponse, latestSocket, MockWebSocket, stubFetch } from '../test/helpers';

describe('items service', () => {
  describe('fetchItems', () => {
    test('GETs /items and unwraps the body', async () => {
      const items = [item('1', 'One')];
      const fetchMock = stubFetch(() => jsonResponse(items));

      await expect(fetchItems()).resolves.toEqual(items);
      expect(fetchMock).toHaveBeenCalledWith('/items');
    });

    test.each([
      [404, 'Not Found'],
      [500, 'Internal Server Error'],
    ])('rejects with "<status> <statusText>" on HTTP %i', async (status, statusText) => {
      stubFetch(() => errorResponse(status, statusText));
      await expect(fetchItems()).rejects.toThrow(`${status} ${statusText}`);
    });

    test('propagates a network failure', async () => {
      stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
      await expect(fetchItems()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('createItem', () => {
    test('POSTs JSON and returns the status with the created item', async () => {
      const created = item('9', 'New');
      const fetchMock = stubFetch(() => jsonResponse(created, { status: 201, statusText: 'Created' }));
      const input = { name: 'New', priority: 'high' as const, dueDate: '2026-05-01' };

      await expect(createItem(input)).resolves.toEqual({ status: 201, item: created });
      expect(fetchMock).toHaveBeenCalledWith('/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    });

    test('rejects on validation errors without reading the body', async () => {
      const response = errorResponse(422, 'Unprocessable Entity');
      const json = vi.spyOn(response, 'json');
      stubFetch(() => response);

      await expect(createItem({ name: '' })).rejects.toThrow('422 Unprocessable Entity');
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    test('PUTs the full payload to /items/:id', async () => {
      const updated = item('7', 'Renamed', { completed: true });
      const fetchMock = stubFetch(() => jsonResponse(updated));
      const input = { name: 'Renamed', completed: true, description: null, priority: 'low' as const, dueDate: null };

      await expect(updateItem('7', input)).resolves.toEqual({ status: 200, item: updated });
      expect(fetchMock).toHaveBeenCalledWith('/items/7', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    });

    test('rejects when the item does not exist', async () => {
      stubFetch(() => errorResponse(404, 'Not Found'));
      await expect(updateItem('nope', { name: 'x', completed: false })).rejects.toThrow('404 Not Found');
    });
  });

  describe('deleteItem', () => {
    test('DELETEs /items/:id and returns the status code (no body to parse)', async () => {
      const fetchMock = stubFetch(() => ({ ok: true, status: 204, statusText: 'No Content' }));

      await expect(deleteItem('7')).resolves.toBe(204);
      expect(fetchMock).toHaveBeenCalledWith('/items/7', { method: 'DELETE' });
    });

    test('rejects on server errors', async () => {
      stubFetch(() => errorResponse(500, 'Internal Server Error'));
      await expect(deleteItem('7')).rejects.toThrow('500 Internal Server Error');
    });
  });

  describe('openItemSocket', () => {
    test('connects to ws://<host>/ws on http pages', () => {
      vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:3000' });
      openItemSocket(() => undefined);
      expect(latestSocket().url).toBe('ws://localhost:3000/ws');
    });

    test('upgrades to wss:// on https pages', () => {
      vi.stubGlobal('location', { protocol: 'https:', host: 'todo.example.com' });
      openItemSocket(() => undefined);
      expect(latestSocket().url).toBe('wss://todo.example.com/ws');
    });

    test('parses each message and forwards it as an event, in order', () => {
      const onEvent = vi.fn();
      openItemSocket(onEvent);
      const created = { type: 'item.created', item: item('1', 'One') };
      const deleted = { type: 'item.deleted', id: '1' };

      latestSocket().emit('message', created);
      latestSocket().emit('message', deleted);

      expect(onEvent.mock.calls).toEqual([[created], [deleted]]);
    });

    test('the returned disposer closes the socket', () => {
      const dispose = openItemSocket(() => undefined);
      expect(latestSocket().closed).toBe(false);
      dispose();
      expect(latestSocket().closed).toBe(true);
    });

    test('the disposer waits for the socket to open when it is still connecting', () => {
      const dispose = openItemSocket(() => undefined);
      latestSocket().readyState = MockWebSocket.CONNECTING;
      dispose();
      expect(latestSocket().closed).toBe(false);

      latestSocket().emit('open', undefined);
      expect(latestSocket().closed).toBe(true);
    });
  });
});
