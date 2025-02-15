export default function TodoList({ todos, onToggle, onDelete }) {
  if (todos.length === 0) {
    return <p className="empty">No todos yet. Add one!</p>;
  }
  return (
    <ul className="todo-list">
      {todos.map(todo => (
        <li key={todo.id} className={todo.done ? 'done' : ''}>
          <label>
            <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
            <span>{todo.text}</span>
          </label>
          <button className="delete" onClick={() => onDelete(todo.id)} aria-label="Delete todo">✕</button>
        </li>
      ))}
    </ul>
  );
}
