#!/bin/bash
# VRel — Live Demo Script
# Run with: bash demo.sh
# Make sure backend is running on port 3000 first

BASE="http://localhost:3000"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  VRel — Demo     ${NC}"
echo -e "${BLUE}======================================${NC}"
sleep 1

# STEP 1: Login
echo -e "\n${YELLOW}[1] Authenticating...${NC}"
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"prabhaharan","password":"admin123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo -e "${GREEN}✅ Logged in as prabhaharan${NC}"
sleep 1

# STEP 2: Init repo
echo -e "\n${YELLOW}[2] Creating repository 'demo-repo'...${NC}"
curl -s -X POST $BASE/api/repos/demo-repo/init \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null
sleep 1

# STEP 3: Add files
echo -e "\n${YELLOW}[3] Staging files...${NC}"
curl -s -X POST $BASE/api/repos/demo-repo/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"filepath":"src/Main.java","content":"public class Main { }"}' \
  | python3 -m json.tool 2>/dev/null
sleep 1

# STEP 4: Commit
echo -e "\n${YELLOW}[4] Committing...${NC}"
curl -s -X POST $BASE/api/repos/demo-repo/commit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"author":"prabhaharan","message":"initial commit"}' \
  | python3 -m json.tool 2>/dev/null
sleep 1

# STEP 5: Create branch
echo -e "\n${YELLOW}[5] Creating feature branch...${NC}"
curl -s -X POST $BASE/api/repos/demo-repo/branches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"branchName":"feature/demo"}' \
  | python3 -m json.tool 2>/dev/null
sleep 1

# STEP 6: Lock file
echo -e "\n${YELLOW}[6] Locking file for exclusive edit...${NC}"
curl -s -X POST $BASE/api/repos/demo-repo/locks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"filepath":"src/Main.java","lockedBy":"prabhaharan","ttlMinutes":15}' \
  | python3 -m json.tool 2>/dev/null
sleep 1

# STEP 7: View log
echo -e "\n${YELLOW}[7] Commit history...${NC}"
curl -s $BASE/api/repos/demo-repo/log \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool 2>/dev/null
sleep 1

# STEP 8: View active locks
echo -e "\n${YELLOW}[8] Active file locks...${NC}"
curl -s $BASE/api/repos/demo-repo/locks \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool 2>/dev/null
sleep 1

echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}  Demo Complete! 🎉                   ${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Open http://localhost:5174 to see the UI"
