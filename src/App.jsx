import { useState } from 'react';
import TodoInput from './components/TodoInput';
import TodoList from './components/TodoList';
import './app.css';

export default function App() {
  const [todos, setTodos] = useState([]);

  const addTodo = (text) => {
    if(!text.trim()) return;
    setTodos(prev => [...prev, { id: crypto.randomUUID(), text: text.trim(), done: false }]);
  };

  const toggleTodo = (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(t => !t.done));
  }

  return (
    <div className="app-container">
      <h1>Todo List</h1>
      <TodoInput onAdd={addTodo} />
      <TodoList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />
      {todos.some(t => t.done) && (
        <button className="clear-btn" onClick={clearCompleted}>Clear Completed</button>
      )}
    </div>
  );
}
