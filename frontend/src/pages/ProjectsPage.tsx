import { useState } from 'react';

import { Button, ButtonGroup, Form, Modal, Placeholder } from 'react-bootstrap';

import { CreateProjectButton } from '../components/CreateProjectButton';
import { CreateTaskButton } from '../components/CreateTaskButton';
import { KanbanContainer } from '../components/KanbanContainer';
import { ProjectCard } from '../components/ProjectCard';
import { TaskRow } from '../components/TaskRow';
import { useAppData } from '../context/appDataContext';
import type { TaskPriority, FilterParams } from '../types';
import { toDateInputValue } from '../services/items';
import { FilterSelector } from '../components/FilterSelector';

export function ProjectsPage({
  selectedProjectId,
  onSelectProject,
}: {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}) {
  const { loading, projects, projectStats } = useAppData();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (selectedProject) {
    return <ProjectDetail projectId={selectedProject.id} onBack={() => onSelectProject(null)} />;
  }

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <div>
          <h1 className="page-title">Projets</h1>
          <p className="text-muted">Tous les projets auxquels vous participez.</p>
        </div>
        {!loading && <CreateProjectButton />}
      </header>

      {loading && (
        <div aria-busy="true" aria-live="polite">
          {[0, 1].map((row) => (
            <Placeholder key={row} as="p" animation="glow" className="mb-3">
              <Placeholder xs={4} />
              <Placeholder xs={12} className="d-block" style={{ height: 8 }} />
            </Placeholder>
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="empty-state">
          <p>Vous ne participez à aucun projet pour le moment. Créez-en un pour commencer.</p>
        </div>
      )}

      <ul className="project-grid list-unstyled">
        {!loading &&
          projects.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                stats={projectStats(project.id)}
                onClick={() => onSelectProject(project.id)}
              />
            </li>
          ))}
      </ul>
    </div>
  );
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const {
    projects,
    tasks,
    toggleTask,
    updateTaskPriority,
    deleteTask,
    deleteProject,
    updateProjectName,
    updateTaskName,
  } = useAppData();
  const project = projects.find((p) => p.id === projectId);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  const PRIORITY_ORDER: Record<TaskPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const [showKanban, setShowKanban] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [filterParams, setFilterParams] = useState<FilterParams>({
    projectId: projectId,
    priority: null,
    dueDate: null,
    startDate: null,
  });
  const [showFilter, setShowFilter] = useState(false);

  const [sortBy, setSortBy] = useState<'priority' | 'dueDate'>('priority');

  const filteredTasks = projectTasks.filter((task) => {
    if (filterParams.priority && task.priority !== filterParams.priority) return false;

    const taskDate = task.dueDate?.slice(0, 10);
    if (filterParams.startDate && (!taskDate || taskDate < filterParams.startDate)) return false;
    if (filterParams.dueDate && (!taskDate || taskDate > filterParams.dueDate)) return false;

    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'priority') {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }

    if (a.dueDate === null && b.dueDate === null) return 0;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;

    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  if (!project) return null;

  const handleDeleteProject = () => {
    if (window.confirm(`Supprimer le projet "${project.name}" et ses ${projectTasks.length} tâche(s) ?`)) {
      deleteProject(project.id);
      onBack();
    }
  };

  const handleEditTask = (taskId: string) => {
    const task = projectTasks.find((task) => task.id === taskId);
    if (!task) return;

    setEditingTaskId(taskId);
    setEditName(task.name);
    setEditDescription(task.description ?? '');
    setEditPriority(task.priority);
    setEditDueDate(toDateInputValue(task.dueDate));
  };

  return (
    <div className="page">
      <header className="page-header project-detail-header">
        <div className="page-header-row">
          <div className="project-detail-title">
            <span className="project-dot" style={{ backgroundColor: project.color }} aria-hidden="true" />
            <h1 className="page-title mb-0">{project.name}</h1>
          </div>
          <Button variant="link" className="back-link" onClick={onBack}>
            <i className="fa fa-arrow-left me-2" aria-hidden="true" />
            Retour aux projets
          </Button>
        </div>

        <div className="page-header-row align-items-center">
          {projectTasks.length > 0 ? (
            <ButtonGroup size="sm" aria-label="Mode d'affichage">
              <Button
                variant={showKanban ? 'outline-primary' : 'primary'}
                aria-pressed={!showKanban}
                onClick={() => setShowKanban(false)}
              >
                <i className="fa fa-list me-1" aria-hidden="true" />
                Liste
              </Button>

              <Button
                variant={showKanban ? 'primary' : 'outline-primary'}
                aria-pressed={showKanban}
                onClick={() => setShowKanban(true)}
              >
                <i className="fa fa-columns me-1" aria-hidden="true" />
                Kanban
              </Button>
            </ButtonGroup>
          ) : (
            <span />
          )}

          <div className="d-flex gap-2">
            <CreateTaskButton projectId={project.id} />

            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => {
                setEditName(project.name);
                setShowEdit(true);
              }}
            >
              Modifier le projet
            </Button>

            <Button variant="outline-secondary" size="sm" onClick={() => setShowFilter(!showFilter)}>
              Filtrer
            </Button>

            <Button variant="outline-danger" size="sm" onClick={handleDeleteProject}>
              Supprimer le projet
            </Button>
          </div>
        </div>
      </header>

      {showFilter && <FilterSelector FilterParams={filterParams} onFilterChange={setFilterParams} />}

      {projectTasks.length === 0 ? (
        <p className="empty-state">Ce projet n'a pas encore de tâche.</p>
      ) : filteredTasks.length === 0 ? (
        <p className="empty-state">Aucune tâche ne correspond aux filtres sélectionnés.</p>
      ) : !showKanban ? (
        <div className="widget-card">
          <div className="d-flex justify-content-end mb-3">
            <Form.Select
              size="sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'priority' | 'dueDate')}
              style={{ width: '200px' }}
              aria-label="Trier les tâches"
            >
              <option value="priority">Trier par priorité</option>
              <option value="dueDate">Trier par échéance</option>
            </Form.Select>
          </div>

          <ul className="task-list">
            {sortedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onMove={updateTaskPriority}
                onDelete={deleteTask}
                onEdit={handleEditTask}
              />
            ))}
          </ul>
        </div>
      ) : (
        <KanbanContainer
          tasks={filteredTasks}
          project={project}
          toggleTask={toggleTask}
          updateTaskPriority={updateTaskPriority}
          deleteTask={deleteTask}
        />
      )}
      <Modal show={showEdit} onHide={() => setShowEdit(false)} centered>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editName.trim()) return;
            updateProjectName(project.id, editName);
            setShowEdit(false);
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title as="h2" className="h5 mb-0">
              Modifier le projet
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Group controlId="edit-project-name">
              <Form.Label>Nom du projet</Form.Label>
              <Form.Control type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowEdit(false)}>
              Annuler
            </Button>

            <Button type="submit" variant="success">
              Enregistrer
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal show={editingTaskId !== null} onHide={() => setEditingTaskId(null)} centered>
        <Form
          onSubmit={(e) => {
            e.preventDefault();

            if (!editingTaskId || !editName.trim()) return;

            updateTaskName(editingTaskId, editName, editPriority, editDueDate || null, editDescription || null);
            setEditingTaskId(null);
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title as="h2" className="h5 mb-0">
              Modifier la tâche
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Group controlId="edit-task-name">
              <Form.Label>Nom</Form.Label>
              <Form.Control autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Form.Group>
            <Form.Group controlId="edit-task-description" className="mt-3">
              <Form.Label>Note</Form.Label>
              <Form.Control
                as="textarea"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ajouter une note (optionnelle)"
              />
            </Form.Group>
            <Form.Group controlId="edit-task-priority" className="mt-3">
              <Form.Label>Priorité</Form.Label>
              <Form.Select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority)}>
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="edit-task-due-date" className="mt-3">
              <Form.Label>Échéance</Form.Label>
              <Form.Control
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditingTaskId(null)}>
              Annuler
            </Button>

            <Button type="submit" variant="success">
              Enregistrer
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
