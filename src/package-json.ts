/**
 * Package.json parsing and manipulation utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { PackageJson, ProjectConfig } from './types';

/**
 * Find and read package.json from the current directory or parent directories
 */
export function findPackageJson(startDir: string = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Read and parse package.json
 */
export function readPackageJson(packageJsonPath: string): PackageJson {
  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write package.json with preserved formatting
 */
export function writePackageJson(packageJsonPath: string, packageJson: PackageJson): void {
  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const parsed = JSON.parse(content);
  
  // Update the parsed object
  Object.assign(parsed, packageJson);
  
  // Write with 2-space indentation to match common formatting
  const newContent = JSON.stringify(parsed, null, 2) + '\n';
  fs.writeFileSync(packageJsonPath, newContent, 'utf-8');
}

/**
 * Analyze project structure and create ProjectConfig
 */
export function analyzeProject(rootDir?: string): ProjectConfig {
  const startDir = rootDir || process.cwd();
  const packageJsonPath = findPackageJson(startDir);
  
  if (!packageJsonPath) {
    throw new Error('package.json not found. Please run devsort from a project directory.');
  }

  const projectRoot = path.dirname(packageJsonPath);
  const packageJson = readPackageJson(packageJsonPath);

  // Detect common source directories
  const sourceDirs = detectSourceDirs(projectRoot);
  
  // Detect common test directories
  const testDirs = detectTestDirs(projectRoot);
  
  // Detect build/output directories
  const buildDirs = detectBuildDirs(projectRoot);

  // Find tsconfig.json
  const tsConfigPath = findTsConfig(projectRoot);

  return {
    packageJson,
    packageJsonPath,
    rootDir: projectRoot,
    sourceDirs,
    testDirs,
    buildDirs,
    tsConfigPath,
  };
}

/**
 * Detect source directories (src, lib, source, etc.)
 */
function detectSourceDirs(rootDir: string): string[] {
  const commonDirs = ['src', 'lib', 'source', 'app', 'source'];
  const detected: string[] = [];

  for (const dir of commonDirs) {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      detected.push(dir);
    }
  }

  // If no common dirs found, check if there are .ts/.js files in root
  if (detected.length === 0) {
    const files = fs.readdirSync(rootDir);
    const hasSourceFiles = files.some(file => 
      /\.(ts|tsx|js|jsx)$/.test(file) && !file.includes('.test') && !file.includes('.spec')
    );
    if (hasSourceFiles) {
      detected.push('.');
    }
  }

  return detected.length > 0 ? detected : ['src'];
}

/**
 * Detect test directories (__tests__, tests, test, spec, etc.)
 */
function detectTestDirs(rootDir: string): string[] {
  const commonDirs = ['__tests__', 'tests', 'test', 'spec', '__spec__'];
  const detected: string[] = [];

  for (const dir of commonDirs) {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      detected.push(dir);
    }
  }

  return detected;
}

/**
 * Detect build/output directories (dist, build, out, .next, etc.)
 */
function detectBuildDirs(rootDir: string): string[] {
  const commonDirs = ['dist', 'build', 'out', '.next', '.nuxt', 'coverage', 'node_modules'];
  const detected: string[] = [];

  for (const dir of commonDirs) {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      detected.push(dir);
    }
  }

  return detected;
}

/**
 * Find tsconfig.json in project root
 */
function findTsConfig(rootDir: string): string | undefined {
  const tsConfigPath = path.join(rootDir, 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) {
    return tsConfigPath;
  }
  return undefined;
}

