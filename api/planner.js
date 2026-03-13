import { randomUUID } from 'crypto';

const PRIORITY_VALUES = new Set(['low', 'medium', 'high']);
const RECURRENCE_VALUES = new Set(['none', 'daily', 'weekly', 'monthly']);
const PRESET_CATEGORIES = new Set(['work', 'education', 'personal', 'family', 'gym', 'others']);

export function createProject(input = {}) {
  return {
    id: input.id || randomUUID(),
    name: sanitizeProjectName(input.name),
    createdAt: normalizeTimestamp(input.createdAt) || new Date().toISOString(),
  };
}

export function normalizeUserDocument(user) {
  const projects = normalizeProjects(user?.projects);
  const todos = normalizeTodos(user?.todos, projects);
  const customCategories = normalizeCustomCategories(user?.customCategories);
  return { projects, todos, customCategories };
}

export function normalizeCustomCategories(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const normalized = [];
  input.forEach((item) => {
    if (typeof item !== 'string') return;
    const value = item.trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (PRESET_CATEGORIES.has(key) || seen.has(key)) return;
    seen.add(key);
    normalized.push(value);
  });
  return normalized;
}

export function shouldPersistCustomCategory(category) {
  if (typeof category !== 'string') return false;
  const value = category.trim().toLowerCase();
  return Boolean(value) && !PRESET_CATEGORIES.has(value);
}

export function buildTodoPayload(input = {}, existingTodo = {}, defaultProjectId, preserveTimestamps = false) {
  const text = pickString(input.text, existingTodo.text);
  const notes = pickString(input.notes, existingTodo.notes, '');
  const category = pickString(input.category, existingTodo.category, '');
  const priority = normalizePriority(input.priority ?? existingTodo.priority);
  const recurrence = normalizeRecurrence(input.recurrence ?? existingTodo.recurrence);
  const dueDate = normalizeDueDate(Object.prototype.hasOwnProperty.call(input, 'dueDate') ? input.dueDate : existingTodo.dueDate);
  const projectId = pickString(input.projectId, existingTodo.projectId, defaultProjectId) || defaultProjectId;
  const done = typeof input.done === 'boolean' ? input.done : Boolean(existingTodo.done);
  const archived = typeof input.archived === 'boolean' ? input.archived : Boolean(existingTodo.archived);
  const completedAt = done ? normalizeTimestamp(input.completedAt ?? existingTodo.completedAt) : null;

  return {
    id: existingTodo.id || input.id || randomUUID(),
    text,
    notes,
    category,
    priority,
    recurrence,
    dueDate,
    projectId,
    order: normalizeOrder(input.order ?? existingTodo.order),
    done,
    archived,
    completedAt,
    nextOccurrenceId: recurrence === 'none' ? null : (existingTodo.nextOccurrenceId || input.nextOccurrenceId || null),
    seriesId: existingTodo.seriesId || input.seriesId || existingTodo.id || input.id || null,
    sourceOccurrenceId: existingTodo.sourceOccurrenceId || input.sourceOccurrenceId || null,
    createdAt: preserveTimestamps ? normalizeTimestamp(existingTodo.createdAt || input.createdAt) || new Date().toISOString() : undefined,
    updatedAt: preserveTimestamps ? normalizeTimestamp(existingTodo.updatedAt || input.updatedAt || existingTodo.createdAt) || new Date().toISOString() : undefined,
  };
}

export function reorderProjectTodos(todos, projectId, orderedIds) {
  const ids = Array.isArray(orderedIds) ? orderedIds : [];
  const orderedSet = new Set(ids);
  const projectTodos = todos.filter((todo) => todo.projectId === projectId).sort((left, right) => left.order - right.order);
  const orderedTodos = ids
    .map((id) => projectTodos.find((todo) => todo.id === id))
    .filter(Boolean);
  const remainingTodos = projectTodos.filter((todo) => !orderedSet.has(todo.id));
  const nextProjectTodos = [...orderedTodos, ...remainingTodos].map((todo, index) => ({ ...todo, order: index }));
  const nextProjectMap = new Map(nextProjectTodos.map((todo) => [todo.id, todo]));
  const nextTodos = todos.map((todo) => nextProjectMap.get(todo.id) || todo);
  return normalizeTodoOrder(nextTodos);
}

export function toggleTodoWithRecurrence(todos, todoId) {
  const nextTodos = [...todos];
  const index = nextTodos.findIndex((todo) => todo.id === todoId);
  if (index === -1) return null;

  const currentTodo = nextTodos[index];
  const now = new Date().toISOString();
  let updatedTodo = {
    ...currentTodo,
    done: !currentTodo.done,
    completedAt: currentTodo.done ? null : now,
    updatedAt: now,
  };

  if (!currentTodo.done && currentTodo.recurrence !== 'none') {
    const existingNext = currentTodo.nextOccurrenceId ? nextTodos.find((todo) => todo.id === currentTodo.nextOccurrenceId) : null;
    if (!existingNext) {
      const nextOccurrence = {
        ...currentTodo,
        id: randomUUID(),
        done: false,
        archived: false,
        completedAt: null,
        nextOccurrenceId: null,
        sourceOccurrenceId: currentTodo.id,
        seriesId: currentTodo.seriesId || currentTodo.id,
        dueDate: computeNextDueDate(currentTodo.dueDate, currentTodo.recurrence, now),
        order: getProjectMaxOrder(nextTodos, currentTodo.projectId) + 1,
        createdAt: now,
        updatedAt: now,
      };
      updatedTodo = {
        ...updatedTodo,
        nextOccurrenceId: nextOccurrence.id,
        seriesId: currentTodo.seriesId || currentTodo.id,
      };
      nextTodos.push(nextOccurrence);
    }
  }

  if (currentTodo.done && currentTodo.recurrence !== 'none' && currentTodo.nextOccurrenceId) {
    const nextIndex = nextTodos.findIndex((todo) => todo.id === currentTodo.nextOccurrenceId && todo.sourceOccurrenceId === currentTodo.id && !todo.done);
    if (nextIndex >= 0) {
      nextTodos.splice(nextIndex, 1);
    }
    updatedTodo = {
      ...updatedTodo,
      nextOccurrenceId: null,
    };
  }

  nextTodos[index] = updatedTodo;
  const normalizedTodos = normalizeTodoOrder(nextTodos);
  return {
    todos: normalizedTodos,
    todo: normalizedTodos.find((todo) => todo.id === updatedTodo.id),
  };
}

export function hasUserDataChanges(originalProjects = [], nextProjects = [], originalTodos = [], nextTodos = [], originalCustomCategories = [], nextCustomCategories = []) {
  return JSON.stringify(originalProjects) !== JSON.stringify(nextProjects)
    || JSON.stringify(originalTodos) !== JSON.stringify(nextTodos)
    || JSON.stringify(originalCustomCategories) !== JSON.stringify(nextCustomCategories);
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return [createProject({ name: 'Inbox' })];
  }

  return projects.map((project) => createProject(project));
}

function normalizeTodos(todos, projects) {
  if (!Array.isArray(todos)) return [];
  const defaultProjectId = projects[0]?.id || createProject({ name: 'Inbox' }).id;
  const projectIds = new Set(projects.map((project) => project.id));

  return normalizeTodoOrder(
    todos.map((todo) => {
      const normalized = buildTodoPayload(todo, todo, defaultProjectId, true);
      if (!projectIds.has(normalized.projectId)) {
        normalized.projectId = defaultProjectId;
      }
      return normalized;
    })
  );
}

function normalizeTodoOrder(todos) {
  const grouped = new Map();
  todos.forEach((todo) => {
    const bucket = grouped.get(todo.projectId) || [];
    bucket.push(todo);
    grouped.set(todo.projectId, bucket);
  });

  const normalized = [];
  grouped.forEach((projectTodos) => {
    projectTodos
      .sort((left, right) => (left.order - right.order) || compareTimestamps(left.createdAt, right.createdAt))
      .forEach((todo, index) => normalized.push({ ...todo, order: index }));
  });

  return normalized;
}

function pickString(value, fallback = '', emptyFallback = fallback) {
  if (typeof value === 'string') return value.trim();
  if (typeof fallback === 'string') return fallback.trim();
  return emptyFallback;
}

function sanitizeProjectName(value) {
  const name = pickString(value, 'Untitled list', 'Untitled list');
  return name || 'Untitled list';
}

function normalizePriority(value) {
  const priority = typeof value === 'string' ? value.toLowerCase() : 'medium';
  return PRIORITY_VALUES.has(priority) ? priority : 'medium';
}

function normalizeRecurrence(value) {
  const recurrence = typeof value === 'string' ? value.toLowerCase() : 'none';
  return RECURRENCE_VALUES.has(recurrence) ? recurrence : 'none';
}

function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeOrder(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function compareTimestamps(left, right) {
  return new Date(left || 0).getTime() - new Date(right || 0).getTime();
}

function computeNextDueDate(currentDueDate, recurrence, fallbackTimestamp) {
  const base = currentDueDate ? new Date(currentDueDate) : new Date(fallbackTimestamp);
  if (recurrence === 'daily') base.setDate(base.getDate() + 1);
  if (recurrence === 'weekly') base.setDate(base.getDate() + 7);
  if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}

function getProjectMaxOrder(todos, projectId) {
  return todos.filter((todo) => todo.projectId === projectId).reduce((maxOrder, todo) => Math.max(maxOrder, todo.order), -1);
}