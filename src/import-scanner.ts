/**
 * Import scanning utilities - parse and extract imports from TypeScript/JavaScript files
 */

import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'
import { parse } from '@typescript-eslint/typescript-estree'
import { ImportInfo, ProjectConfig } from './types'
import { shouldAnalyzeFile, classifyFile } from './file-classifier'

/**
 * Scan all files in the project and extract imports
 */
export async function scanImports(
  config: ProjectConfig,
  excludePatterns: string[] = [],
  includePatterns: string[] = []
): Promise<ImportInfo[]> {
  const allImports: ImportInfo[] = []

  // Find all files to analyze
  const files = await findFilesToAnalyze(config, excludePatterns, includePatterns)

  console.log(`Scanning ${files.length} files for imports...`)

  for (const filePath of files) {
    try {
      const imports = extractImportsFromFile(filePath, config)
      allImports.push(...imports)
    } catch (error) {
      // Log but continue - some files might not parse correctly
      if (error instanceof Error) {
        console.warn(`Warning: Could not parse ${filePath}: ${error.message}`)
      }
    }
  }

  return allImports
}

/**
 * Find all files that should be analyzed
 */
async function findFilesToAnalyze(
  config: ProjectConfig,
  excludePatterns: string[] = [],
  includePatterns: string[] = []
): Promise<string[]> {
  const patterns: string[] = []

  // If include patterns are specified, use those
  if (includePatterns.length > 0) {
    patterns.push(...includePatterns)
  } else {
    // Otherwise, scan common source and test directories
    const searchDirs = [
      ...config.sourceDirs.map((dir) => `${dir}/**/*.{ts,tsx,js,jsx,mjs,cjs}`),
      ...config.testDirs.map((dir) => `${dir}/**/*.{ts,tsx,js,jsx,mjs,cjs}`),
      '**/*.{ts,tsx,js,jsx,mjs,cjs}',
    ]

    // Remove duplicates and add to patterns
    patterns.push(...new Set(searchDirs))
  }

  const allFiles: string[] = []

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: config.rootDir,
      absolute: true,
      ignore: [
        'node_modules/**',
        ...config.buildDirs.map((dir) => `${dir}/**`),
        'coverage/**',
        'dist/**',
        ...excludePatterns,
      ],
    })

    allFiles.push(...files)
  }

  // Filter to only files that should be analyzed
  const uniqueFiles = Array.from(new Set(allFiles))
  return uniqueFiles.filter((file) => shouldAnalyzeFile(file, config))
}

/**
 * Extract all imports from a single file
 */
function extractImportsFromFile(
  filePath: string,
  config: ProjectConfig
): ImportInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const ext = path.extname(filePath)

  // Try to parse the file
  let ast
  try {
    ast = parse(content, {
      loc: true,
      range: true,
      jsx: ext === '.tsx' || ext === '.jsx',
      sourceType: 'module',
    })
  } catch (error) {
    // If parsing fails, try with different options or fallback to regex
    try {
      ast = parse(content, {
        loc: true,
        range: true,
        jsx: ext === '.tsx' || ext === '.jsx',
        sourceType: 'script',
      })
    } catch {
      // Fallback to regex-based extraction for files that don't parse
      return extractImportsWithRegex(content, filePath)
    }
  }

  const imports: ImportInfo[] = []

  // Traverse AST to find imports
  traverseAST(ast, (node: any) => {
    // ESM import declarations
    if (node.type === 'ImportDeclaration') {
      const source = node.source?.value
      if (source && isExternalPackage(source)) {
        const isTypeOnly = node.importKind === 'type' || hasTypeOnlySpecifiers(node)
        imports.push({
          packageName: extractPackageName(source),
          isTypeOnly,
          filePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
        })
      }
    }

    // CommonJS require()
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'require' &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'Literal'
    ) {
      const source = node.arguments[0].value
      if (typeof source === 'string' && isExternalPackage(source)) {
        imports.push({
          packageName: extractPackageName(source),
          isTypeOnly: false, // require() is always runtime
          filePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
        })
      }
    }

    // Dynamic import()
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Import' &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'Literal'
    ) {
      const source = node.arguments[0].value
      if (typeof source === 'string' && isExternalPackage(source)) {
        imports.push({
          packageName: extractPackageName(source),
          isTypeOnly: false, // dynamic import is always runtime
          filePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
        })
      }
    }

    // require.resolve()
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.object?.type === 'Identifier' &&
      node.callee.object.name === 'require' &&
      node.callee.property?.type === 'Identifier' &&
      node.callee.property.name === 'resolve' &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'Literal'
    ) {
      const source = node.arguments[0].value
      if (typeof source === 'string' && isExternalPackage(source)) {
        imports.push({
          packageName: extractPackageName(source),
          isTypeOnly: false,
          filePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
        })
      }
    }
  })

  return imports
}

/**
 * Traverse AST recursively
 */
function traverseAST(node: any, callback: (node: any) => void): void {
  if (!node || typeof node !== 'object') {
    return
  }

  callback(node)

  for (const key in node) {
    if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
      continue
    }

    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        traverseAST(item, callback)
      }
    } else if (child && typeof child === 'object') {
      traverseAST(child, callback)
    }
  }
}

/**
 * Check if import specifiers are type-only
 */
function hasTypeOnlySpecifiers(node: any): boolean {
  if (!node.specifiers || node.specifiers.length === 0) {
    return false
  }

  // Check if all specifiers are type-only
  return node.specifiers.every((spec: any) => {
    // import type { X } from 'pkg'
    if (spec.importKind === 'type') {
      return true
    }
    // import { type X } from 'pkg'
    if (spec.imported?.type === 'Identifier' && spec.importKind === 'type') {
      return true
    }
    return false
  })
}

/**
 * Check if a source string is an external package (not relative path)
 */
function isExternalPackage(source: string): boolean {
  // External packages don't start with . or /
  return !source.startsWith('.') && !source.startsWith('/') && !path.isAbsolute(source)
}

/**
 * Extract package name from import source
 * Handles scoped packages (@scope/package) and subpaths
 */
function extractPackageName(source: string): string {
  // Remove query strings and fragments
  const cleanSource = source.split('?')[0].split('#')[0]

  // Handle scoped packages: @scope/package -> @scope/package
  // Handle subpaths: package/subpath -> package
  const parts = cleanSource.split('/')
  if (cleanSource.startsWith('@') && parts.length >= 2) {
    // Scoped package: @scope/package or @scope/package/subpath
    return `${parts[0]}/${parts[1]}`
  }

  // Regular package: package or package/subpath
  return parts[0]
}

/**
 * Fallback regex-based import extraction for files that don't parse
 */
function extractImportsWithRegex(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = []
  const lines = content.split('\n')

  // ESM import patterns
  const esmImportPattern =
    /^import\s+(?:type\s+)?(?:\*\s+as\s+\w+|[\w\s,{}*]+|\s+)?from\s+['"]([^'"]+)['"]/gm
  // CommonJS require pattern
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  // Dynamic import pattern
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  let match

  // Extract ESM imports
  while ((match = esmImportPattern.exec(content)) !== null) {
    const source = match[1]
    if (isExternalPackage(source)) {
      const lineNumber = content.substring(0, match.index).split('\n').length
      const isTypeOnly = match[0].includes('import type') || match[0].includes('type {')
      imports.push({
        packageName: extractPackageName(source),
        isTypeOnly,
        filePath,
        line: lineNumber,
        column: 0,
      })
    }
  }

  // Extract require() calls
  while ((match = requirePattern.exec(content)) !== null) {
    const source = match[1]
    if (isExternalPackage(source)) {
      const lineNumber = content.substring(0, match.index).split('\n').length
      imports.push({
        packageName: extractPackageName(source),
        isTypeOnly: false,
        filePath,
        line: lineNumber,
        column: 0,
      })
    }
  }

  // Extract dynamic imports
  while ((match = dynamicImportPattern.exec(content)) !== null) {
    const source = match[1]
    if (isExternalPackage(source)) {
      const lineNumber = content.substring(0, match.index).split('\n').length
      imports.push({
        packageName: extractPackageName(source),
        isTypeOnly: false,
        filePath,
        line: lineNumber,
        column: 0,
      })
    }
  }

  return imports
}
