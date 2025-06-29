import React, { useState, useEffect } from 'react';
import { OpenAPI, TodosService, type Todo, type TodoCreate, type TodoUpdate } from '@example/todo-api-client';
import './App.css';

// Configure the API client
OpenAPI.BASE = 'http://localhost:4000';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load todos on mount
  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    setLoading(true);
    setError(null);
    try {
      const todoList = await TodosService.getTodos();
      setTodos(todoList);
    } catch (error) {
      console.error('Failed to load todos:', error);
      setError('Failed to load todos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    setError(null);
    const todoData: TodoCreate = {
      title: newTodoTitle,
      description: newTodoDescription || undefined,
      completed: false,
    };

    try {
      const newTodo = await TodosService.createTodo({
        requestBody: todoData,
      });
      
      setTodos([...todos, newTodo]);
      setNewTodoTitle('');
      setNewTodoDescription('');
    } catch (error) {
      console.error('Failed to create todo:', error);
      setError('Failed to create todo. Please try again.');
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    setError(null);
    const updateData: TodoUpdate = {
      completed: !todo.completed,
    };

    try {
      const updatedTodo = await TodosService.updateTodo({
        id: todo.id,
        requestBody: updateData,
      });
      
      setTodos(todos.map(t => t.id === todo.id ? updatedTodo : t));
    } catch (error) {
      console.error('Failed to update todo:', error);
      setError('Failed to update todo. Please try again.');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    setError(null);
    try {
      await TodosService.deleteTodo({
        id: todoId,
      });
      setTodos(todos.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('Failed to delete todo:', error);
      setError('Failed to delete todo. Please try again.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Todo App</h1>
        <p>Built with Express + React + OATSJS</p>
        <p className="tech-stack">Using @hey-api/openapi-ts with Axios</p>
      </header>

      <main>
        <form onSubmit={handleCreateTodo} className="todo-form">
          <div className="form-group">
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="todo-input"
            />
            <input
              type="text"
              value={newTodoDescription}
              onChange={(e) => setNewTodoDescription(e.target.value)}
              placeholder="Description (optional)"
              className="todo-input description"
            />
          </div>
          <button type="submit" className="add-button">Add Todo</button>
        </form>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {loading ? (
          <p className="loading">Loading todos...</p>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                <div className="todo-content">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleTodo(todo)}
                    className="todo-checkbox"
                  />
                  <div className="todo-text">
                    <span className="todo-title">{todo.title}</span>
                    {todo.description && (
                      <span className="todo-description">{todo.description}</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteTodo(todo.id)} 
                  className="delete-button"
                  aria-label="Delete todo"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {todos.length === 0 && !loading && (
          <p className="empty-state">No todos yet. Create one above!</p>
        )}

        <div className="stats">
          <p>{todos.filter(t => !t.completed).length} active, {todos.filter(t => t.completed).length} completed</p>
        </div>
      </main>
    </div>
  );
}

export default App;