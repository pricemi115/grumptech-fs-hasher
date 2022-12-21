// Needed hackery to get __filename and __dirname in ES6 mode
// see: https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-js-when-using-es6-modules
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync as _readFileSync} from 'node:fs';
import plgInCopy from 'copy-webpack-plugin';

const CopyPlugin = plgInCopy;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default (env, argv) => [
    // output an ES6 module
    {
        entry: './src/main.mjs',
        experiments: {
            outputModule: true,
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'grumptech-fs-hasher.js',
            library: {
                type: 'module',
            },
        },
        externals: [
            'crypto', 'fs', 'path',
        ],
        module: {
            parser: {
                javascript: {importMeta: false},
            },
            rules: [
                {
                    test: /main.mjs$/,
                    loader: 'string-replace-loader',
                    options: {
                        multiple: [
                            {search: 'PLACEHOLDER_CONFIG_INFO', replace: _PackageInfo.CONFIG_INFO},
                            {search: 'PLACEHOLDER_VERSION',     replace: _PackageInfo.PLUGIN_VER},
                        ],
                    },
                },
            ],
        },
        plugins: [
            // Copy the typescript-friendly exports. Keeps esLint happy.
            new CopyPlugin({
                patterns: [
                    {
                        from: './src/main.d.ts',
                        to: path.resolve(__dirname, 'dist', 'grumptech-fs-hasher.d.ts'),
                    },
                ],
            }),
        ],
    },
];

/**
 * @description Helper to get the information of interest from the package.json file.
 * @returns {object} Data of interest.
 * @private
 */
function _getPackageInfo() {
    const packageFilename = path.join(__dirname, './package.json');
    const rawContents = _readFileSync(packageFilename);
    const parsedData = JSON.parse(rawContents);

    const pkgInfo = {CONFIG_INFO: JSON.stringify(parsedData.config_info), PLUGIN_VER: parsedData.version};

    return pkgInfo;
}

/**
 * @description Package Information
 * @readonly
 * @private
 */
const _PackageInfo = _getPackageInfo();
