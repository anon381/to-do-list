import { useDeferredValue, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TodoInput from './components/TodoInput';
import TodoList from './components/TodoList';
import './app.css';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRESET_CATEGORIES = ['Work', 'Education', 'Personal', 'Family', 'Gym'];

export default function App() {
  const [todos, setTodos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(() => localStorage.getItem('currentProjectId') || 'all');
  const [newProjectName, setNewProjectName] = useState('');
  const [theme, setTheme] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('displayName') || localStorage.getItem('username') || '');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('manual');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
  const endpoint = (path) => `${API_BASE}${path}`;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('currentProjectId', currentProjectId);
    }
  }, [currentProjectId, token]);

  useEffect(() => {
    document.title = "🧭 TaskNova";
  }, [todos]);

  const logout = () => {
    setToken('');
    setDisplayName('');
    setUserEmail('');
    setProfileOpen(false);
    setTodos([]);
    setProjects([]);
    setCustomCategories([]);
    localStorage.removeItem('token');
    localStorage.removeItem('displayName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
  };

  const handleUnauthorized = () => {
    setError('Session expired');
    logout();
  };

  const fetchWorkspace = async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const res = await fetch(endpoint('/todos'), { headers: { Authorization: `Bearer ${activeToken}` } });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      const nextProjects = Array.isArray(data.projects) ? data.projects : [];
      const nextTodos = (data.todos || []).map(normalizeTodo);
      const nextCustomCategories = normalizeCustomCategories(data.customCategories);
      setProjects(nextProjects);
      setTodos(nextTodos);
      setCustomCategories(nextCustomCategories);
      setCurrentProjectId((currentId) => {
        if (currentId === 'all') return currentId;
        if (nextProjects.some((project) => project.id === currentId)) return currentId;
        return nextProjects[0]?.id || 'all';
      });
    } catch (fetchError) {
      console.error('Fetch workspace failed', fetchError);
      setError('Unable to load workspace');
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [token]);

  const addTodo = async (draft) => {
    if (!draft.text.trim() || !token) return false;
    try {
      const res = await fetch(endpoint('/todos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return false;
      }
      if (!res.ok) throw new Error('Add failed');
      const todo = normalizeTodo(await res.json());
      setTodos((prev) => [...prev, todo]);
      if (isCustomCategory(todo.category)) {
        setCustomCategories((prev) => {
          const lower = new Set(prev.map((item) => item.toLowerCase()));
          if (lower.has(todo.category.toLowerCase())) return prev;
          return [...prev, todo.category];
        });
      }
      return true;
    } catch (addError) {
      console.error(addError);
      setError('Add failed');
      return false;
    }
  };

  const updateTodo = async (id, updates) => {
    try {
      const res = await fetch(endpoint(`/todos/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return false;
      }
      if (!res.ok) throw new Error('Update failed');
      const todo = normalizeTodo(await res.json());
      setTodos((prev) => prev.map((item) => item.id === id ? todo : item));
      if (isCustomCategory(todo.category)) {
        setCustomCategories((prev) => {
          const lower = new Set(prev.map((item) => item.toLowerCase()));
          if (lower.has(todo.category.toLowerCase())) return prev;
          return [...prev, todo.category];
        });
      }
      return true;
    } catch (updateError) {
      console.error(updateError);
      setError('Update failed');
      return false;
    }
  };

  const toggleTodo = async (id) => {
    try {
      const res = await fetch(endpoint(`/todos/${id}/toggle`), { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('Toggle failed');
      const updatedTodo = normalizeTodo(await res.json());
      setTodos((prev) => {
        const next = prev.map((todo) => todo.id === id ? updatedTodo : todo);
        return next.some((todo) => todo.id === updatedTodo.nextOccurrenceId) ? next : next;
      });
      fetchWorkspace();
    } catch (toggleError) {
      console.error(toggleError);
      setError('Toggle failed');
    }
  };

  const archiveTodo = async (id) => {
    const currentTodo = todos.find((todo) => todo.id === id);
    if (!currentTodo) return;
    await updateTodo(id, { archived: !currentTodo.archived });
  };

  const deleteTodo = async (id) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    try {
      const res = await fetch(endpoint(`/todos/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('Delete failed');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Delete failed');
      fetchWorkspace();
    }
  };

  const clearCompleted = async () => {
    try {
      const res = await fetch(endpoint('/todos?completed=true'), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('Clear failed');
      fetchWorkspace();
    } catch (clearError) {
      console.error(clearError);
      setError('Clear failed');
    }
  };

  const createProject = async (event) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    try {
      const res = await fetch(endpoint('/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Create project failed');
      const project = await res.json();
      setProjects((prev) => [...prev, project]);
      setCurrentProjectId(project.id);
      setNewProjectName('');
    } catch (projectError) {
      console.error(projectError);
      setError('Unable to create list');
    }
  };

  const reorderTodos = async (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId || currentProjectId === 'all') return;
    const projectTodos = todos
      .filter((todo) => todo.projectId === currentProjectId && !todo.archived)
      .sort((left, right) => left.order - right.order);
    const sourceIndex = projectTodos.findIndex((todo) => todo.id === sourceId);
    const targetIndex = projectTodos.findIndex((todo) => todo.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...projectTodos];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const orderedIds = reordered.map((todo) => todo.id);

    setTodos((prev) => prev.map((todo) => {
      if (todo.projectId !== currentProjectId) return todo;
      const index = orderedIds.indexOf(todo.id);
      return index === -1 ? todo : { ...todo, order: index };
    }));

    try {
      const res = await fetch(endpoint('/todos/reorder'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: currentProjectId, orderedIds }),
      });
      if (!res.ok) throw new Error('Reorder failed');
      const data = await res.json();
      setTodos((data.todos || []).map(normalizeTodo));
    } catch (reorderError) {
      console.error(reorderError);
      setError('Reorder failed');
      fetchWorkspace();
    }
  };

  const authRequest = async (authEndpoint, creds) => {
    setLoading(true);
    setError('');
    try {
      if (authEndpoint === 'signup' && creds.password !== creds.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      const res = await fetch(`${API_BASE}/${authEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
      const nextDisplayName = data.name || data.username || '';
      setToken(data.token);
      setDisplayName(nextDisplayName);
      setUserEmail(data.email || '');
      localStorage.setItem('token', data.token);
      localStorage.setItem('displayName', nextDisplayName);
      localStorage.setItem('userEmail', data.email || '');
      fetchWorkspace(data.token);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  };

  const projectScopedTodos = todos.filter((todo) => currentProjectId === 'all' ? true : todo.projectId === currentProjectId);
  const categories = Array.from(new Set([
    ...PRESET_CATEGORIES,
    ...customCategories,
    ...projectScopedTodos.map((todo) => todo.category).filter(Boolean),
  ])).sort((left, right) => left.localeCompare(right));
  const visiblePool = projectScopedTodos.filter((todo) => showArchived ? todo.archived : !todo.archived);
  const filteredTodos = visiblePool
    .filter((todo) => matchesSearch(todo, deferredQuery))
    .filter((todo) => matchesStatus(todo, statusFilter))
    .filter((todo) => priorityFilter === 'all' ? true : todo.priority === priorityFilter)
    .filter((todo) => categoryFilter === 'all' ? true : todo.category === categoryFilter)
    .sort((left, right) => compareTodos(left, right, sortBy));
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredTodos.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pagedTodos = filteredTodos.slice(pageStart, pageStart + pageSize);

  const activeProject = projects.find((project) => project.id === currentProjectId) || null;
  const liveTodos = todos.filter((todo) => !todo.archived);
  const listOptions = [
    { id: 'all', name: 'All Lists', count: liveTodos.length },
    ...projects.map((project) => ({
      id: project.id,
      name: project.name,
      count: todos.filter((todo) => todo.projectId === project.id && !todo.archived).length,
    })),
  ];
  const stats = [
    { label: 'Open', value: projectScopedTodos.filter((todo) => !todo.done && !todo.archived).length, tone: 'primary' },
    { label: 'Recurring', value: projectScopedTodos.filter((todo) => todo.recurrence !== 'none' && !todo.archived).length, tone: 'info' },
    { label: 'Overdue', value: projectScopedTodos.filter(isOverdue).length, tone: 'danger' },
    { label: 'High Priority', value: projectScopedTodos.filter((todo) => todo.priority === 'high' && !todo.archived).length, tone: 'warning' },
  ];

  const canReorder = currentProjectId !== 'all' && sortBy === 'manual' && !deferredQuery && statusFilter === 'all' && priorityFilter === 'all' && categoryFilter === 'all' && !showArchived;
  const filteredEmptyMessage = showArchived ? 'No archived tasks in this list.' : 'No tasks in this view yet.';

  useEffect(() => {
    setCurrentPage(1);
  }, [currentProjectId, deferredQuery, statusFilter, priorityFilter, categoryFilter, sortBy, showArchived]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div className="app-shell">
      {token && (
        <nav className="top-nav" aria-label="Profile actions">
          <div className="nav-left">
            <strong className="nav-brand"><span className="title-icon" aria-hidden="true">🧭</span> TaskNova</strong>
          </div>
          <div className="nav-right">
            <button className="theme-toggle" onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? '🌞' : '🌙'}
            </button>
            <div className="profile-wrap">
              <button className="profile-trigger" onClick={() => setProfileOpen((open) => !open)}>
                Profile
              </button>
              {profileOpen && (
                <div className="profile-menu" role="menu">
                  <p className="profile-name">{displayName || 'User'}</p>
                  <p className="profile-email">{userEmail || 'No email available'}</p>
                  <button className="logout-btn" onClick={logout}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
      <motion.div className="app-container" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <header className="app-header">
          <div className="title-wrap">
            <motion.h1 layoutId="title" className="gradient-text"><span className="title-icon" aria-hidden="true">🧭</span> TaskNova</motion.h1>
          </div>
        </header>

        {error && <div className="error-banner" role="alert">{error} <button className="dismiss" onClick={() => setError('')}>✕</button></div>}

        {!token ? (
          <AuthPanel onSubmit={authRequest} loading={loading} error={error} />
        ) : (
          <>
            <motion.section className="project-shell" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45 }}>
              <div className="project-header-row">
                <div className="manage-inline-row">
                  <h2 className="section-title">Manage Lists</h2>
                  <div className="workspace-inline">
                    <span className="workspace-label">Workspace</span>
                    <label className="nav-list-picker">
                      <span>List</span>
                      <select value={currentProjectId} onChange={(event) => setCurrentProjectId(event.target.value)}>
                        {listOptions.map((listItem) => (
                          <option key={listItem.id} value={listItem.id}>{`${listItem.name} (${listItem.count})`}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <form className="project-create-form" onSubmit={createProject}>
                  <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="New list name" aria-label="New list name" />
                  <button type="submit">Add list</button>
                </form>
              </div>
            </motion.section>

            <motion.section className="stats-grid compact" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, delay: 0.05 }}>
              {stats.map((stat) => (
                <article key={stat.label} className={`stat-card stat-${stat.tone}`}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </motion.section>

            <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, delay: 0.08 }}>
              <TodoInput
                onAdd={addTodo}
                customCategories={customCategories}
                projects={projects}
                selectedProjectId={currentProjectId === 'all' ? activeProject?.id || projects[0]?.id || '' : currentProjectId}
              />
            </motion.div>

            <motion.section className="planner-toolbar" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, delay: 0.1 }}>
              <div className="toolbar-search">
                <label htmlFor="task-search">Search</label>
                <input id="task-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search title, notes, category, or list" />
              </div>
              <div className="toolbar-controls">
                <label>
                  <span>Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="today">Due Today</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label>
                  <span>Category</span>
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="all">All categories</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  <span>Sort</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="manual">Manual order</option>
                    <option value="due-soon">Due soon</option>
                    <option value="priority">Priority</option>
                    <option value="newest">Newest</option>
                  </select>
                </label>
                <button className={`archive-toggle ${showArchived ? 'active' : ''}`} onClick={() => setShowArchived((currentValue) => !currentValue)}>
                  {showArchived ? 'Archived View' : 'Archived'}
                  <span>{projectScopedTodos.filter((todo) => todo.archived).length}</span>
                </button>
              </div>
            </motion.section>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.5, delay: 0.12 }}>
              <TodoList
                todos={pagedTodos}
                projects={projects}
                currentProjectId={currentProjectId}
                customCategories={customCategories}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onUpdate={updateTodo}
                onArchive={archiveTodo}
                onReorder={reorderTodos}
                canReorder={canReorder}
                emptyMessage={filteredEmptyMessage}
              />

              {filteredTodos.length > pageSize && (
                <nav className="table-pagination" aria-label="Todo table pagination">
                  <button type="button" className="ghost-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Back</button>
                  <div className="pagination-pages">
                    {Array.from({ length: totalPages }, (_, index) => {
                      const page = index + 1;
                      return (
                        <button
                          type="button"
                          key={page}
                          className={`page-btn ${page === currentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="ghost-btn" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
                </nav>
              )}
            </motion.div>

            <AnimatePresence>
              {!showArchived && projectScopedTodos.some((todo) => todo.done) && (
                <motion.button key="clear" className="clear-btn" onClick={clearCompleted} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  Clear Completed
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
}

function AuthPanel({ onSubmit, loading, error }) {
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const toggle = () => setMode((currentMode) => currentMode === 'login' ? 'signup' : 'login');
  const submit = (event) => {
    event.preventDefault();
    onSubmit(mode === 'login' ? 'login' : 'signup', mode === 'login' ? loginForm : signupForm);
  };

  return (
    <motion.div className="auth-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <form key={mode} onSubmit={submit} className="auth-form">
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        {mode === 'signup' && (
          <label>
            <span>Name</span>
            <input autoComplete="name" required value={signupForm.name} onChange={(event) => setSignupForm({ ...signupForm, name: event.target.value })} />
          </label>
        )}
        <label>
          <span>Email</span>
          <input type="email" autoComplete={mode === 'login' ? 'username' : 'email'} required value={mode === 'login' ? loginForm.email : signupForm.email} onChange={(event) => mode === 'login' ? setLoginForm({ ...loginForm, email: event.target.value }) : setSignupForm({ ...signupForm, email: event.target.value })} />
        </label>
        <label>
          <span>Password</span>
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={mode === 'login' ? loginForm.password : signupForm.password} onChange={(event) => mode === 'login' ? setLoginForm({ ...loginForm, password: event.target.value }) : setSignupForm({ ...signupForm, password: event.target.value })} />
        </label>
        {mode === 'signup' && (
          <label>
            <span>Re-enter password</span>
            <input type="password" autoComplete="new-password" required value={signupForm.confirmPassword} onChange={(event) => setSignupForm({ ...signupForm, confirmPassword: event.target.value })} />
          </label>
        )}
        {error && <div className="error-msg" role="alert">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Sign up')}</button>
        <button type="button" className="link-btn" onClick={toggle}>{mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}</button>
      </form>
    </motion.div>
  );
}

function normalizeTodo(todo) {
  return {
    ...todo,
    notes: typeof todo.notes === 'string' ? todo.notes : '',
    category: typeof todo.category === 'string' ? todo.category : '',
    priority: ['low', 'medium', 'high'].includes(todo.priority) ? todo.priority : 'medium',
    recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(todo.recurrence) ? todo.recurrence : 'none',
    dueDate: todo.dueDate || null,
    archived: Boolean(todo.archived),
    done: Boolean(todo.done),
    order: Number.isFinite(Number(todo.order)) ? Number(todo.order) : 0,
  };
}

function matchesSearch(todo, query) {
  if (!query) return true;
  const haystack = [todo.text, todo.notes, todo.category, todo.projectName].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

function matchesStatus(todo, status) {
  if (status === 'all') return true;
  if (status === 'active') return !todo.done;
  if (status === 'completed') return todo.done;
  if (status === 'today') return isDueToday(todo);
  if (status === 'upcoming') return !todo.done && Boolean(todo.dueDate) && !isDueToday(todo) && !isOverdue(todo);
  if (status === 'overdue') return isOverdue(todo);
  return true;
}

function compareTodos(left, right, sortBy) {
  if (sortBy === 'manual') return left.order - right.order;
  if (sortBy === 'priority') return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] || compareDates(right.createdAt, left.createdAt);
  if (sortBy === 'newest') return compareDates(right.createdAt, left.createdAt);
  return compareDueDates(left.dueDate, right.dueDate) || (left.order - right.order);
}

function compareDates(left, right) {
  return new Date(left || 0).getTime() - new Date(right || 0).getTime();
}

function compareDueDates(left, right) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return new Date(left).getTime() - new Date(right).getTime();
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

function normalizeCustomCategories(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const normalized = [];
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key) || PRESET_CATEGORIES.some((preset) => preset.toLowerCase() === key)) return;
    seen.add(key);
    normalized.push(trimmed);
  });
  return normalized;
}

function isCustomCategory(value) {
  if (typeof value !== 'string') return false;
  const category = value.trim().toLowerCase();
  if (!category) return false;
  return !PRESET_CATEGORIES.some((preset) => preset.toLowerCase() === category) && category !== 'others';
}