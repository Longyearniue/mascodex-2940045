#!/bin/bash

# AI CEO Clone Interface Deployment Script
# This script automates the deployment process for both backend and frontend

set -e

echo "🚀 AI CEO Clone Interface Deployment Script"
echo "=========================================="

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 is not installed. Please install Python 3.9+"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 16+"
        exit 1
    fi
    
    if ! command -v poetry &> /dev/null; then
        echo "❌ Poetry is not installed. Please install Poetry"
        echo "   curl -sSL https://install.python-poetry.org | python3 -"
        exit 1
    fi
    
    echo "✅ All requirements are satisfied"
}

# Setup backend
setup_backend() {
    echo "🔧 Setting up backend..."
    cd backend
    
    # Install dependencies
    echo "📦 Installing Python dependencies..."
    poetry install
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo "📝 Creating .env file..."
        cp .env.example .env
        echo "⚠️  Please edit backend/.env file with your API keys"
    fi
    
    # Initialize database
    echo "🗄️  Initializing database..."
    poetry run python init_db.py
    
    echo "✅ Backend setup completed"
    cd ..
}

# Setup frontend
setup_frontend() {
    echo "🔧 Setting up frontend..."
    cd frontend
    
    # Install dependencies
    echo "📦 Installing Node.js dependencies..."
    npm install
    
    echo "✅ Frontend setup completed"
    cd ..
}

# Start development servers
start_dev_servers() {
    echo "🚀 Starting development servers..."
    
    # Start backend in background
    echo "🔧 Starting backend server..."
    cd backend
    poetry run uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    cd ..
    
    # Start frontend in background
    echo "🎨 Starting frontend server..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    echo "✅ Development servers started"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔧 Backend: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    
    # Wait for user to stop servers
    echo ""
    echo "Press Ctrl+C to stop all servers"
    trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
    wait
}

# Build for production
build_production() {
    echo "🏗️  Building for production..."
    
    # Build frontend
    echo "🎨 Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    echo "✅ Production build completed"
    echo "📁 Frontend build files are in frontend/dist/"
}

# Main deployment function
main() {
    case "${1:-dev}" in
        "dev")
            check_requirements
            setup_backend
            setup_frontend
            start_dev_servers
            ;;
        "prod")
            check_requirements
            setup_backend
            setup_frontend
            build_production
            ;;
        "backend")
            check_requirements
            setup_backend
            ;;
        "frontend")
            check_requirements
            setup_frontend
            ;;
        *)
            echo "Usage: $0 [dev|prod|backend|frontend]"
            echo "  dev     - Setup and start development servers"
            echo "  prod    - Setup and build for production"
            echo "  backend - Setup backend only"
            echo "  frontend - Setup frontend only"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"