import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TodoInput from './components/TodoInput';
import TodoList from './components/TodoList';
import './app.css';

export default function App() {
  const [todos, setTodos] = useState([]);
  const [theme, setTheme] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API = 'http://localhost:4000';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Dynamic page title reflecting remaining tasks
  useEffect(() => {
    const remaining = todos.filter(t => !t.done).length;
    document.title = remaining > 0 ? `Todo List (${remaining} pending)` : 'Todo List';
  }, [todos]);

  const fetchTodos = async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const res = await fetch(`${API}/todos`, { headers: { Authorization: `Bearer ${activeToken}` } });
      if (!res.ok) throw new Error('Failed to load todos');
      const data = await res.json();
      setTodos(data.todos || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchTodos(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addTodo = async (text) => {
    if(!text.trim() || !token) return;
    try {
      const res = await fetch(`${API}/todos`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ text }) });
      if(!res.ok) throw new Error('Add failed');
      const todo = await res.json();
      setTodos(prev => [...prev, todo]);
    } catch(e){ console.error(e); }
  };

  const toggleTodo = async (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    try { await fetch(`${API}/todos/${id}/toggle`, { method:'PATCH', headers:{ Authorization:`Bearer ${token}` } }); } catch(e){ console.error(e); }
  };

  const deleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try { await fetch(`${API}/todos/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } }); } catch(e){ console.error(e); }
  };

  const clearCompleted = async () => {
    setTodos(prev => prev.filter(t => !t.done));
    try { await fetch(`${API}/todos?completed=true`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } }); } catch(e){ console.error(e); }
  }

  const authRequest = async (endpoint, creds) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(creds) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Auth failed');
      setToken(data.token); setUsername(data.username);
      localStorage.setItem('token', data.token); localStorage.setItem('username', data.username);
      fetchTodos(data.token);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  };

  const logout = () => {
    setToken(''); setUsername(''); setTodos([]); localStorage.removeItem('token'); localStorage.removeItem('username');
  };

  return (
    <div className="app-shell">
      <motion.div
        className="app-container"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <header className="app-header">
          <div className="title-wrap">
            <motion.h1 layoutId="title" className="gradient-text">Todo List</motion.h1>
            <span className="count-chip" aria-label="Total tasks">{todos.length}</span>
          </div>
          <div className="header-actions">
            {token && <span className="user-chip">{username}</span>}
            <button
              className="theme-toggle"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >{theme === 'dark' ? '🌞' : '🌙'}</button>
            {token && <button className="logout-btn" onClick={logout}>Logout</button>}
          </div>
        </header>
        {!token ? (
          <AuthPanel onSubmit={authRequest} loading={loading} error={error} />
        ) : (
          <>
            <TodoInput onAdd={addTodo} />
            <AnimatePresence initial={false} mode="popLayout">
              <TodoList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />
            </AnimatePresence>
          </>
        )}
        <AnimatePresence>
          {todos.some(t => t.done) && (
            <motion.button
              key="clear"
              className="clear-btn"
              onClick={clearCompleted}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >Clear Completed</motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      <footer className="app-footer">Built with React + Vite</footer>
    </div>
  );
}

function AuthPanel({ onSubmit, loading, error }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const toggle = () => setMode(m => m === 'login' ? 'signup' : 'login');
  const submit = (e) => { e.preventDefault(); onSubmit(mode === 'login' ? 'login' : 'signup', form); };
  return (
    <motion.div className="auth-panel" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
      <form onSubmit={submit} className="auth-form">
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        <label>
          <span>Username</span>
          <input autoComplete="username" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>
          <span>Password</span>
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <div className="error-msg" role="alert">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Sign up')}</button>
        <button type="button" className="link-btn" onClick={toggle}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </motion.div>
  );
}
