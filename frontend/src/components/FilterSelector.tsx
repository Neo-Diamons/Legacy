import {useState} from 'react';
import {Form} from 'react-bootstrap';
import type {FilterParams, TaskPriority} from '../types';
import {PRIORITY_LABELS} from '../utils/format';


export function FilterSelector({
    onFilterChange,
    FilterParams
}: {
    onFilterChange: (filterParams: FilterParams) => void;
    FilterParams: FilterParams;
}) {
    const [filterParams, setFilterParams] = useState<FilterParams>(FilterParams);
    const [date, setDate] = useState<string>(filterParams.dueDate || '');
    const [startDate, setStartDate] = useState<string>(filterParams.startDate || '');

    const updateFilter = (changes: Partial<FilterParams>) => {
        const updatedFilterParams = { ...filterParams, ...changes };
        setFilterParams(updatedFilterParams);
        onFilterChange(updatedFilterParams);
    };

    return (
        <Form>
            <Form.Group controlId="filterProject">
                <Form.Label> Priority</Form.Label>
                <Form.Select
                    value={filterParams.priority || ''}
                    onChange={(e) => {
                        const newPriority = e.target.value as TaskPriority | '';
                        updateFilter({ priority: newPriority || null });
                    }}
                >
                    <option value="">All</option>
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                        <option key={priority} value={priority}>
                            {PRIORITY_LABELS[priority].label}
                        </option>
                    ))}
                </Form.Select>
            </Form.Group>
            <Form.Group controlId="filterDueDate">
                <Form.Label>Due Date</Form.Label>
                <Form.Control
                type="date"
                value={date.toString().split('T')[0]} //2026-05-01T15:30
                onChange={(e) => {
                    const newDate = e.target.value;
                    setDate(newDate);
                    updateFilter({ dueDate: newDate || null });
                }}
                />
            </Form.Group>
            <Form.Group controlId="filterStartDate">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                    type="date"
                    value={startDate.toString().split('T')[0]}
                    onChange={(e) => {
                        const newStartDate = e.target.value;
                        setStartDate(newStartDate);
                        updateFilter({ startDate: newStartDate || null });
                    }}
                />
            </Form.Group>
        </Form>
    );
}
