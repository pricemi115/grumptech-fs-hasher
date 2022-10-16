/**
 * @description Module handling 'batch' entries of file system hashing results.
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSBatchHashEntryModule
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import _debugModule from 'debug';

// Internal dependencies
import {FSTypeMismatch}                             from './fsHashErrors.mjs';
import {FileSystemHashEntryBase, FILE_SYSTEM_TYPES} from './fsHashEntryBase.mjs';
import {DirectoryHashEntry}                         from './fsDirectoryHashEntry.mjs';
import {FileHashEntry}                              from './fsFileHashEntry.mjs';

/**
 * @private
 * @description Debugging function pointer for runtime related diagnostics.
 */
// eslint-disable-next-line no-unused-vars
const _debug = _debugModule('fs-hasher_hashBatch');

/**
 * @description - Handles hashing of a list of file system sources.
 *                A "batch" item is simply a list of files/directories where
 *                there is no expected heirarichal relationship. In many
 *                ways, other than building, this class acts very much like
 *                a directory.
 * @augments DirectoryHashEntry
 */
export class BatchHashEntry extends DirectoryHashEntry {
    /**
     * @description Constructor
     */
    constructor() {
        // Initialize the base class.
        super();
    }

    /**
     * @description Read-OnlyProperty accessor to read the file system type for this item.
     * @returns {FILE_SYSTEM_TYPES} - The file system type for this item. Always FILE_SYSTEM_TYPES.BATCH
     */
    get Type() {
        return ( FILE_SYSTEM_TYPES.BATCH );
    }

    /**
     * @description Read-OnlyProperty accessor to read the file system source for this item.
     * @returns {string} - A comma separated string of all the items in the _source.
     */
    get Source() {
        let mySource = '';

        for (const item of this._source) {
            if (typeof(item) === 'string') {
                const delimiter = ((mySource.length > 0) ? ',' : '');
                mySource = mySource.concat(delimiter, item);
            }
        }

        return ( mySource );
    }

    /**
     * @description Build a heirarchy of file system entries based upon the source
     *              The 'batch' entry is ONLY supported as a root item (Depth===0) !!
     * @param {string | string[]} source - Array containing the list of files/directories to be hashed.
     * @param {number} depth - Depth of this object in the tree.
     * @returns {Promise} - A promise that when resolved from the base class will indicate the File System Type of the source specified.
     * @throws {FSTypeMismatch} - File System Type Mismatch.
     * @throws {RangeError} - If the depth is negative or not an integer.
     * @throws {TypeError} - If the depth not a number. Specifically an integer.
     */
    Build(source, depth) {
        if (source && !Array.isArray(source)) {
            // The conternts of the source were already validated prior to creating
            // this opject. So no need to repeat that here. Just a quick sanity check
            // to ensure that the source is indeed an Array.
            throw new TypeError(`BatchHashEntry requires the source to be an array.`);
        }
        if ((!typeof(depth) === 'number') || (!Number.isInteger(depth))) {
            throw new TypeError(`Depth must be an integer`);
        }
        if (depth !== 0) {
            // The BatchHashEntry 'must' be a root item.
            throw new RangeError(`BatchHashEntry must be a root item. Depth:${depth}`);
        }

        return (new Promise((resolve) => {
            // Initialize data members
            this._childItems = [];

            (async (src, dep) => {
                // Validte that source is actually a batch !!
                // eslint-disable-next-line new-cap
                const fsType = await super.Build(src, dep);

                // Ensure that the source is really a batch.
                if (fsType === this.Type) {
                    // Read the source contents and continue building
                    // the heirarchy.
                    try {
                        // Array of promises for building children.
                        const childBuildPromises = [];

                        for (const item of src) {
                            if (item) {
                                // Validate that each entry is a string. Redundant check, but
                                // always a good idea.
                                if (typeof(item) === 'string') {
                                    // Get the source for this 'child'
                                    const childSource = item;

                                    // Determine the type of the child.
                                    const fsChildType = await FileSystemHashEntryBase._getFileSystemType(item);

                                    // Create an appropriate child.
                                    let fsChildItem = undefined;
                                    switch (fsChildType) {
                                        case FILE_SYSTEM_TYPES.DIRECTORY:
                                            {
                                                fsChildItem = new DirectoryHashEntry();
                                            }
                                            break;

                                        case FILE_SYSTEM_TYPES.FILE:
                                            {
                                                fsChildItem = new FileHashEntry();
                                            }
                                            break;

                                        case FILE_SYSTEM_TYPES.BATCH:
                                        // Break intentionally missing
                                        // eslint-disable-next-line no-fallthrough
                                        case FILE_SYSTEM_TYPES.OTHER:
                                        // Break intentionally missing
                                        // eslint-disable-next-line no-fallthrough
                                        case FILE_SYSTEM_TYPES.INVALID:
                                        // Break intentionally missing
                                        // eslint-disable-next-line no-fallthrough
                                        default:
                                            {
                                                // Nothing to do.
                                            }
                                            break;
                                    }

                                    // Ensure that there is a child.
                                    if (fsChildItem &&
                                        (fsChildItem instanceof FileSystemHashEntryBase)) {
                                        // Add the child the collective.
                                        this._childItems.push(fsChildItem);

                                        // Build the child and cache the promise result.
                                        // eslint-disable-next-line new-cap
                                        const buildPromise = fsChildItem.Build(childSource, (this.Depth + 1));
                                        childBuildPromises.push(buildPromise);
                                    }
                                }
                                else {
                                    throw new TypeError(`BatchHashEntry source contained an illegal value.`);
                                }
                            }
                        }

                        // Wait for the build of the children to complete and then
                        // resolve the result.
                        const results = await Promise.all(childBuildPromises);

                        // Distill the results to a single result. Any failure is a
                        // failre for all.
                        let result = (childBuildPromises.length > 0);
                        for (const res of results) {
                            result = result && (res === true);
                        }

                        super._Busy = false;
                        resolve(result);
                    }
                    catch (err) {
                        super._Busy = false;
                        resolve(false);
                    }
                }
                else {
                    // Mismatch between the expected and observed file types.
                    const error = new FSTypeMismatch(FILE_SYSTEM_TYPES.BATCH, fsType, 'fsBatchHashEntry.js');
                    throw (error);
                }
            })(source, depth);
        }));
    }
}
