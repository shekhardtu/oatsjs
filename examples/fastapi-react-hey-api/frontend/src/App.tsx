import React, { useState, useEffect } from 'react';
import { client, getTodos, createTodo, updateTodo, deleteTodo, type Todo } from '@example/api-client';
import './App.css';

// Configure the API client
client.setConfig({
  baseUrl: 'http://localhost:8000',
});

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // Load todos on mount
  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    setLoading(true);
    try {
      const response = await getTodos();
      if (response.data) {
        setTodos(response.data);
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
      const response = await createTodo({
        body: {
          title: newTodoTitle,
          completed: false,
        },
      });
      
      if (response.data) {
        setTodos([...todos, response.data]);
        setNewTodoTitle('');
      }
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      const response = await updateTodo({
        path: { todo_id: todo.id },
        body: {
          completed: !todo.completed,
        },
      });
      
      if (response.data) {
        setTodos(todos.map(t => t.id === todo.id ? response.data : t));
      }
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await deleteTodo({
        path: { todo_id: todoId },
      });
      setTodos(todos.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Todo App</h1>
        <p>Built with FastAPI + React + OATSJS</p>
      </header>

      <main>
        <form onSubmit={handleCreateTodo} className="todo-form">
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="todo-input"
          />
          <button type="submit" className="add-button">Add</button>
        </form>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo)}
                />
                <span className="todo-title">{todo.title}</span>
                <button onClick={() => handleDeleteTodo(todo.id)} className="delete-button">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {todos.length === 0 && !loading && (
          <p className="empty-state">No todos yet. Create one above!</p>
        )}
      </main>
    </div>
  );
}

export default App;