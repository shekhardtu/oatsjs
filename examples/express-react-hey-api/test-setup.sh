#!/bin/bash

echo "🌾 Testing OATSJS with Express + React + @hey-api/openapi-ts (Axios)"
echo "=========================================================="

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi
echo "✅ Node.js found ($(node -v))"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi
echo "✅ npm found ($(npm -v))"

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
echo "Installing Node.js dependencies..."
npm install

# Generate initial swagger.json
echo "Generating initial swagger.json..."
npm run generate-swagger

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
echo "=========================================================="
echo "✅ Setup complete!"
echo ""
echo "To test OATSJS:"
echo "1. Navigate to frontend: cd frontend"
echo "2. Run: $OATS_CMD start"
echo "3. Open http://localhost:3000 in your browser"
echo "4. The Express API will be at http://localhost:4000"
echo "5. API docs will be at http://localhost:4000/docs"
echo ""
echo "To test the sync:"
echo "1. Modify the Express API in backend/src/index.js"
echo "2. Add or modify @swagger comments and endpoints"
echo "3. Watch OATSJS automatically regenerate the TypeScript client"
echo "4. See the changes reflected in the React app with full type safety"
echo ""
echo "Key differences from FastAPI example:"
echo "- Uses Express.js with swagger-jsdoc for OpenAPI generation"
echo "- Client uses Axios instead of Fetch API"
echo "- Swagger spec is generated from JSDoc comments"
echo ""