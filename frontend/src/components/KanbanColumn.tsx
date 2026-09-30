import type { DragEvent } from 'react';
import type { Task, TaskPriority } from "../types";
import { TaskRow } from "./TaskRow";



export function KanbanColumn ({tasks, category, toggleTask, updateTaskPriority, deleteTask}:
    {tasks: Task[], category: TaskPriority, toggleTask: (task: string) => void, updateTaskPriority: (task: string, priority: TaskPriority) => void, deleteTask: (task: string) => void}) {
    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData('text/plain');
        if (taskId) updateTaskPriority(taskId, category);
    };

    return (
        <div
            className="kanban-column-body"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
        >
            <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
            {tasks.map((task) => (
                <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
                    onDelete={deleteTask}
                />
            ))}
        </div>
    )
}