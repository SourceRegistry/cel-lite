import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const [packageDirArg, version] = process.argv.slice(2);

if (!packageDirArg || !version) {
    throw new Error("Usage: node scripts/semantic-release-version.mjs <package-dir> <version>");
}

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageDir = resolve(process.cwd(), packageDirArg);
const packageJsonPath = resolve(packageDir, "package.json");
const lockPath = resolve(repoRoot, "package-lock.json");

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const packageJson = readJson(packageJsonPath);
packageJson.version = version;
writeJson(packageJsonPath, packageJson);

if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    const relativePackagePath = relative(repoRoot, packageDir).split(sep).join("/");

    if (relativePackagePath === "") {
        lock.version = version;
        if (lock.packages?.[""]) lock.packages[""].version = version;
    } else if (lock.packages?.[relativePackagePath]) {
        lock.packages[relativePackagePath].version = version;
    }

    writeJson(lockPath, lock);
}
