/**
 * Type definitions for depsort
 */

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface ProjectConfig {
  packageJson: PackageJson;
  packageJsonPath: string;
  rootDir: string;
  sourceDirs: string[];
  testDirs: string[];
  buildDirs: string[];
  tsConfigPath?: string;
}

export interface FileClassification {
  isProduction: boolean;
  isTest: boolean;
  isBuild: boolean;
  isConfig: boolean;
  reason: string;
}

export interface ImportInfo {
  packageName: string;
  isTypeOnly: boolean;
  filePath: string;
  line: number;
  column: number;
}

export interface PackageUsage {
  packageName: string;
  imports: ImportInfo[];
  usedInProduction: boolean;
  usedInDev: boolean;
  onlyTypeImports: boolean;
  canMoveToDevDependencies: boolean;
  reason: string;
}

export interface AnalysisResult {
  packagesToMove: PackageUsage[];
  packagesToKeep: PackageUsage[];
  totalDependencies: number;
  canMoveCount: number;
}

