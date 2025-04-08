import { createVSIX } from "@vscode/vsce"
import jsonc from "comment-json"
import {
  copyFileSync,
  mkdirSync,
  PathLike,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"
import { optimize } from "svgo"

function listRecursive(root: PathLike) {
  const files: PathLike[] = []
  for (const name of readdirSync(root)) {
    const path = join(root.toString(), name)
    const stat = statSync(path)
    if (stat.isDirectory()) files.push(...listRecursive(path))
    if (stat.isFile()) files.push(path)
  }
  return files
}

function compileManifest(srcDir: PathLike, outDir: PathLike) {
  const filename = "package.json"
  const raw = readFileSync(join(srcDir.toString(), filename)).toString()
  const manifest = JSON.parse(raw) as Record<string, unknown>

  manifest.private = undefined
  manifest.type = undefined
  manifest.scripts = undefined
  manifest.dependencies = undefined
  manifest.devDependencies = undefined
  manifest.peerDependencies = undefined

  const result = JSON.stringify(manifest)
  writeFileSync(join(outDir.toString(), filename), result)
}

function build(root: PathLike, outDir: PathLike) {
  compileManifest(root, outDir)
  const assets: string[] = [
    "readme.md",
    "changelog.md",
    "license.txt",
    "license.en.txt",
    "license.zh.txt",
  ]
  for (const file of assets) {
    copyFileSync(join(root.toString(), file), join(outDir.toString(), file))
  }
  for (const path of listRecursive(join(root.toString(), "src"))) {
    const pathString = path.toString()
    const relativePath = relative(root.toString(), pathString)
    const outFilePath = join(outDir.toString(), relativePath)
    if (pathString.endsWith(".json")) {
      const raw = readFileSync(path).toString()
      mkdirSync(dirname(outFilePath), { recursive: true })
      writeFileSync(outFilePath, jsonc.stringify(jsonc.parse(raw)))
    } else if (pathString.endsWith(".svg")) {
      const raw = readFileSync(path).toString()
      mkdirSync(dirname(outFilePath), { recursive: true })
      writeFileSync(outFilePath, optimize(raw).data)
    }
  }
}

async function main() {
  const root = import.meta.dirname
  const outDir = join(root, "build")
  for (const name of readdirSync(outDir)) {
    const path = join(outDir, name)
    const stat = statSync(join(outDir, name))
    stat.isDirectory() ? rmSync(path, { recursive: true }) : rmSync(path)
  }
  build(root, outDir)
  writeFileSync(join(outDir, ".vscodeignore"), "# Placeholder.")
  await createVSIX({ cwd: outDir })
}
main()
