import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const PRESET_CATEGORY_OPTIONS = ['Work', 'Education', 'Personal', 'Family', 'Gym'];

const emptyDraft = {
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

export default function TodoInput({ onAdd, customCategories, projects, selectedProjectId }) {
  const [draft, setDraft] = useState(emptyDraft);
  const customCategoryOptions = Array.isArray(customCategories)
    ? customCategories.filter((item) => {
      if (typeof item !== 'string' || !item.trim()) return false;
      const normalized = item.trim().toLowerCase();
      return !PRESET_CATEGORY_OPTIONS.some((preset) => preset.toLowerCase() === normalized) && normalized !== 'others';
    })
    : [];
  const categoryOptions = [...PRESET_CATEGORY_OPTIONS, ...customCategoryOptions, 'Others'];

  useEffect(() => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      projectId: currentDraft.projectId || selectedProjectId || projects[0]?.id || '',
    }));
  }, [projects, selectedProjectId]);

  const updateField = (field, value) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const resolvedCategory = draft.categoryChoice === 'Others'
      ? draft.customCategory.trim()
      : draft.categoryChoice;

    const saved = await onAdd({
      ...draft,
      category: resolvedCategory,
      projectId: draft.projectId || selectedProjectId || projects[0]?.id || '',
    });
    if (saved) {
      setDraft((currentDraft) => ({ ...emptyDraft, projectId: currentDraft.projectId || selectedProjectId || projects[0]?.id || '' }));
    }
  };

  return (
    <motion.form onSubmit={submit} className="task-composer" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="composer-head">
        <h3>Task details</h3>
        <p>Capture the task clearly, then set context and schedule.</p>
      </div>

      <div className="composer-layout">
        <div className="composer-main">
          <label className="field-block field-card">
            <span>Task name</span>
            <input value={draft.text} onChange={(event) => updateField('text', event.target.value)} placeholder="Add a new task..." aria-label="Task title" />
          </label>

          <label className="field-block field-card">
            <span>Notes</span>
            <textarea rows={5} value={draft.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Context, checklist, or next step" />
          </label>
        </div>

        <div className="composer-side-grid">
          <label className="field-block field-card">
            <span>List</span>
            <select value={draft.projectId} onChange={(event) => updateField('projectId', event.target.value)}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>

          <label className="field-block field-card">
            <span>Category</span>
            <select value={draft.categoryChoice} onChange={(event) => updateField('categoryChoice', event.target.value)}>
              {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {draft.categoryChoice === 'Others' && (
              <input
                value={draft.customCategory}
                onChange={(event) => updateField('customCategory', event.target.value)}
                placeholder="Type your category"
              />
            )}
          </label>

          <label className="field-block field-card">
            <span>Priority</span>
            <select value={draft.priority} onChange={(event) => updateField('priority', event.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="field-block field-card">
            <span>Repeat</span>
            <select value={draft.recurrence} onChange={(event) => updateField('recurrence', event.target.value)}>
              <option value="none">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label className="field-block field-card">
            <span>Due date</span>
            <input type="date" value={draft.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} />
          </label>

          <div className="field-block field-card task-submit-field" aria-hidden="true">
            <span>Action</span>
            <button type="submit" className="task-submit-btn">Add Task</button>
          </div>
        </div>
      </div>
    </motion.form>
  );
}