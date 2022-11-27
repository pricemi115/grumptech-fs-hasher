/**
 * @description Module handling file file system hashing results.
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSHashEntryBaseModule
 * @private
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

/**
 * @description External dependencies and imports.
 */
import _debugModule from 'debug';

// Internal dependencies
import {FSTypeMismatch}                                 from './fsHashErrors.mjs';
import {FileSystemHashEntryBase, FILE_SYSTEM_TYPES}     from './fsHashEntryBase.mjs';
import {HashRequest, FileHasherSerializer}              from './hashHelper.mjs';
import _is from 'is-it-check';

/**
 * @private
 * @description Debugging function pointer for runtime related diagnostics.
 */
// eslint-disable-next-line no-unused-vars
const _debug = _debugModule('fs-hasher_hashFile');

/**
 * @description Handles hashing of files.
 * @augments FileSystemHashEntryBase
 * @private
 */
export class FileHashEntry extends FileSystemHashEntryBase {
    /**
     * @description Constructor
     */
    constructor() {
        // Initialize the base class.
        super();
    }

    /**
     * @description Read-OnlyProperty accessor to read the file system type for this item.
     * @returns {FILE_SYSTEM_TYPES} - The file system type for this item. Always FILE_SYSTEM_TYPES.FILE
     */
    get Type() {
        return ( FILE_SYSTEM_TYPES.FILE );
    }

    /**
     * @description Build a heirarchy of file system entries based upon the source
     * @param {string | string[]} source - Array containing the list of files/directories to be hashed.
     * @param {number} depth - Depth of this object in the tree.
     * @returns {Promise} - A promise that when resolved from the base class will indicate the File System Type of the source specified.
     * @throws {FSTypeMismatch} - File System Type Mismatch.
     */
    Build(source, depth) {
        return (new Promise((resolve) => {
            (async (src, dep) => {
                // Validte that source is actually a direcotry !!
                // eslint-disable-next-line new-cap
                const fsType = await super.Build(src, dep);

                // Ensure that the source is really a 'readable' file.
                if (fsType === this.Type) {
                    // We need to do is clear busy & resolve.
                    super._Busy = false;
                    resolve(true);
                }
                else {
                    // Mismatch between the expected and observed file types.
                    const error = new FSTypeMismatch(FILE_SYSTEM_TYPES.FILE, fsType, 'fsFileHashEntry.js');
                    throw (error);
                }
            })(source, depth);
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
                // eslint-disable-next-line new-cap
                const reportResult = await super.Report();

                // Clear busy & pass along the result
                this._Busy = false;
                resolve(reportResult);
            })();
        }));
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
     */
    Compute(_algorithm = 'sha256') {
        // Validate arguments.
        if (_is.not.string(_algorithm)) {
            throw new FSTypeMismatch('string', typeof(_algorithm), 'fsFileHashEntry.js');
        }

        return (new Promise((resolve) => {
            if (_is.string(this.Source) && _is.above(this.Source.length, 0) &&
                !this.IsBusy) {
                this._Busy = true;
                this._Digest = undefined;

                (async (alg) => {
                    // Create a hash request
                    const request = new HashRequest({source: this.Source, algorithm: alg});
                    // Register for events of interest
                    request.once('hash_complete', (result) => {
                        // Clear busy.
                        this._Busy = false;
                        // Set the digest
                        this._Digest = result.digest;
                        // Report
                        resolve({source: this.Source, digest: this.Digest});
                    });

                    // Submit the hash request to the serializer.
                    // eslint-disable-next-line new-cap
                    FileHasherSerializer.SubmitHashRequest(request);
                })(_algorithm);
            }
            else {
                // Report
                resolve({source: this.Source, digest: undefined});
            }
        }));
    }
}
