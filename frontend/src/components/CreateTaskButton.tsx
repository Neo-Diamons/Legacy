import { useState, type SubmitEvent } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

import { useAppData } from '../context/appDataContext';
import type { TaskPriority } from '../types';

export function CreateTaskButton({ projectId }: { projectId: string }) {
  const { createTask } = useAppData();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');

  const close = () => {
    setShow(false);
    setName('');
    setPriority('medium');
    setDueDate('');
  };

  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTask({ name, projectId, priority, dueDate: dueDate || null });
    close();
  };

  return (
    <>
      <Button variant="outline-primary" size="sm" onClick={() => setShow(true)}>
        + Ajouter une tâche
      </Button>

      <Modal show={show} onHide={close} centered>
        <Form onSubmit={submit}>
          <Modal.Header closeButton>
            <Modal.Title as="h2" className="h5 mb-0">
              Nouvelle tâche
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="task-title">
              <Form.Label>Nom</Form.Label>
              <Form.Control
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Relire la maquette"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="task-priority">
              <Form.Label>Priorité</Form.Label>
              <Form.Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="task-due-date">
              <Form.Label>Échéance (optionnelle)</Form.Label>
              <Form.Control type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" variant="success" disabled={!name.trim()}>
              Créer la tâche
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
