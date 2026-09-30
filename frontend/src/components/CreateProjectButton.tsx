import { useState, type SubmitEvent } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

import { useAppData } from '../context/appDataContext';

const COLOR_SWATCHES = ['#4f8ef7', '#f7a24f', '#4fbf7c', '#e05f7d', '#8e6fd1', '#2fb6c4'];

export function CreateProjectButton({
  variant = 'primary',
  label = '+ Nouveau projet',
}: {
  variant?: string;
  label?: string;
}) {
  const { createProject } = useAppData();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);

  const close = () => {
    setShow(false);
    setName('');
    setColor(COLOR_SWATCHES[0]);
  };

  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProject({ name, color });
    close();
  };

  return (
    <>
      <Button variant={variant} onClick={() => setShow(true)}>
        {label}
      </Button>

      <Modal show={show} onHide={close} centered>
        <Form onSubmit={submit}>
          <Modal.Header closeButton>
            <Modal.Title as="h2" className="h5 mb-0">
              Nouveau projet
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="project-name">
              <Form.Label>Nom du projet</Form.Label>
              <Form.Control
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Refonte du site vitrine"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Couleur</Form.Label>
              <div className="color-swatch-picker">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`color-swatch ${swatch === color ? 'selected' : ''}`}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Choisir la couleur ${swatch}`}
                    onClick={() => setColor(swatch)}
                  />
                ))}
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" variant="success" disabled={!name.trim()}>
              Créer le projet
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
