import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 }
};

export default function TodoList({ todos, onToggle, onDelete }) {
  if (todos.length === 0) {
    return <p className="empty">No todos yet. Add one!</p>;
  }
  return (
    <motion.ul className="todo-list" layout>
      <AnimatePresence initial={false}>
        {todos.map(todo => (
          <motion.li
            key={todo.id}
            layout
            className={todo.done ? 'done' : ''}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
              <span>{todo.text}</span>
            </label>
            <motion.button whileTap={{ scale: 0.85 }} whileHover={{ rotate: 90 }} className="delete" onClick={() => onDelete(todo.id)} aria-label="Delete todo">✕</motion.button>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
