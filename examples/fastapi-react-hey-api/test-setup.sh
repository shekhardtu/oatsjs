#!/bin/bash

echo "🌾 Testing OATSJS with FastAPI + React + @hey-api/openapi-ts"
echo "=============================================="

# Check prerequisites
echo "Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi
echo "✅ Python 3 found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi
echo "✅ Node.js found"

# Check oatsjs
if ! command -v oatsjs &> /dev/null; then
    echo "⚠️  OATSJS not found globally. Using npx instead."
    OATS_CMD="npx oatsjs"
else
    echo "✅ OATSJS found"
    OATS_CMD="oatsjs"
fi

echo ""
echo "Setting up backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt

# Test FastAPI
echo ""
echo "Testing FastAPI backend..."
python -c "import fastapi; print('✅ FastAPI installed successfully')"

cd ..

echo ""
echo "Setting up client..."
cd client
npm install
cd ..

echo ""
echo "Setting up frontend..."
cd frontend
npm install
cd ..

echo ""
echo "=============================================="
echo "✅ Setup complete!"
echo ""
echo "To test OATSJS:"
echo "1. Navigate to frontend: cd frontend"
echo "2. Run: $OATS_CMD start"
echo "3. Open http://localhost:3000 in your browser"
echo "4. The FastAPI docs will be at http://localhost:8000/docs"
echo ""
echo "To test the sync:"
echo "1. Modify the FastAPI endpoints in backend/main.py"
echo "2. Watch OATSJS automatically regenerate the TypeScript client"
echo "3. See the changes reflected in the React app"
echo ""