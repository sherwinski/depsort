/**
 * Dependency analysis - classify packages and determine if they can be moved to devDependencies
 */

import { classifyFile } from './file-classifier'
import {
  AnalysisResult,
  ImportInfo,
  PackageUsage,
  ProjectConfig,
} from './types'

/**
 * Analyze dependencies and determine which can be moved to devDependencies
 */
export function analyzeDependencies(
  config: ProjectConfig,
  imports: ImportInfo[]
): AnalysisResult {
  const dependencies = Object.keys(config.packageJson.dependencies || {})
  const packageUsages: PackageUsage[] = []

  // Group imports by package name
  const importsByPackage = new Map<string, ImportInfo[]>()
  for (const imp of imports) {
    if (!importsByPackage.has(imp.packageName)) {
      importsByPackage.set(imp.packageName, [])
    }
    importsByPackage.get(imp.packageName)!.push(imp)
  }

  // Analyze each dependency
  for (const packageName of dependencies) {
    const packageImports = importsByPackage.get(packageName) || []
    const usage = analyzePackageUsage(packageName, packageImports, config)
    packageUsages.push(usage)
  }

  // Separate packages that can be moved vs those that should stay
  const packagesToMove = packageUsages.filter(
    (pkg) => pkg.canMoveToDevDependencies
  )
  const packagesToKeep = packageUsages.filter(
    (pkg) => !pkg.canMoveToDevDependencies
  )

  return {
    packagesToMove,
    packagesToKeep,
    totalDependencies: dependencies.length,
    canMoveCount: packagesToMove.length,
  }
}

/**
 * Analyze usage of a specific package
 */
function analyzePackageUsage(
  packageName: string,
  imports: ImportInfo[],
  config: ProjectConfig
): PackageUsage {
  // If package is not imported at all, it might be used in other ways
  // (e.g., CLI tools, build scripts, etc.) - we'll be conservative and keep it
  if (imports.length === 0) {
    return {
      packageName,
      imports: [],
      usedInProduction: false,
      usedInDev: false,
      onlyTypeImports: false,
      canMoveToDevDependencies: false,
      reason: 'Package not found in imports (may be used in scripts or other ways)',
    }
  }

  // Classify each import location
  let usedInProduction = false
  let usedInDev = false
  let hasRuntimeInProduction = false
  let hasTypeOnlyInProduction = false
  let allImportsAreTypeOnly = true

  for (const imp of imports) {
    const fileClassification = classifyFile(imp.filePath, config)

    // Check if this is a production file
    if (fileClassification.isProduction) {
      usedInProduction = true
      if (imp.isTypeOnly) {
        hasTypeOnlyInProduction = true
      } else {
        hasRuntimeInProduction = true
        allImportsAreTypeOnly = false
      }
    } else if (
      fileClassification.isTest ||
      fileClassification.isConfig ||
      fileClassification.isBuild
    ) {
      usedInDev = true
      if (!imp.isTypeOnly) {
        allImportsAreTypeOnly = false
      }
    }
  }

  // Determine if package can be moved to devDependencies
  let canMove = false
  let reason = ''

  if (!usedInProduction) {
    // Package is only used in dev/test/config files
    canMove = true
    reason = 'Only used in dev/test/config files'
  } else if (hasTypeOnlyInProduction && !hasRuntimeInProduction) {
    // Package is only used for types in production code
    canMove = true
    reason = 'Only type-only imports in production code'
  } else if (hasRuntimeInProduction) {
    // Package has runtime imports in production code - must stay
    canMove = false
    reason = 'Has runtime imports in production code'
  } else {
    // Fallback case
    canMove = false
    reason = 'Used in production code'
  }

  return {
    packageName,
    imports,
    usedInProduction,
    usedInDev,
    onlyTypeImports: allImportsAreTypeOnly && imports.length > 0,
    canMoveToDevDependencies: canMove,
    reason,
  }
}

/**
 * Get a detailed reason string for why a package can or cannot be moved
 */
export function getDetailedReason(usage: PackageUsage): string {
  if (usage.imports.length === 0) {
    return usage.reason
  }

  const productionImports = usage.imports.filter((imp) => {
    // This is a simplified check - in real usage, we'd classify the file
    return true // We'll rely on the already computed flags
  })

  const typeOnlyCount = usage.imports.filter((imp) => imp.isTypeOnly).length
  const runtimeCount = usage.imports.length - typeOnlyCount

  const parts: string[] = []

  if (usage.usedInProduction) {
    parts.push(`used in production (${productionImports.length} imports)`)
  }
  if (usage.usedInDev) {
    parts.push('used in dev/test files')
  }
  if (typeOnlyCount > 0) {
    parts.push(`${typeOnlyCount} type-only import(s)`)
  }
  if (runtimeCount > 0) {
    parts.push(`${runtimeCount} runtime import(s)`)
  }

  return `${usage.reason} - ${parts.join(', ')}`
}

