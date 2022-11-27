import * as _ from '../main.mjs';

import {fileURLToPath as _fileURLToPath} from 'node:url';
import {join as _join, dirname as _dirname} from 'node:path';

/**
 * @description Absolute path to this script file.
 * @private
 * @readonly
 */
const __filename = _fileURLToPath(import.meta.url);
/**
 * @description Absolute path to the folder of this script file.
 * @private
 * @readonly
 */
const __dirname = _dirname(__filename);

describe('main.mjs Tests', ()=>{
    describe('Export tests', ()=>{
        test('FSHasher exported', ()=>{
            expect(_.FSHasher).toBeDefined();
        });
        test('HASH_ALGORITHMS exported', ()=>{
            expect(_.HASH_ALGORITHMS).toBeDefined();
        });
    });

    describe('HASH_ALGORITHM tests', ()=>{
        test('MD5', ()=>{
            expect(_.HASH_ALGORITHMS.MD5).toBeDefined();
            expect(_.HASH_ALGORITHMS.MD5).toBe('md5');
        });
        test('SHA224', ()=>{
            expect(_.HASH_ALGORITHMS.SHA224).toBeDefined();
            expect(_.HASH_ALGORITHMS.SHA224).toBe('sha224');
        });
        test('SHA256', ()=>{
            expect(_.HASH_ALGORITHMS.SHA256).toBeDefined();
            expect(_.HASH_ALGORITHMS.SHA256).toBe('sha256');
        });
        test('SHA384', ()=>{
            expect(_.HASH_ALGORITHMS.SHA384).toBeDefined();
            expect(_.HASH_ALGORITHMS.SHA384).toBe('sha384');
        });
        test('SHA512', ()=>{
            expect(_.HASH_ALGORITHMS.SHA512).toBeDefined();
            expect(_.HASH_ALGORITHMS.SHA512).toBe('sha512');
        });
    });

    describe('FSHasher API tests', ()=>{
        let fsHasher;
        beforeAll(()=>{
            fsHasher = new _.FSHasher();
        });
        test('Module FSHasher expected value', ()=>{
            expect(fsHasher).toBeInstanceOf(_.FSHasher);
        });
        test('FSHasher API', ()=>{
            expect(fsHasher).toHaveProperty('Version');
            expect(fsHasher).toHaveProperty('IsBusy');
            expect(fsHasher).toHaveProperty('Algorithm');
            expect(fsHasher).toHaveProperty('Source');
            expect(fsHasher.Build).toBeDefined();
            expect(fsHasher.Compute).toBeDefined();
            expect(fsHasher.Report).toBeDefined();
            expect(fsHasher.FindDuplicates).toBeDefined();
        });
        test('Module FSHasher default algorithm', ()=>{
            expect(fsHasher.Algorithm).toBe(_.HASH_ALGORITHMS.SHA256);
        });
    });

    describe('FSHasher File Hash Test', ()=>{
        const source = __dirname + '/../../test/sample_data/folder-a/folder-b/bacon_ipsum.txt';
        const fsHasher = new _.FSHasher();

        test('Build Test', async () => {
            const result = await fsHasher.Build(source);
            await expect(result).toBe(true);
        });
        test('Compute Test', async () => {
            const result = await fsHasher.Compute(_.HASH_ALGORITHMS.SHA256);
            await expect(result).toBe('136f536ef23c6e50b180731d66a77b4a09947d20bcfa0c536f10951f8fad1f28'.toUpperCase());
            console.log(result);
        });
    });

    describe('FSHasher Directory Heriarchy Test', ()=>{
        const source = _join(__dirname, '../../test/sample_data/');
        const fsHasher = new _.FSHasher();

        test('Build Test', async () => {
            const result = await fsHasher.Build(source);
            await expect(result).toBe(true);
        });
        test('Compute Test', async () => {
            const result = await fsHasher.Compute(_.HASH_ALGORITHMS.SHA256);
            await expect(result).toBeDefined();
            console.log(result);
        });
        test('Report Test', async () => {
            const result = await fsHasher.Report();
            await expect(result).toBeDefined();
        });
        test('Duplicates Test', async () => {
            const result = await fsHasher.FindDuplicates();
            await expect(result).toBeDefined();
        });
    });
});
