/**
 * Rollup configuration for FoundryVTT module
 * 
 * Bundles the module for distribution
 */

import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

// Get version from package.json
import pkg from './package.json' assert { type: 'json' };

const banner = `
/*!
 * Matrix Bridge Module for FoundryVTT
 * Version: ${pkg.version}
 * Author: ${pkg.author}
 * License: ${pkg.license}
 */
`;

export default {
    input: 'src/index.js',
    output: {
        dir: 'dist',
        format: 'es',
        banner,
        sourcemap: true,
    },
    plugins: [
        // Resolve node modules
        nodeResolve({
            browser: true,
            preferBuiltins: false,
        }),
        
        // Convert CommonJS to ES modules
        commonjs(),
        
        // Parse JSON files
        json(),
        
        // Replace version placeholder
        replace({
            preventAssignment: true,
            values: {
                'process.env.VERSION': JSON.stringify(pkg.version),
                'process.env.NAME': JSON.stringify(pkg.name),
            },
        }),
        
        // Minify in production
        terser({
            compress: {
                drop_console: false, // Keep console.log for debugging
            },
            format: {
                beautify: false,
                comments: true,
            },
        }),
    ],
    
    // Don't bundle external dependencies
    external: ['express', 'cors', 'body-parser'],
    
    // Don't include node modules in the bundle
    onwarn(warning, defaultHandler) {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
            // These are server-side dependencies, not client-side
            return;
        }
        defaultHandler(warning);
    },
};
