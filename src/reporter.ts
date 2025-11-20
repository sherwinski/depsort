/**
 * Reporting utilities - generate human-readable and JSON reports
 */

import { AnalysisResult } from './types'

/**
 * Generate and print a human-readable report
 */
export function printReport(result: AnalysisResult, verbose: boolean = false): void {
  console.log('\n' + '='.repeat(70))
  console.log('DEPENDENCY ANALYSIS REPORT')
  console.log('='.repeat(70))

  // Summary
  console.log('\n📊 Summary:')
  console.log(`  Total dependencies analyzed: ${result.totalDependencies}`)
  console.log(
    `  Can be moved to devDependencies: ${result.canMoveCount}`
  )
  console.log(
    `  Should stay in dependencies: ${result.packagesToKeep.length}`
  )

  // Packages that can be moved
  if (result.packagesToMove.length > 0) {
    console.log('\n✅ Packages that can be moved to devDependencies:')
    console.log('-'.repeat(70))

    for (const pkg of result.packagesToMove) {
      console.log(`\n  📦 ${pkg.packageName}`)
      console.log(`     Reason: ${pkg.reason}`)

      if (verbose) {
        const typeOnlyCount = pkg.imports.filter((i) => i.isTypeOnly).length
        const runtimeCount = pkg.imports.length - typeOnlyCount

        console.log(`     Usage:`)
        console.log(`       - Total imports: ${pkg.imports.length}`)
        console.log(`       - Type-only imports: ${typeOnlyCount}`)
        console.log(`       - Runtime imports: ${runtimeCount}`)
        console.log(`       - Used in production: ${pkg.usedInProduction ? 'Yes' : 'No'}`)
        console.log(`       - Used in dev/test: ${pkg.usedInDev ? 'Yes' : 'No'}`)

        if (pkg.imports.length > 0 && pkg.imports.length <= 5) {
          console.log(`     Import locations:`)
          pkg.imports.forEach((imp) => {
            const typeLabel = imp.isTypeOnly ? '(type-only)' : '(runtime)'
            console.log(
              `       - ${imp.filePath}:${imp.line}:${imp.column} ${typeLabel}`
            )
          })
        } else if (pkg.imports.length > 5) {
          console.log(`     Import locations: ${pkg.imports.length} files (use --verbose to see all)`)
        }
      }
    }

    console.log('\n💡 Tip: Run with --fix to automatically move these packages')
  } else {
    console.log('\n✅ No packages found that can be moved to devDependencies')
  }

  // Packages that should stay
  if (result.packagesToKeep.length > 0) {
    console.log('\n🔒 Packages that should stay in dependencies:')
    console.log('-'.repeat(70))

    for (const pkg of result.packagesToKeep) {
      console.log(`\n  📦 ${pkg.packageName}`)
      console.log(`     Reason: ${pkg.reason}`)

      if (verbose) {
        const typeOnlyCount = pkg.imports.filter((i) => i.isTypeOnly).length
        const runtimeCount = pkg.imports.length - typeOnlyCount

        console.log(`     Usage:`)
        console.log(`       - Total imports: ${pkg.imports.length}`)
        console.log(`       - Type-only imports: ${typeOnlyCount}`)
        console.log(`       - Runtime imports: ${runtimeCount}`)
        console.log(`       - Used in production: ${pkg.usedInProduction ? 'Yes' : 'No'}`)
        console.log(`       - Used in dev/test: ${pkg.usedInDev ? 'Yes' : 'No'}`)
      }
    }
  }

  console.log('\n' + '='.repeat(70))
}

/**
 * Generate JSON report
 */
export function generateJsonReport(result: AnalysisResult): string {
  const jsonResult = {
    summary: {
      totalDependencies: result.totalDependencies,
      canMoveCount: result.canMoveCount,
      keepCount: result.packagesToKeep.length,
    },
    packagesToMove: result.packagesToMove.map((pkg) => ({
      packageName: pkg.packageName,
      reason: pkg.reason,
      usedInProduction: pkg.usedInProduction,
      usedInDev: pkg.usedInDev,
      onlyTypeImports: pkg.onlyTypeImports,
      importCount: pkg.imports.length,
      typeOnlyImportCount: pkg.imports.filter((i) => i.isTypeOnly).length,
      runtimeImportCount: pkg.imports.filter((i) => !i.isTypeOnly).length,
      imports: pkg.imports.map((imp) => ({
        filePath: imp.filePath,
        line: imp.line,
        column: imp.column,
        isTypeOnly: imp.isTypeOnly,
      })),
    })),
    packagesToKeep: result.packagesToKeep.map((pkg) => ({
      packageName: pkg.packageName,
      reason: pkg.reason,
      usedInProduction: pkg.usedInProduction,
      usedInDev: pkg.usedInDev,
      onlyTypeImports: pkg.onlyTypeImports,
      importCount: pkg.imports.length,
      typeOnlyImportCount: pkg.imports.filter((i) => i.isTypeOnly).length,
      runtimeImportCount: pkg.imports.filter((i) => !i.isTypeOnly).length,
    })),
  }

  return JSON.stringify(jsonResult, null, 2)
}

/**
 * Generate a compact summary report (for non-verbose mode)
 */
export function printCompactReport(result: AnalysisResult): void {
  console.log('\n' + '='.repeat(70))
  console.log('DEPENDENCY ANALYSIS REPORT')
  console.log('='.repeat(70))

  // Summary
  console.log('\n📊 Summary:')
  console.log(`  Total dependencies: ${result.totalDependencies}`)
  console.log(
    `  Can be moved to devDependencies: ${result.canMoveCount}`
  )
  console.log(
    `  Should stay in dependencies: ${result.packagesToKeep.length}`
  )

  // Packages that can be moved
  if (result.packagesToMove.length > 0) {
    console.log('\n✅ Packages that can be moved to devDependencies:')
    console.log('-'.repeat(70))

    // Create a table-like format
    const maxNameLength = Math.max(
      ...result.packagesToMove.map((p) => p.packageName.length),
      20
    )

    for (const pkg of result.packagesToMove) {
      const name = pkg.packageName.padEnd(maxNameLength)
      const reason = pkg.reason
      console.log(`  ${name}  →  ${reason}`)
    }

    console.log('\n💡 Tip: Run with --fix to automatically move these packages')
  } else {
    console.log('\n✅ No packages found that can be moved to devDependencies')
  }

  // Show packages to keep only if there are any and user might want to know
  if (result.packagesToKeep.length > 0 && result.packagesToKeep.length <= 10) {
    console.log('\n🔒 Packages that should stay in dependencies:')
    console.log('-'.repeat(70))

    const maxNameLength = Math.max(
      ...result.packagesToKeep.map((p) => p.packageName.length),
      20
    )

    for (const pkg of result.packagesToKeep) {
      const name = pkg.packageName.padEnd(maxNameLength)
      const reason = pkg.reason
      console.log(`  ${name}  →  ${reason}`)
    }
  } else if (result.packagesToKeep.length > 10) {
    console.log(
      `\n🔒 ${result.packagesToKeep.length} packages should stay in dependencies (run with --verbose to see details)`
    )
  }

  console.log('\n' + '='.repeat(70))
}

