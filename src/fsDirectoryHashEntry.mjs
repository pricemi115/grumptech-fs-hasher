/**
 * @description Module handling directory file system hashing results.
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSBatchHashEntryModule
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 * @requires fs
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#file-system}
 * @requires path
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/path.html#path}
 * @requires crypto
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/crypto.html#crypto}
 */

// External dependencies and imports.
import _debugModule from 'debug';
import * as modPath                     from 'path';
import {promises as _filesystemPromise} from 'fs';
import * as modCrypto                   from 'crypto';
import _is from 'is-it-check';

// Internal dependencies
import {FSTypeMismatch, FSHashError}                from './fsHashErrors.mjs';
import {FileSystemHashEntryBase, FILE_SYSTEM_TYPES} from './fsHashEntryBase.mjs';
import {FileHashEntry}                              from './fsFileHashEntry.mjs';

/**
 * @private
 * @description Debugging function pointer for runtime related diagnostics.
 */
// eslint-disable-next-line no-unused-vars
const _debug = _debugModule('fs-hasher_hashDir');

/**
 * @description Handles hashing of directories.
 * @augments FileSystemHashEntryBase
 */
export class DirectoryHashEntry extends FileSystemHashEntryBase {
    /**
     * Constructor
     */
    constructor() {
        // Initialize the base class.
        super();

        // Initialize members
        this._childItems  = [];
    }

    /**
     * @description Read-Only Property for determining if this Directory file system object is busy.
     * @returns {boolean} - true if busy
     * @throws RangeError - thrown if there is an issue interating over the child items.
     */
    get IsBusy() {
        let busy = super.IsBusy;

        // Iterate over the children. If any are busy, we are busy.
        for (const indexChild in this._childItems) {
            if (Object.prototype.hasOwnProperty.call(this._childItems, indexChild)) {
                busy = busy || this._childItems[indexChild].IsBusy;
            }
            else {
                throw new RangeError(`Invalid item encountered in the child items. ${indexChild}`);
            }
        }

        return ( busy );
    }

    /**
     * @description Read-OnlyProperty accessor to read the file system type for this item.
     * @returns {FILE_SYSTEM_TYPES} - The file system type for this item. Always FILE_SYSTEM_TYPES.DIRECTORY
     */
    get Type() {
        return ( FILE_SYSTEM_TYPES.DIRECTORY );
    }

    /**
     * @description Build a heirarchy of file system entries based upon the source
     * @param {string | string[]} source - Array containing the list of files/directories to be hashed.
     * @param {number} depth - Depth of this object in the tree.
     * @returns {Promise} - A promise that when resolved from the base class will indicate the File System Type of the source specified.
     * @throws {FSTypeMismatch} - File System Type Mismatch.
     */
    Build(source, depth) {
        // If this is being invoked from an extended class, defer to our parent.
        if (this.Type !== FILE_SYSTEM_TYPES.DIRECTORY) {
        // defer
            // eslint-disable-next-line new-cap
            return super.Build(source, depth);
        }
        else {
            return (new Promise((resolve) => {
                // Initialize data members
                this._childItems  = [];

                (async (src, dep) => {
                    // Validte that source is actually a direcotry !!
                    // eslint-disable-next-line new-cap
                    const fsType = await super.Build(src, dep);

                    // Ensure that the source is really a directory.
                    if (fsType === this.Type) {
                        // Read the directory contents and continue building
                        // the heirarchy.
                        try {
                            const files = await _filesystemPromise.readdir(this.Source);

                            if (files.length > 0) {
                                // Array of promises for building children.
                                const childBuildPromises = [];
                                for (const file of files) {
                                    // Make a source for the candidate child object.
                                    const childSource = modPath.join(this.Source, file);

                                    // Determine the type of the child.
                                    const fsChildType = await FileSystemHashEntryBase._getFileSystemType(childSource);

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

                                        case FILE_SYSTEM_TYPES.OTHER:
                                        // Break intentionally missing
                                        // eslint-disable-next-line no-fallthrough
                                        case FILE_SYSTEM_TYPES.BATCH:
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
                                    if (_is.existy(fsChildItem) &&
                                        (fsChildItem instanceof FileSystemHashEntryBase)) {
                                        // Add the child the collective.
                                        this._childItems.push(fsChildItem);

                                        // Build the child and cache the promise result.
                                        // eslint-disable-next-line new-cap
                                        const buildPromise = fsChildItem.Build(childSource, (this.Depth+1));
                                        childBuildPromises.push(buildPromise);
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
                            else {
                                // Empty directory
                                super._Busy = false;
                                resolve(true);
                            }
                        }
                        catch (err) {
                            super._Busy = false;
                            resolve(false);
                        }
                    }
                    else {
                        // Mismatch between the expected and observed file types.
                        const error = new FSTypeMismatch(FILE_SYSTEM_TYPES.DIRECTORY, fsType, 'fsDirectoryHashEntry.js');
                        throw (error);
                    }
                })(source, depth);
            }));
        }
    }

    /**
     * @description Computes digest for this file. Also, optionally, updates the digest of the directory containing this file.
     * @param {string} _algorithm - Hashing algorithm to use.
     * @returns {Promise} - A promise that when resolved will provide the digests of this item and the parent as an object {digest, parentDigest}.
     *                      If the parentHash object is not provided, it will resolve
     *                      as null.
     *                      If the file could not be hashed, then this will
     *                      resolve with null.
     * @throws {FSTypeMismatch} - File System Type Mismatch.
     * @throws {FSHashError} - thrown if an error is encountered when hashing,
     */
    Compute(_algorithm = 'sha256') {
        // Validate arguments.
        if (_is.not.string(_algorithm)) {
            throw new FSTypeMismatch('string', typeof(_algorithm), 'fsDirectoryHashEntry.js DirectoryHashEntry::Compute');
        }

        return (new Promise((resolve) => {
            if (_is.string(this.Source) && _is.above(this.Source.length, 0) &&
                !this.IsBusy) {
                this._Busy = true;
                this._Digest = undefined;

                (async (alg) => {
                    try {
                        // Note: Use the sorted list to ensure the proper traversal of the tree.
                        const children = this._Children;
                        // Create a 'combined' list of the children, where the directories lead the files.
                        const allChildren = children.directories.concat(children.files);

                        // Iterare over the children that need to be hashed.
                        const childComputePromises = [];
                        // Order matters, use 'for..of'
                        for (const child of allChildren) {
                            // Make a source for the candidate child object.
                            // eslint-disable-next-line new-cap
                            const thePromise = child.Compute(alg);
                            childComputePromises.push(thePromise);
                        }

                        // Wait for the computations to complete
                        const results = await Promise.all(childComputePromises);

                        // For a consistent, name-agostic message digest
                        // sort the results alpha-numerically.
                        results.sort((a, b) => {
                            // Assume equality
                            let sortResult = 0;
                            if (a.digest < b.digest) {
                                sortResult = -1;
                            }
                            else if (a.digest > b.digest) {
                                sortResult = 1;
                            }

                            return sortResult;
                        });

                        // Compute my hash.
                        // -----------------------------------------
                        // Create the worker hash.
                        const myHash = modCrypto.createHash(alg);
                        // Default to undefined in case we have no children.
                        this._Digest = undefined;
                        for (const result of results) {
                            // Update my working hash
                            if (_is.existy(result.digest)) {
                                myHash.update(result.digest);
                            }
                            // if this is the first result, then just copy the hash digest to mine.
                            if (_is.not.existy(this.Digest)) {
                                this._Digest = result.digest;
                            }
                            // Otherwise, set my digest to the running digest.
                            else if (_is.existy(result.digest)) {
                                this._Digest = myHash.copy().digest('hex').toUpperCase();
                            }
                        }

                        // Clear busy.
                        this._Busy = false;

                        resolve({source: this.Source, digest: this.Digest});
                    }
                    catch (err) {
                        this._Busy = false;
                        resolve({source: this.Source, digest: null});
                        throw new FSHashError(this.Source, alg, err.toString(), 'fsDirectoryHashEntry.js DirectoryHashEntry::Compute');
                    }
                })(_algorithm);
            }
            else {
                resolve({source: this.Source, digest: null});
            }
        }));
    }

    /**
     * @description Report of the file system heirarchy with the results of the hashing.
     * @returns {Promise} - A promise that when resolved will provide an object
                         of the form:
                         {
                           type   {string} - '(D)'-Directory or ''(F)'-File
                           source {string} - Path of the File System object.
                           depth  {number} - Depth of the item in the heirarchy.
                           digest {string} - Hash digest of the item. If has not
                                             been computed, will default to undefined.
                         }
                         If the heirarchy has not been built or the source is busy
                         will resolve to null.
     */
    Report() {
        return (new Promise((resolve) => {
            (async () => {
                let reportResults = [];
                // Start with the report for this item.
                // eslint-disable-next-line new-cap
                const myReport = await super.Report();
                reportResults.push(myReport);

                // Did this object's Report resolve properly?
                if (_is.existy(myReport)) {
                    const childReportPromises = [];
                    // Note: Use the sorted list to ensure the proper traversal of the tree.
                    const children = this._Children;
                    // Create a 'combined' list of the children, where the directories lead the files.
                    const allChildren = children.directories.concat(children.files);
                    // Order matters, use 'for..of'
                    for (const child of allChildren) {
                        // Make a source for the candidate child object.
                        // eslint-disable-next-line new-cap
                        const thePromise = await child.Report();
                        childReportPromises.push(thePromise);
                    }

                    // Wait for the computations to complete
                    const results = await Promise.all(childReportPromises);

                    for (const report of results) {
                        if (_is.existy(report)) {
                            if (_is.array(report)) {
                                // Combine the arrays, so we don't end up with nested arrays.
                                reportResults = reportResults.concat(report);
                            }
                            else {
                                // Single item. Append to the list.
                                reportResults.push(report);
                            }
                        }
                    }
                }

                this._Busy = false;
                resolve(reportResults);
            })();
        }));
    }

    /* ========================================================================
        Internal/Private helpers
        ======================================================================== */
    /**
     * @description Internal helper to provide a sorted list of child objects.
     *              It is *desirable*, especially for the computation of directory
     *              hashes, that the children be sorted such that sub-directories
     *              come before files.
     * @returns {object} - Object containing sorted arrays of Directories and Files.
     *                     {.directories: Array, .files: Array}
     * @throws {FSTypeMismatch} - Thrown when unchandled child is encountered.
     */
    get _Children() {
        const dirChildren  = [];
        const fileChildren = [];

        for (const childItem in this._childItems) {
            if (_is.existy(this._childItems[childItem]) &&
                (this._childItems[childItem] instanceof FileSystemHashEntryBase)) {
                switch (this._childItems[childItem].Type) {
                    case FILE_SYSTEM_TYPES.DIRECTORY:
                        {
                            // Append to the directory list.
                            dirChildren.push(this._childItems[childItem]);
                        }
                        break;

                    case FILE_SYSTEM_TYPES.FILE:
                        {
                            // Append to the file list.
                            fileChildren.push(this._childItems[childItem]);
                        }
                        break;

                    case FILE_SYSTEM_TYPES.INVALID:
                    // break intentionally missing
                    // eslint-disable-next-line no-fallthrough
                    case FILE_SYSTEM_TYPES.OTHER:
                    // break intentionally missing
                    // eslint-disable-next-line no-fallthrough
                    default:
                        {
                            // Not a valid child.
                            throw new FSTypeMismatch([FILE_SYSTEM_TYPES.DIRECTORY, FILE_SYSTEM_TYPES.FILE], FILE_SYSTEM_TYPES.INVALID, 'fsDirectoryHashEntry.js');
                        }
                        // eslint-disable-next-line no-unreachable
                        break;
                }
            }
            else {
                throw new FSTypeMismatch([FILE_SYSTEM_TYPES.DIRECTORY, FILE_SYSTEM_TYPES.FILE], FILE_SYSTEM_TYPES.INVALID, 'fsDirectoryHashEntry.js');
            }
        }

        // For consistent results. Sort the children alpha-numerically.
        dirChildren.sort();
        fileChildren.sort();

        // Return the sorted arrays.
        return ({directories: dirChildren, files: fileChildren});
    }
}
