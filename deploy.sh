#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# SocialBudi VM1 Backend - Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════

# Configuration
APP_NAME="socialbudi-vm1"
APP_DIR="/var/www/socialbudi-backend"
BRANCH="main"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📦 $1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Error handler
handle_error() {
    print_error "Deployment failed at: $1"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}Showing recent logs for debugging:${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    pm2 logs $APP_NAME --lines 20 --nostream 2>/dev/null || echo "Could not retrieve PM2 logs"
    exit 1
}

# Start deployment
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   🚀 Starting Deployment: $APP_NAME${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Pull latest code
print_step "Step 1/7: Pulling latest code from GitHub"
cd $APP_DIR || handle_error "Failed to change to application directory"
git fetch origin $BRANCH || handle_error "Failed to fetch from origin"
git reset --hard origin/$BRANCH || handle_error "Failed to reset to origin/$BRANCH"
print_success "Code updated to latest from $BRANCH"
echo ""

# Step 2: Install dependencies
print_step "Step 2/7: Installing/updating dependencies"
npm install --production || handle_error "Failed to install dependencies"
print_success "Dependencies installed successfully"
echo ""

# Step 3: Restart PM2 process
print_step "Step 3/7: Restarting PM2 process"
pm2 restart $APP_NAME || handle_error "Failed to restart PM2 process"
print_success "PM2 process restarted"
echo ""

# Step 4: Wait for app to start
print_step "Step 4/7: Waiting for application to start"
echo "Waiting 3 seconds..."
sleep 3
print_success "Wait complete"
echo ""

# Step 5: Check PM2 status
print_step "Step 5/7: Checking PM2 status"
pm2 status $APP_NAME || handle_error "Failed to get PM2 status"
echo ""

# Step 6: Health check
print_step "Step 6/7: Running health check"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ "$HEALTH_STATUS" -eq 200 ]; then
    print_success "Health check passed (HTTP $HEALTH_STATUS)"
else
    print_error "Health check failed (HTTP $HEALTH_STATUS)"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}Showing last 20 lines of PM2 logs:${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    pm2 logs $APP_NAME --lines 20 --nostream 2>/dev/null || echo "Could not retrieve PM2 logs"
    exit 1
fi
echo ""

# Step 7: Show recent logs
print_step "Step 7/7: Recent application logs"
pm2 logs $APP_NAME --lines 10 --nostream 2>/dev/null || print_warning "Could not retrieve recent logs"
echo ""

# Step 8: Success summary
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "   Application: ${GREEN}$APP_NAME${NC}"
echo -e "   Status: ${GREEN}Running${NC}"
echo -e "   Health Check: ${GREEN}✅ OK${NC}"
echo ""
echo -e "   To view logs: ${YELLOW}pm2 logs $APP_NAME${NC}"
echo -e "   To restart: ${YELLOW}pm2 restart $APP_NAME${NC}"
echo ""
