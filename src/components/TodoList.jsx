import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_CATEGORY_OPTIONS = ['Work', 'Education', 'Personal', 'Family', 'Gym'];

const variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
};

export default function TodoList({ todos, projects, currentProjectId, customCategories, onToggle, onDelete, onUpdate, onArchive, onReorder, canReorder, emptyMessage }) {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(emptyEditor());
  const [draggedId, setDraggedId] = useState('');
  const customCategoryOptions = Array.isArray(customCategories)
    ? customCategories.filter((item) => {
      if (typeof item !== 'string' || !item.trim()) return false;
      const normalized = item.trim().toLowerCase();
      return !PRESET_CATEGORY_OPTIONS.some((preset) => preset.toLowerCase() === normalized) && normalized !== 'others';
    })
    : [];
  const categoryOptions = [...PRESET_CATEGORY_OPTIONS, ...customCategoryOptions, 'Others'];

  if (todos.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const startEditing = (todo) => {
    setEditingId(todo.id);
    setDraft({
      text: todo.text,
      notes: todo.notes || '',
      category: todo.category || '',
      categoryChoice: hasCategoryOption(categoryOptions, todo.category) ? todo.category : 'Others',
      customCategory: hasCategoryOption(categoryOptions, todo.category) ? '' : (todo.category || ''),
      priority: todo.priority || 'medium',
      dueDate: toDateInputValue(todo.dueDate),
      recurrence: todo.recurrence || 'none',
      projectId: todo.projectId,
    });
  };

  const stopEditing = () => {
    setEditingId('');
    setDraft(emptyEditor());
  };

  const save = async (id) => {
    const resolvedCategory = draft.categoryChoice === 'Others' ? draft.customCategory.trim() : draft.categoryChoice;
    const payload = {
      ...draft,
      category: resolvedCategory,
    };
    const saved = await onUpdate(id, payload);
    if (saved) stopEditing();
  };

  return (
    <section className="todo-table-wrap" aria-label="Todo table">
      <header className="todo-table-head">
        <span>Status</span>
        <span>Task</span>
        <span>List</span>
        <span>Priority</span>
        <span>Due</span>
        <span>Actions</span>
      </header>

      <motion.ul className="todo-list" layout>
        <AnimatePresence initial={false}>
          {todos.map((todo) => {
            const editing = editingId === todo.id;
            const overdue = isOverdue(todo);
            const dueToday = isDueToday(todo);
            const project = projects.find((item) => item.id === todo.projectId);
            const projectName = project ? project.name : (currentProjectId === 'all' ? 'All Lists' : '-');
            const dueLabel = todo.dueDate ? (overdue ? 'Overdue' : dueToday ? 'Due Today' : formatDue(todo.dueDate)) : 'No due date';

            return (
              <motion.li
                key={todo.id}
                layout
                draggable={canReorder && !editing}
                onDragStart={() => setDraggedId(todo.id)}
                onDragOver={(event) => {
                  if (canReorder && draggedId && draggedId !== todo.id) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (canReorder) {
                    onReorder(draggedId, todo.id);
                    setDraggedId('');
                  }
                }}
                onDragEnd={() => setDraggedId('')}
                className={`todo-row ${todo.done ? 'done' : ''} ${todo.archived ? 'archived' : ''} ${overdue ? 'overdue' : ''} ${draggedId === todo.id ? 'dragging' : ''}`}
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {editing ? (
                  <div className="todo-editor">
                    <input value={draft.text} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, text: event.target.value }))} placeholder="Task title" />
                    <textarea value={draft.notes} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, notes: event.target.value }))} rows={3} placeholder="Notes" />
                    <div className="todo-editor-grid">
                      <div className="todo-editor-category">
                        <select value={draft.categoryChoice} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, categoryChoice: event.target.value }))}>
                          {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        {draft.categoryChoice === 'Others' && (
                          <input
                            value={draft.customCategory}
                            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, customCategory: event.target.value }))}
                            placeholder="Custom category"
                            list="edit-custom-categories"
                          />
                        )}
                        <datalist id="edit-custom-categories">
                          {(customCategories || []).map((category) => <option key={category} value={category} />)}
                        </datalist>
                      </div>
                      <select value={draft.priority} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, priority: event.target.value }))}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <select value={draft.recurrence} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, recurrence: event.target.value }))}>
                        <option value="none">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <select value={draft.projectId} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, projectId: event.target.value }))}>
                        {projects.map((projectItem) => <option key={projectItem.id} value={projectItem.id}>{projectItem.name}</option>)}
                      </select>
                      <input type="date" value={draft.dueDate} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, dueDate: event.target.value }))} />
                    </div>
                    <div className="todo-editor-actions">
                      <button className="primary-btn" type="button" onClick={() => save(todo.id)}>Save</button>
                      <button className="ghost-btn" type="button" onClick={stopEditing}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="todo-cell status-cell">
                      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
                    </div>

                    <div className="todo-cell task-cell">
                      <p className="todo-title">{todo.text}</p>
                      <div className="todo-badges">
                        {todo.category && <span className="badge">{todo.category}</span>}
                        {todo.recurrence !== 'none' && <span className="badge">{capitalize(todo.recurrence)}</span>}
                        {todo.archived && <span className="badge">Archived</span>}
                      </div>
                      <div className="todo-mobile-meta" aria-hidden="true">
                        <span className="meta-project">{projectName}</span>
                        <span className={`meta-priority meta-priority-${todo.priority}`}>{capitalize(todo.priority)}</span>
                        <span className={`meta-due ${overdue ? 'meta-due-overdue' : dueToday ? 'meta-due-today' : ''}`}>{dueLabel}</span>
                      </div>
                      {todo.notes && <p className="todo-notes">{todo.notes}</p>}
                      <p className="todo-meta-line">Updated {formatStamp(todo.updatedAt || todo.createdAt)}</p>
                    </div>

                    <div className="todo-cell list-cell">{projectName}</div>

                    <div className="todo-cell">
                      <span className={`badge priority-${todo.priority}`}>{capitalize(todo.priority)}</span>
                    </div>

                    <div className="todo-cell">
                      <span className={`badge ${overdue ? 'badge-danger' : dueToday ? 'badge-info' : ''}`}>
                        {dueLabel}
                      </span>
                    </div>

                    <div className="todo-actions todo-cell">
                      <button className="ghost-btn" type="button" onClick={() => startEditing(todo)}>Edit</button>
                      <button className="ghost-btn" type="button" onClick={() => onArchive(todo.id)}>{todo.archived ? 'Restore' : 'Archive'}</button>
                      <motion.button whileTap={{ scale: 0.9 }} whileHover={{ rotate: 6 }} className="delete" type="button" onClick={() => onDelete(todo.id)} aria-label="Delete todo">Delete</motion.button>
                    </div>
                  </>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </section>
  );
}

function emptyEditor() {
  return {
    text: '',
    notes: '',
    category: '',
    categoryChoice: 'Work',
    customCategory: '',
    priority: 'medium',
    dueDate: '',
    recurrence: 'none',
    projectId: '',
  };
}

function isPresetCategory(value) {
  if (!value || typeof value !== 'string') return false;
  return PRESET_CATEGORY_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase());
}

function hasCategoryOption(options, value) {
  if (!Array.isArray(options) || !value || typeof value !== 'string') return false;
  return options.some((option) => option.toLowerCase() === value.toLowerCase());
}

function toDateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDue(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatStamp(value) {
  if (!value) return 'today';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isDueToday(todo) {
  if (!todo.dueDate) return false;
  const due = new Date(todo.dueDate);
  const today = new Date();
  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
}

function isOverdue(todo) {
  if (!todo.dueDate || todo.done) return false;
  const due = new Date(todo.dueDate);
  const endOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
  return endOfDueDay.getTime() < Date.now();
}