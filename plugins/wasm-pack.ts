import { Plugin } from "vite";
import { resolve } from "path";
import { execSync, spawn, ChildProcess } from "node:child_process";

interface Options {
    crate: string,
    outDir?: string,
    outName?: string,
}

function watch(crate: string, outDir: string, outName: string): ChildProcess {
    const args = ['watch', '-i', '.gitignore', '-i', 'pkg/*', '-s', `wasm-pack build --release --out-name "${outName}" --out-dir "${outDir}"`];
    return spawn('cargo', args, {
        cwd: resolve(crate),
        stdio: 'inherit',
    });
}

function build(crate: string, outDir: string, outName: string) {
    execSync(`wasm-pack build --release --out-name "${outName}" --out-dir "${outDir}"`, {
        cwd: resolve(crate),
        stdio: 'inherit',
    });
}

function wasmPack(options: Options): Plugin {
    const moduleId = `@crate/${options.crate}`;
    const outDir = options.outDir || 'pkg';
    const outName = options.outName || 'index';
    const targetDir = resolve(options.crate, outDir);
    const targetFile = resolve(targetDir, `${outName}.js`);
    let process: ChildProcess | undefined = undefined;
    let cmd: 'build' | 'serve' = 'build';
    let didBuild = false;
    return {
        name: 'wasm-pack',
        configResolved() {

        },
        buildEnd() {
            if (process) {
                process.kill();
            }
        },
        buildStart() {
            if (cmd === 'serve') {
                if (process) {
                    process.kill();
                }

                process = watch(options.crate, outDir, outName);
            }
        },
        config(config, {command}) {
            cmd = command;
        },
        resolveId(id: string) {
            if (id === moduleId) {
                if (cmd === 'build') {
                    if (!didBuild) {
                        build(options.crate, outDir, outName);
                        didBuild = true;
                    }
                }
                
                return targetFile;
            }
        },
    };
}

export default wasmPack;