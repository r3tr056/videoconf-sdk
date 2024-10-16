// rollup.config.js
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import svelte from 'rollup-plugin-svelte';
import { terser } from 'rollup-plugin-terser';

const createConfig = (input, output) => {
    return {
        input,
        output: {
            file: output,
            format: 'esm',
            sourcemap: true,
        },
        plugins: [
            svelte(),
            resolve(),
            commonjs(),
            terser(),
        ],
    };
};

export default [
    createConfig('src/react/ReactComponent.js', 'dist/react/ReactComponent.js'),
    createConfig('src/vue/VueComponent.vue', 'dist/vue/VueComponent.vue'),
    createConfig('src/angular/AngularComponent.ts', 'dist/angular/AngularComponent.ts'),
    createConfig('src/svelte/SvelteComponent.svelte', 'dist/svelte/SvelteComponent.svelte'),
];
