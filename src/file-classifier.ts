/**
 * File classification utilities - determine if files are production, test, build, etc.
 */

import * as path from 'path'
import { FileClassification, ProjectConfig } from './types'

/**
 * Classify a file based on its path and project configuration
 */
export function classifyFile(
  filePath: string,
  config: ProjectConfig
): FileClassification {
  const relativePath = path.relative(config.rootDir, filePath)
  const normalizedPath = relativePath.replace(/\\/g, '/')
  const fileName = path.basename(filePath)
  const dirName = path.dirname(normalizedPath)

  // Check if file is in a build/output directory
  const isInBuildDir = config.buildDirs.some(
    (buildDir) =>
      normalizedPath.startsWith(buildDir + '/') ||
      normalizedPath.startsWith('./' + buildDir + '/')
  )

  if (isInBuildDir) {
    return {
      isProduction: false,
      isTest: false,
      isBuild: true,
      isConfig: false,
      reason: `File is in build directory`,
    }
  }

  // Check if file is in a test directory
  const isInTestDir = config.testDirs.some(
    (testDir) =>
      normalizedPath.includes(`/${testDir}/`) ||
      normalizedPath.startsWith(`${testDir}/`) ||
      dirName === testDir
  )

  // Check if file is a test file by name pattern
  const isTestFile =
    /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(fileName) ||
    /\.(test|spec)\.(ts|tsx|js|jsx)\.map$/i.test(fileName)

  if (isInTestDir || isTestFile) {
    return {
      isProduction: false,
      isTest: true,
      isBuild: false,
      isConfig: false,
      reason: isInTestDir
        ? `File is in test directory`
        : `File matches test pattern`,
    }
  }

  // Check if file is a config file (but not in source)
  const isConfigFile =
    /^(jest|vitest|vite|webpack|rollup|esbuild|tsup|tsx|ts-node|babel|eslint|prettier|\.prettierrc|\.eslintrc)\.(config\.)?(js|ts|json|mjs|cjs)$/i.test(
      fileName
    ) ||
    /^\.(eslintrc|prettierrc|babelrc|nycrc)/i.test(fileName) ||
    fileName === 'tsconfig.json' ||
    fileName === 'package.json'

  if (isConfigFile && !isInSourceDir(normalizedPath, config)) {
    return {
      isProduction: false,
      isTest: false,
      isBuild: false,
      isConfig: true,
      reason: `File is a configuration file`,
    }
  }

  // Check if file is in source directory
  const isInSource = isInSourceDir(normalizedPath, config)

  // Check if file is a type definition file (.d.ts)
  const isTypeDefinition = fileName.endsWith('.d.ts')

  // Production files are source files that are not tests, not configs, and not build outputs
  const isProduction =
    isInSource && !isTestFile && !isConfigFile && !isInBuildDir

  return {
    isProduction,
    isTest: isInTestDir || isTestFile,
    isBuild: isInBuildDir,
    isConfig: isConfigFile && !isInSource,
    reason: isProduction
      ? `File is in source directory`
      : isTypeDefinition
      ? `File is a type definition`
      : `File classification: source=${isInSource}, test=${
          isTestFile || isInTestDir
        }, config=${isConfigFile}`,
  }
}

/**
 * Check if a file path is in a source directory
 */
function isInSourceDir(normalizedPath: string, config: ProjectConfig): boolean {
  // If source dirs include '.', then root-level files are considered source
  if (config.sourceDirs.includes('.')) {
    // But exclude files in known non-source locations
    const pathParts = normalizedPath.split('/')
    if (pathParts.length === 1 || pathParts[0] === '.') {
      return true
    }
  }

  return config.sourceDirs.some((sourceDir) => {
    if (sourceDir === '.') {
      return true
    }
    return (
      normalizedPath.startsWith(sourceDir + '/') ||
      normalizedPath.startsWith('./' + sourceDir + '/')
    )
  })
}

/**
 * Check if a file should be analyzed (exclude build outputs, node_modules, etc.)
 */
export function shouldAnalyzeFile(
  filePath: string,
  config: ProjectConfig
): boolean {
  const relativePath = path.relative(config.rootDir, filePath)
  const normalizedPath = relativePath.replace(/\\/g, '/')

  // Skip node_modules
  if (normalizedPath.includes('node_modules/')) {
    return false
  }

  // Skip build directories
  if (
    config.buildDirs.some(
      (buildDir) =>
        normalizedPath.startsWith(buildDir + '/') ||
        normalizedPath.startsWith('./' + buildDir + '/')
    )
  ) {
    return false
  }

  // Skip coverage directories
  if (normalizedPath.includes('coverage/')) {
    return false
  }

  // Only analyze TypeScript/JavaScript files
  const ext = path.extname(filePath)
  const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
  if (!validExtensions.includes(ext)) {
    return false
  }

  return true
}
