from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

app = FastAPI(
    title="Todo API",
    description="A simple Todo API built with FastAPI",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class TodoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    completed: bool = False

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None

class Todo(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    completed: bool
    created_at: datetime
    updated_at: datetime

# In-memory storage
todos: dict[str, Todo] = {}

# Routes
@app.get("/")
def root():
    return {"message": "Welcome to Todo API"}

@app.get("/todos", response_model=List[Todo])
def get_todos(skip: int = 0, limit: int = 100):
    """Get all todos with pagination"""
    todo_list = list(todos.values())
    return todo_list[skip : skip + limit]

@app.post("/todos", response_model=Todo)
def create_todo(todo: TodoCreate):
    """Create a new todo"""
    todo_id = str(uuid.uuid4())
    now = datetime.now()
    
    new_todo = Todo(
        id=todo_id,
        title=todo.title,
        description=todo.description,
        completed=todo.completed,
        created_at=now,
        updated_at=now
    )
    
    todos[todo_id] = new_todo
    return new_todo

@app.get("/todos/{todo_id}", response_model=Todo)
def get_todo(todo_id: str):
    """Get a specific todo by ID"""
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todos[todo_id]

@app.put("/todos/{todo_id}", response_model=Todo)
def update_todo(todo_id: str, todo_update: TodoUpdate):
    """Update a todo"""
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    existing_todo = todos[todo_id]
    update_data = todo_update.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(existing_todo, field, value)
    
    existing_todo.updated_at = datetime.now()
    return existing_todo

@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: str):
    """Delete a todo"""
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    del todos[todo_id]
    return {"message": "Todo deleted successfully"}

@app.get("/todos/search", response_model=List[Todo])
def search_todos(q: str):
    """Search todos by title or description"""
    results = []
    query = q.lower()
    
    for todo in todos.values():
        if query in todo.title.lower() or (todo.description and query in todo.description.lower()):
            results.append(todo)
    
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)