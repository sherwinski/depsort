#!/usr/bin/env node

/**
 * devsort - CLI entry point
 * Analyzes TypeScript/JavaScript projects to identify dependencies that can be moved to devDependencies
 */

import { Command } from 'commander'
import { analyzeProject } from './package-json'
import { scanImports } from './import-scanner'
import { analyzeDependencies } from './analyzer'
import { ProjectConfig } from './types'

const program = new Command()

program
  .name('devsort')
  .description(
    'Identify dependencies that can be safely moved to devDependencies'
  )
  .version('0.1.0')
  .option('--fix', 'Automatically move packages to devDependencies')
  .option('--json', 'Output results as JSON')
  .option(
    '--exclude <paths>',
    'Exclude paths from analysis (glob patterns)',
    ''
  )
  .option(
    '--include <paths>',
    'Only analyze specific paths (glob patterns)',
    ''
  )
  .action(async (options) => {
    try {
      // Step 1: Project Analysis
      console.log('Analyzing project structure...')
      const config = analyzeProject()

      console.log(`Project root: ${config.rootDir}`)
      console.log(
        `Source directories: ${config.sourceDirs.join(', ') || 'none'}`
      )
      console.log(`Test directories: ${config.testDirs.join(', ') || 'none'}`)
      console.log(`Build directories: ${config.buildDirs.join(', ') || 'none'}`)

      const dependencies = Object.keys(config.packageJson.dependencies || {})
      const devDependencies = Object.keys(
        config.packageJson.devDependencies || {}
      )

      console.log(
        `\nFound ${dependencies.length} dependencies and ${devDependencies.length} devDependencies`
      )

      if (dependencies.length === 0) {
        console.log('\nNo dependencies found to analyze.')
        return
      }

      // Step 2: Import Scanning
      console.log('\nScanning for imports...')
      const excludePatterns = options.exclude
        ? options.exclude.split(',').map((p: string) => p.trim())
        : []
      const includePatterns = options.include
        ? options.include.split(',').map((p: string) => p.trim())
        : []

      const imports = await scanImports(
        config,
        excludePatterns,
        includePatterns
      )

      console.log(`Found ${imports.length} import statements`)

      // Group imports by package
      const importsByPackage = new Map<string, typeof imports>()
      for (const imp of imports) {
        if (!importsByPackage.has(imp.packageName)) {
          importsByPackage.set(imp.packageName, [])
        }
        importsByPackage.get(imp.packageName)!.push(imp)
      }

      console.log(`Found ${importsByPackage.size} unique packages imported`)

      // Step 3: Dependency Classification
      console.log('\nAnalyzing dependency usage...')
      const analysisResult = analyzeDependencies(config, imports)

      console.log(
        `\nAnalysis complete: ${analysisResult.canMoveCount} of ${analysisResult.totalDependencies} dependencies can be moved to devDependencies`
      )

      if (analysisResult.packagesToMove.length > 0) {
        console.log('\nPackages that can be moved to devDependencies:')
        analysisResult.packagesToMove.forEach((pkg) => {
          console.log(`  - ${pkg.packageName}: ${pkg.reason}`)
        })
      }

      if (analysisResult.packagesToKeep.length > 0) {
        console.log('\nPackages that should stay in dependencies:')
        analysisResult.packagesToKeep.forEach((pkg) => {
          console.log(`  - ${pkg.packageName}: ${pkg.reason}`)
        })
      }

      // TODO: Steps 4-5 will be implemented next
      console.log(
        '\nDependency classification complete. Reporting and auto-fix coming in next steps...'
      )
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error:', error.message)
        process.exit(1)
      } else {
        console.error('Unknown error:', error)
        process.exit(1)
      }
    }
  })

program.parse()
