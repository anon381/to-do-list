import { useState } from 'react';
import { motion } from 'framer-motion';

export default function TodoInput({ onAdd }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    onAdd(value);
    setValue('');
  };
// motion frame
  return (
    <motion.form onSubmit={submit} className="todo-input-form" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Add a new task..."
        aria-label="Todo text"
      />
      <motion.button type="submit" whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>Add</motion.button>
    </motion.form>
  );
}
