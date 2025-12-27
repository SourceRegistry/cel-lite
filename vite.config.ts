import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
            },
            formats: ['es', 'cjs'],
            fileName: (format, entryName) => `${entryName}.${format}.js`
        },
        sourcemap: true,
        target: 'node22'
    },
    plugins: [
        dts({
            compilerOptions: {
                stripInternal: false,
                removeComments: false
            },
            include: ['src/index.ts']
        })
    ]
});
