import {useState} from 'react';
import {Button, Form} from 'react-bootstrap';
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
            <Form.Group controlId="filterProject"
                className="mb-3">
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
            <Form.Group controlId="filterDueDate"
                className="mb-3">
                <Form.Label>Due Date</Form.Label>
                <Form.Control
                type="date"
                value={date.toString().split('T')[0]}
                onChange={(e) => {
                    const newDate = e.target.value;
                    setDate(newDate);
                    updateFilter({ dueDate: newDate || null });
                }}
                />
            </Form.Group>
            <Form.Group controlId="filterStartDate"
                className="mb-3">
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
            <Button
                variant='secondary'
                className='me-2 mb-2'
                onClick={() =>{
                    const today = new Date().toISOString().split('T')[0];
                    updateFilter({ dueDate: today, startDate: today});
                    setDate(today);
                    setStartDate(today);
                }}
                >
                aujourd'hui
            </Button>

            <Button
                variant='secondary'
                className='me-2 mb-2'
                onClick={() =>{
                    const today = new Date().toISOString().split('T')[0];
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    const nextWeekStr = nextWeek.toISOString().split('T')[0];
                    updateFilter({ dueDate: nextWeekStr, startDate: today });
                    setDate(nextWeekStr);
                    setStartDate(today);
                }}
            >
                cette semaine
            </Button>
            <Button
                variant="primary"
                className='me-2 mb-2'
                onClick={() => {
                    updateFilter({ dueDate: null, startDate: null });
                    setDate('');
                    setStartDate('');
                }}
            >
                Effacer
            </Button>
        </Form>
    );
};
