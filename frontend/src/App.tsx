import { useEffect, useState, type FormEvent } from 'react';
import { Button, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';

interface Item {
  id: string;
  name: string;
  completed: boolean;
}

export default function App() {
  return (
    <Container>
      <Row>
        <Col md={{ offset: 3, span: 6 }}>
          <TodoListCard />
        </Col>
      </Row>
    </Container>
  );
}

type ItemEvent =
  | { type: 'item.created'; item: Item }
  | { type: 'item.updated'; item: Item }
  | { type: 'item.deleted'; id: string };

function TodoListCard() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch(`/items`)
      .then((r) => r.json())
      .then(setItems);
  }, []);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);

    socket.addEventListener('message', (event) => {
      const message: ItemEvent = JSON.parse(event.data);
      setItems((current) => {
        if (!current) return current;
        switch (message.type) {
          case 'item.created':
            return current.some((i) => i.id === message.item.id) ? current : [...current, message.item];
          case 'item.updated':
            return current.map((i) => (i.id === message.item.id ? message.item : i));
          case 'item.deleted':
            return current.filter((i) => i.id !== message.id);
        }
      });
    });

    return () => socket.close();
  }, []);

  if (items === null) return 'Loading...';

  return (
    <>
      <AddItemForm />
      {items.length === 0 && <p className="text-center">No items yet! Add one above!</p>}
      {items.map((item) => (
        <ItemDisplay item={item} key={item.id} />
      ))}
    </>
  );
}

function AddItemForm() {
  const [newItem, setNewItem] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitNewItem = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    fetch(`/items`, {
      method: 'POST',
      body: JSON.stringify({ name: newItem }),
      headers: { 'Content-Type': 'application/json' },
    }).then(() => {
      setSubmitting(false);
      setNewItem('');
    });
  };

  return (
    <Form onSubmit={submitNewItem}>
      <InputGroup className="mb-3">
        <Form.Control
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          type="text"
          placeholder="New Item"
          aria-describedby="basic-addon1"
        />
        <Button type="submit" variant="success" disabled={!newItem.length} className={submitting ? 'disabled' : ''}>
          {submitting ? 'Adding...' : 'Add Item'}
        </Button>
      </InputGroup>
    </Form>
  );
}

function ItemDisplay({ item }: { item: Item }) {
  const toggleCompletion = () => {
    fetch(`/items/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: item.name,
        completed: !item.completed,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const removeItem = () => {
    fetch(`/items/${item.id}`, { method: 'DELETE' });
  };

  return (
    <Container fluid className={`item ${item.completed && 'completed'}`}>
      <Row>
        <Col xs={1} className="text-center">
          <Button
            className="toggles"
            size="sm"
            variant="link"
            onClick={toggleCompletion}
            aria-label={item.completed ? 'Mark item as incomplete' : 'Mark item as complete'}
          >
            <i className={`far ${item.completed ? 'fa-check-square' : 'fa-square'}`} />
          </Button>
        </Col>
        <Col xs={10} className="name">
          {item.name}
        </Col>
        <Col xs={1} className="text-center remove">
          <Button size="sm" variant="link" onClick={removeItem} aria-label="Remove Item">
            <i className="fa fa-trash text-danger" />
          </Button>
        </Col>
      </Row>
    </Container>
  );
}
