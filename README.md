# depsort

A CLI tool that helps TypeScript library and app developers identify if packages in their dependencies can be safely moved to devDependencies. This helps end users save on their project bundle size by not importing unneeded dependencies.

## Installation

```bash
npm install -g depsort
```

Or use with npx:

```bash
npx depsort
```

## Usage

```bash
depsort [options]

Options:
  --fix              Automatically move packages to devDependencies
  --json             Output results as JSON
  --exclude <paths>  Exclude paths from analysis (glob patterns)
  --include <paths>  Only analyze specific paths (glob patterns)
  --help             Show help
```

## How it works

depsort analyzes your TypeScript/JavaScript project to:

1. Parse your `package.json` dependencies
2. Scan all source files for imports
3. Classify imports as:
   - Type-only imports (can be devDependency)
   - Runtime imports in test/dev files (can be devDependency)
   - Runtime imports in production code (must stay in dependencies)
4. Report which packages can be safely moved to devDependencies

## Example Output

```
Analyzing dependencies...

Found 3 packages that can be moved to devDependencies:

  @types/node          → devDependencies (type-only imports)
  jest                 → devDependencies (only in test files)
  typescript           → devDependencies (build tool, not in source)

Run with --fix to automatically update package.json
```

## License

MIT

