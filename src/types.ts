export interface EnvFile {
  name: string
  env: string
  path: string
  active: boolean
}

export interface UseOptions {
  force: boolean
  backup: boolean
  dryRun: boolean
  path: string
  sourceDir?: string
}

export interface CommonOptions {
  path: string
  json: boolean
}
