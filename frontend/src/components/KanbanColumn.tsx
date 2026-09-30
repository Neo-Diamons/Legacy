import type { Task } from "../types";
import { TaskRow } from "./TaskRow";



export function KanbanColumn ({tasks, category, toggleTask, deleteTask}:
    {tasks: Task[], category: string, toggleTask: (task: string) => void, deleteTask: (task: string) => void}) {

    return (
        <div className="kanban-column-body">
            <h3>{category}</h3>
            {tasks.map((task) => (
                <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                />
            ))}
        </div>
    )
}