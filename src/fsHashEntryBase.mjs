/**
 * @description Module serving as the base class for file system items
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSHashEntryBaseModule
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires fs
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#file-system}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import {Hash} from 'crypto';
import _debugModule from 'debug';
import * as modFileSystem                from 'fs';
import {promises as _fileSystemPromises} from 'fs';

// Internal dependencies
import {FSAbstract, FSTypeMismatch} from './fsHashErrors.mjs';

/**
 * @private
 * @description Debugging function pointer for runtime related diagnostics.
 */
// eslint-disable-next-line no-unused-vars
const _debug = _debugModule('fs-hasher_hashBase');

/**
 * @description Enumeration for file system types
 * @private
 * @readonly
 * @enum {number}
 * @property {number} INVALID- Invalid file system type
 * @property {number} FILE - File item.
 * @property {number} DIRECTORY - Directory item
 * @property {number} BATCH - Mix of files and directory items
 * @property {number} OTHER - Unhandled file system type
 */
export const FILE_SYSTEM_TYPES = {
    /* eslint-disable key-spacing */
    INVALID   : 0,
    FILE      : 1,
    DIRECTORY : 2,
    BATCH     : 3,
    OTHER     : 4,
    /* eslint-enable key-spacing */
};

/**
 * @description - Serves as the base class for file system entries to compure
                  file system hash results. This base class also serves
                  when the file system object is a readable file.
 */
export class FileSystemHashEntryBase {
    /**
     * @description - Constructor
     * @throws {FSAbstract} - thrown when attempting to create the non-instancable/abstract class.
     */
    constructor() {
        // Ensure we are not attempting to instanciate the base class.
        if (this.constructor === FileSystemHashEntryBase) {
            // Prevent creation of the base object.
            const error = new FSAbstract('FileSystemHashEntryBase');
            throw (error);
        }

        // Initialize members
        this._source  = undefined;
        this._digest  = undefined;
        this._depth   = 0;
        this._busy    = false;
    }

    /**
     * @description Read-Only Property for determining if this FileSystemHashEntry object is busy.
     * @returns {boolean} - true if busy
     */
    get IsBusy() {
        return ( this._busy );
    }

    /**
     * @description Read-Only Property indicating the heirarchy depth for this entry.
     * @returns {number} - heirarchy depth, where 0 indicates the root.
     */
    get Depth() {
        return ( this._depth );
    }

    /**
     * @description Read-OnlyProperty accessor to read the file system source for this item.
     * @returns {string} - The file system path for the source.
     */
    get Source() {
        return ( this._source );
    }

    /**
     * @description Read-Only property accessor to read the digest for this item.
     * @returns {string | undefined} - The hash digest for this item.
     */
    get Digest() {
        return ( this._digest );
    }

    // eslint-disable-next-line jsdoc/require-returns-check
    /**
     * @description Read-OnlyProperty accessor to read the file system type for this item. (Abstract function)
     * @returns {FILE_SYSTEM_TYPES} - The file system type for this item.
     * @throws {FSAbstract} - Always thrown if invoked on the base class!
     */
    get Type() {
        // Abstract function.
        const error = new FSAbstract('FileSystemHashEntryBase::Type');
        throw (error);
    }

    /**
     * @description Build a heirarchy of file system entries based upon the source
     * @param {string | string[]} source - Path for the file system object.
     * @param {number} depth - Depth of this object in the tree.
     * @returns {Promise} - A promise that when resolved from the base class will indicate the File System Type of the source specified.
     * @throws {RangeError} - If the depth is negative or not an integer.
     * @throws {TypeError} - If the depth not a number. Specifically an integer.
     */
    Build(source, depth) {
        if ((!typeof(depth) ==='number') || (!Number.isInteger(depth))) {
            throw new TypeError(`Depth must be an integer`);
        }
        if (depth < 0) {
            throw new RangeError(`Hash entry depth must be a positive integer. Depth:${depth}`);
        }

        return (new Promise((resolve) => {
            if (!this._busy) {
                // Indicate busy.
                this._busy = true;

                // Reset/initialize members.
                this._source  = source;
                this._digest  = undefined;
                this._depth   = depth;

                (async (src) => {
                    const fsType = await FileSystemHashEntryBase._getFileSystemType(src);

                    resolve(fsType);
                })(source);
            }
            else {
                resolve(FILE_SYSTEM_TYPES.INVALID);
            }
        }));
    }

    // eslint-disable-next-line jsdoc/require-returns-check
    /**
     * @description Computes digest for this file. Also, optionally, updates the digest of the directory containing this file.
     * @param {string} _algorithm - Hashing algorithm to use.
     * @param {Hash} _parentHash - Hash object provided by the parent.
     * @returns {Promise} - A promise that when resolved will provide the digests of this item and the parent as an object {digest, parentDigest}.
     *                      If the parentHash object is not provided, it will resolve
     *                      as null.
     *                      If the file could not be hashed, then this will
     *                      resolve with null.
     * @throws {FSAbstract} - Always thrown if invoked on the base class!
     */
    Compute(_algorithm, _parentHash) {
        // Abstract function.
        const error = new FSAbstract('FileSystemHashEntryBase::Compute');
        throw (error);
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
            if (this.Source && (typeof(this.Source) === 'string') && (this.Source.length > 0) &&
                !this.IsBusy) {
                this._busy = true;

                const report = {type: this.Type, source: this.Source, depth: this.Depth, digest: this.Digest};
                resolve(report);
            }
            else {
                resolve(null);
            }
        }));
    }

    /**
     * @description Property accessor to write the busy status.
     * @param {number} busy - Flag indicating if this file system hash entry object is busy.
     * @private
     */
    set _Busy(busy) {
        this._busy = busy;
    }

    /**
     * @description Property accessor to write the digest.
     * @param {string | undefined} digest - Digest of the item.
     * @throws {FSTypeMismatch} - thrown if the digst is not a string
     * @private
     */
    set _Digest(digest) {
        if (digest && typeof(digest) !== 'string') {
            throw new FSTypeMismatch(['string', 'falsy'], typeof(digest), 'fsHashEntryBase.js');
        }

        this._digest = digest;
    }

    /**
     * @description Helper to determine the file system type ot the specified string.
     * @param {string} source - Path of the source to be evaluated for accessibilitynand file type.
     *                          Assumed to be a valid file System object,
     *                          either a Fiile or Directory.
     * @returns {Promise} - A promise that when resolved will indicate the File Type of the
                         source {INVALID, FILE, DIRECTORY, OTHER}
     */
    static _getFileSystemType(source) {
        return (new Promise((resolve) => {
            if ( source != null ) {
                if (typeof(source) === 'string') {
                    (async (src) => {
                        try {
                            // Ensure that there is read access to the specified source.
                            await _fileSystemPromises.access(src, modFileSystem.constants.R_OK);

                            // Get the File System Stats.
                            const fsStat = await _fileSystemPromises.stat(src);

                            // Determine the type of the file system source.
                            let result = FILE_SYSTEM_TYPES.OTHER;
                            if (fsStat.isDirectory()) {
                                result = FILE_SYSTEM_TYPES.DIRECTORY;
                            }
                            else if (fsStat.isFile()) {
                                result = FILE_SYSTEM_TYPES.FILE;
                            }

                            // Resolve the result
                            resolve(result);
                        }
                        catch (err) {
                            // The source specified is either not a file system object or
                            // it is inaccessible to the current user.
                            resolve(FILE_SYSTEM_TYPES.INVALID);
                        }
                    })(source);
                }
                else if (Array.isArray(source)) {
                    (async (src) => {
                        // Default to assuming that this is an array of strings.
                        let result = FILE_SYSTEM_TYPES.BATCH;

                        for (const item of src) {
                            if (item) {
                                if (typeof(item) === 'string') {
                                    const fsType = await FileSystemHashEntryBase._getFileSystemType(item);
                                    if ((fsType !== FILE_SYSTEM_TYPES.FILE) &&
                                        (fsType !== FILE_SYSTEM_TYPES.DIRECTORY)) {
                                        // Contents of the array do not conform.
                                        result = FILE_SYSTEM_TYPES.INVALID;
                                        break;
                                    }
                                }
                                else {
                                    // Illegal value.
                                    result = FILE_SYSTEM_TYPES.INVALID;
                                    break;
                                }
                            }
                        }

                        // Resolve the result
                        resolve(result);
                    })(source);
                }
            }
            else {
                // The argument specified is not valid.
                resolve(FILE_SYSTEM_TYPES.INVALID);
            }
        }));
    }
}
