/**
 * seedWorkspace.js
 * Utility to seed mock Maven or pytest workspaces for development testing.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function seedMavenWorkspace(repoName) {
  const workspacePath = path.join(STORAGE_ROOT, repoName, 'workspace');
  fs.mkdirSync(workspacePath, { recursive: true });

  const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.antigravity</groupId>
  <artifactId>github-clone-test</artifactId>
  <version>1.0-SNAPSHOT</version>
  <properties>
    <maven.compiler.source>11</maven.compiler.source>
    <maven.compiler.target>11</maven.compiler.target>
  </properties>
</project>`;

  fs.writeFileSync(path.join(workspacePath, 'pom.xml'), pomContent, 'utf8');

  const appDir = path.join(workspacePath, 'src/main/java/com/antigravity');
  fs.mkdirSync(appDir, { recursive: true });

  const appContent = `package com.antigravity;
public class App {
    public static void main(String[] args) {
        System.out.println("Antigravity build OK");
    }
}`;

  fs.writeFileSync(path.join(appDir, 'App.java'), appContent, 'utf8');
}

function seedPytestWorkspace(repoName) {
  const workspacePath = path.join(STORAGE_ROOT, repoName, 'workspace');
  fs.mkdirSync(workspacePath, { recursive: true });

  // 1. requirements.txt
  fs.writeFileSync(path.join(workspacePath, 'requirements.txt'), 'pytest==7.4.0', 'utf8');

  // 2. src/__init__.py & src/calculator.py
  const srcDir = path.join(workspacePath, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, '__init__.py'), '', 'utf8');

  const calcContent = `def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
`;
  fs.writeFileSync(path.join(srcDir, 'calculator.py'), calcContent, 'utf8');

  // 3. tests/__init__.py & tests/test_calculator.py
  const testsDir = path.join(workspacePath, 'tests');
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(path.join(testsDir, '__init__.py'), '', 'utf8');

  const testContent = `from src.calculator import add, subtract

def test_add():
    assert add(2, 3) == 5

def test_subtract():
    assert subtract(5, 3) == 2

def test_add_negative():
    assert add(-1, 1) == 0
`;
  fs.writeFileSync(path.join(testsDir, 'test_calculator.py'), testContent, 'utf8');
}

module.exports = {
  seedMavenWorkspace,
  seedPytestWorkspace
};
