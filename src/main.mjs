/**
 * @description API entry point for GrumpTech-fs-hasher
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSHasherAPI
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires fs
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#file-system}
 * @requires url
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/url.html}
 * @requires os
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/os.html}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import _debugModule from 'debug';
import {readFileSync as _readFileSync} from 'node:fs';
import {fileURLToPath as _fileURLToPath} from 'node:url';
import {join as _join, dirname as _dirname} from 'node:path';

// Internal dependencies
import {FSTypeMismatch}                             from './fsHashErrors.mjs';
import {FileSystemHashEntryBase, FILE_SYSTEM_TYPES} from './fsHashEntryBase.mjs';
import {FileHashEntry}                              from './fsFileHashEntry.mjs';
import {DirectoryHashEntry}                         from './fsDirectoryHashEntry.mjs';
import {BatchHashEntry}                             from './fsBatchHashEntry.mjs';

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

/**
 * @description Debugging function pointer for runtime related diagnostics.
 * @private
 * @readonly
 */
const _debug = _debugModule('fs-hasher_main');

/**
 * @description Helper to get the information of interest from the package.json file.
 * @returns {object} Data of interest.
 * @private
 */
function _getPackageInfo() {
    const packageFilename = _join(__dirname, '../package.json');
    const rawContents = _readFileSync(packageFilename);
    const parsedData = JSON.parse(rawContents);

    const pkgInfo = {CONFIG_INFO: parsedData.config_info, PLUGIN_VER: parsedData.version};

    return pkgInfo;
}

/**
 * @description Package Information
 * @readonly
 * @private
 */
const _PackageInfo = _getPackageInfo();

/**
 * @description Enumeration of hashing algorithms
 * @private
 * @readonly
 * @enum {string}
 * @property {string} MD5 - MD5 Algorithm
 * @property {string} SHA224 - SHA224 Algorithm
 * @property {string} SHA256 - SHA256 Algorithm
 * @property {string} SHA384 - SHA384 Algorithm
 * @property {string} SHA512 - SHA512 Algorithm
 */
export const HASH_ALGORITHMS = {
    /* eslint-disable key-spacing */
    MD5     : 'md5',
    SHA224  : 'sha224',
    SHA256  : 'sha256',
    SHA384  : 'sha384',
    SHA512  : 'sha512',
    /* eslint-enable key-spacing */
};

/**
 * @description Default hashing algorithm
 * @readonly
 * @private
 */
const _DEFAULT_ALGORITHM = HASH_ALGORITHMS.SHA256;

/**
 * @description Map of FSHasher worker instances keyed on the API instance that created it.
 * @private
 */
const _internalFSHashObjs = new Map();

/**
 * @description Generator of message digests of file system objects.
 * @private
 */
class FSHasherInternal {
    /**
     * @description Constructor
     */
    constructor() {
        _debug(`GrumpTech FS Hasher version: v${_PackageInfo.PLUGIN_VER}`);

        // Set the internal defaults
        this._algorithm   = HASH_ALGORITHMS.SHA256;
        this._rootSource  = undefined;
    }

    /**
     * @description Read-Only Property for the product version.
     * @returns {string} Plug-In Version
     */
    get Version() {
        return ( _PackageInfo.PLUGIN_VER );
    }

    /**
     * @description Read-Only Property for determining if GrumpTechHash object is busy.
     * @returns {boolean} True if the plug-in is busy
     */
    get IsBusy() {
        let busy = false;
        if (this._rootSource) {
            busy = this._rootSource.IsBusy;
        }
        return ( busy );
    }

    /**
     * @description Read-only property accessor for the algorithm to be used for hashing
     * @returns {HASH_ALGORITHMS} Hashing algorithm
     */
    get Algorithm() {
        return ( this._algorithm );
    }

    /**
     * @description Read-Only Property accessor to read the Root Source of the source to be hashed.
     * @returns {string | string[]} - The file system path for the root source.
     */
    get Source() {
        let src = '';
        if (this._rootSource) {
            src = this._rootSource.Source;
        }
        return ( src );
    }

    /**
     * @description Build a heirarchy of file system entries based upon the root source
     * @param {string | string[]} source - Path(s) for the file system object.
     * @returns {Promise} - A promise that when resolved will indicate if the file system heirarchy was built or not.
     *                       true if built. false otherwise.
     * @throws {TypeError} = thrown if the aeguent does not conform to expectations.
     */
    Build(source) {
        if (source &&
            (typeof(source) !== 'string') &&
            (!Array.isArray(source))) {
            throw new TypeError(`Build() must take a string or an array of strings.`);
        }

        return (new Promise((resolve) => {
            // Clear the root source.
            this._rootSource = undefined;

            (async (src) => {
                const fsType = await FileSystemHashEntryBase._getFileSystemType(src);
                switch (fsType) {
                    case FILE_SYSTEM_TYPES.DIRECTORY:  {
                        this._rootSource = new DirectoryHashEntry();
                        break;
                    }

                    case FILE_SYSTEM_TYPES.FILE: {
                        this._rootSource = new FileHashEntry();
                        break;
                    }

                    case FILE_SYSTEM_TYPES.BATCH: {
                        // The Batch source can only exist at the root.
                        this._rootSource = new BatchHashEntry();
                        break;
                    }

                    case FILE_SYSTEM_TYPES.OTHER:
                    // Break intentionally missing
                    // eslint-disable-next-line no-fallthrough
                    case FILE_SYSTEM_TYPES.INVALID:
                    // Break intentionally missing
                    // eslint-disable-next-line no-fallthrough
                    default: {
                        // Nothing to do.
                        break;
                    }
                }

                // Build the tree.
                let success = false;
                if (this._rootSource) {
                    // eslint-disable-next-line new-cap
                    success = await this._rootSource.Build(src, 0);
                }

                resolve(success);
            })(source);
        }));
    }

    /**
     * @description Generate a message digest of the root source.
     * @param {HASH_ALGORITHMS} algorithm - Algorithm to use when generating the message digest.
     * @returns {Promise} - A promise that when resolved will provide a string
     *                      representing the overall hash of the root source.
     *                      If the heirarchy has not been built or the root source is busy,
     *                      the promise will resolve to and empty string.
     */
    Compute(algorithm = _DEFAULT_ALGORITHM) {
        // Cache the algorithm t
        return (new Promise((resolve) => {
            if (this._rootSource &&
                !this._rootSource.IsBusy) {
                this._Algorithm = algorithm;
                (async () => {
                    // eslint-disable-next-line new-cap
                    const result = await this._rootSource.Compute(this.Algorithm);

                    resolve(result.digest);
                })();
            }
            else {
                _debug(`Compute: Root source not valid or is busy.`);
                resolve('');
            }
        }));
    }

    /**
     * @description Build a report of the file system heirarchy with the results of the hashing.
     * @returns {Promise} - A promise that when resolved will provide a string
     *                      containing a CSV delimited report. If the heirarchy has
     *                      not been built or the root source is busy,
     *                      the promise will resolve to an empty string.
     *                      CSV Format:
     *                        Field #1: Type   - '(D)'-Directory, '(F)'-File, '(B)'-Batch
     *                        Field #2: Source - Path of the File System object.
     *                                           Will be prepended with spaces corresponding
     *                                           to the depth of the result item.
     *                        Field #3: Digest - Message digest of the item.
     *                                           If it has not been computed,
     *                                           it will default to undefined.
     */
    Report() {
        return (new Promise((resolve) => {
            if (this._rootSource &&
                !this._rootSource.IsBusy) {
                (async () => {
                    // eslint-disable-next-line new-cap
                    const report = await this._rootSource.Report();

                    // Reformat the report results into the CSV Format.
                    let myCSVReport = '';
                    // If the root source is a directory or a batch, iterate over the report results.
                    if (this._rootSource instanceof DirectoryHashEntry) {
                        for (const item of report) {
                            const paddedSource = item.source.padStart((item.source.length+item.depth), ' ');
                            myCSVReport = myCSVReport.concat(`${this._translateFSType(item.type)};>${paddedSource};${item.digest}\n`);
                        }
                    }
                    // Otherwise, report results from files are not iterable and no padding is needed for the source.
                    else {
                        myCSVReport = myCSVReport.concat(`${this._translateFSType(report.type)};>${report.source};${report.digest}\n`);
                    }

                    resolve(myCSVReport);
                })();
            }
            else {
                _debug(`Build: Root source not valid or is busy`);
                resolve('');
            }
        }));
    }

    /**
     * @description Finds duplicate file system objects.
     * @returns {Promise} - A promise that when resolved will provide a map/dictionary.
     *                      The key of the dictionary will be "common" message digest
     *                      and the value will be an array of strings containing
     *                      the sources sharing the digest. Unique items will _not_
     *                      be specified in the result.
     *                      {key: digest, value: source[]}
     * @throws {Error} - When there is a prpblem woth the message digest(s) that are generated.
     */
    FindDuplicates() {
        return (new Promise((resolve) => {
            if (this._rootSource &&
                !this._rootSource.IsBusy) {
                (async () => {
                    // Get the report from the root
                    // eslint-disable-next-line new-cap
                    const report = await this._rootSource.Report();

                    // Create a map for tracking duplicated digests.
                    const internalMap = new Map();
                    // Iterate ofer the report adding new entries when a
                    // unique digest is encountered. If a digest is found to
                    // already exist, update the entry.
                    for (const item of report) {
                        if (internalMap.has(item.digest)) {
                            // This digest has been encountered before.
                            const value = internalMap.get(item.digest);
                            if (value && Array.isArray(value)) {
                                // Update the value by appending the duplicated source.
                                value.push(item.source);
                                // Update the map.
                                internalMap.set(item.digest, value);
                            }
                            else {
                                throw new Error('Missing or wrong value !!');
                            }
                        }
                        else {
                            // This is a new item. So simply register this digest & source.
                            internalMap.set(item.digest, new Array(item.source));
                        }
                    }

                    // Generate the map to be returned that contains only repeated items.
                    const duplicatesMap = new Map();
                    internalMap.forEach((value, key) => {
                        if (value && Array.isArray(value) && (value.length > 1)) {
                        // Duplicate found.
                            duplicatesMap.set(key, value);
                        }
                    });

                    resolve(duplicatesMap);
                })();
            }
            else {
                _debug(`Build: Root source not valid or is busy`);
                resolve('');
            }
        }));
    }

    /* ========================================================================
     Internal/Private helpers
     ======================================================================== */
    /**
     * @description Internal property accessor to write the algorithm to be used for hashing
     * @param {HASH_ALGORITHMS} algorithm - Algorithm to use when generating a message digest.
     * @returns {void}
     * @private
     */
    set _Algorithm(algorithm) {
        // Set the algorithm as specified.
        if ( (algorithm != null) && (typeof(algorithm) === 'string') ) {
            switch (algorithm) {
                case HASH_ALGORITHMS.MD5:
                case HASH_ALGORITHMS.SHA224:
                case HASH_ALGORITHMS.SHA256:
                case HASH_ALGORITHMS.SHA384:
                case HASH_ALGORITHMS.SHA512: {
                    this._algorithm = algorithm;
                    break;
                }

                default:
                {
                    _debug(`Unknown algorithm '${algorithm}' specified. Use at your own risk.`);
                    this._algorithm = algorithm;
                    break;
                }
            }
        }
        else {
            // Use the default
            this._algorithm = HASH_ALGORITHMS.SHA256;
        }
    }

    /**
     * @description Internal helper to translate the File System Type for reporting.
     * @param {FILE_SYSTEM_TYPES} type - File system type to translate
     * @returns {string} - string representing the file system type.
     * @throws {FSTypeMismatch} - thrown when the file system type is unknown.
     */
    _translateFSType(type) {
        let repFileType = '(Unknown)';
        switch (type) {
            case FILE_SYSTEM_TYPES.DIRECTORY:
            {
                repFileType = '(D)';
                break;
            }

            case FILE_SYSTEM_TYPES.FILE:
            {
                repFileType = '(F)';
                break;
            }


            case FILE_SYSTEM_TYPES.BATCH:
            {
                repFileType = '(B)';
                break;
            }

            case FILE_SYSTEM_TYPES.OTHER:
            {
                repFileType = '(O)';
                break;
            }

            case FILE_SYSTEM_TYPES.INVALID:
            {
                repFileType = '(I)';
                break;
            }

            default:
            {
                throw new FSTypeMismatch([FILE_SYSTEM_TYPES.DIRECTORY, FILE_SYSTEM_TYPES.FILE, FILE_SYSTEM_TYPES.BATCH], type, 'main.js');
                break;
            }
        }

        return repFileType;
    }
}

/**
 * @description API Wrapper for the internal FSHasher
 */
export class FSHasher {
    /**
     * @description Constructor
     */
    constructor() {
        // Create an instance of FS Hasher and register it in the internal map.
        _internalFSHashObjs.set(this, new FSHasherInternal());
    }

    /**
     * @description Descructor
     * @returns {void}
     */
    destroy() {
        // Remove ourself from the internal map.
        if (_internalFSHashObjs.has(this)) {
            _internalFSHashObjs.delete(this);
        }
    }

    /**
     * @description API Wrapper for the Version Property
     * @returns {string} - Product version.
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    get Version() {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            return fshasher.Version;
        }
        else {
        // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the IsBusy Property
     * @returns {boolean} - true if busy
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    get IsBusy() {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            return fshasher.IsBusy;
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the Algorithm Property
     * @returns {HASH_ALGORITHMS} - Hashsing algorithm to be used for generating message digests.
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    get Algorithm() {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            return fshasher.Algorithm;
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the Source Property
     * @returns {string | string[]} -  The file system path for the root source.
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    get Source() {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            return fshasher.Source;
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the Build Method
     * @param {string | string[]} [source] - Path(s) for the file system object.
     * @returns {Promise} - A promise that when resolved will indicate if the
     *                      file system heirarchy was built or not.
     *                      true if built. false otherwise.
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    Build(source) {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            // eslint-disable-next-line new-cap
            return fshasher.Build(source);
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the Compute Method
     * @param {HASH_ALGORITHMS} algorithm - A string representing the hashing algorithm to use.
     * @returns {Promise} - A promise that when resolved will provide a string
     *                      representing the overall hash of the root source.
     *                      If the heirarchy has not been built or the root source is busy,
     *                      the promise will resolve to and empty string.
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    Compute(algorithm) {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            // eslint-disable-next-line new-cap
            return fshasher.Compute(algorithm);
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the Report Method
     * @returns {Promise} - A promise that when resolved will provide a string
     *                      containing a CSV delimited report. If the heirarchy has
     *                      not been built or the root source is busy,
     *                      the promise will resolve to an empty string.
     *                      CSV Format:
     *                        Field #1: Type   - '(D)'-Directory, '(F)'-File, '(B)'-Batch
     *                        Field #2: Source - Path of the File System object.
     *                                           Will be prepended with spaces corresponding
     *                                           to the depth of the result item.
     *                        Field #3: Digest - Message digest of the item.
     *                                           If it has not been computed,
     *                                           it will default to undefined.
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    Report() {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            // eslint-disable-next-line new-cap
            return fshasher.Report();
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }

    /**
     * @description API Wrapper for the FindDuplicates Method
     * @returns {Promise} - A promise that when resolved will provide a map/dictionary.
     *                      The key of the dictionary will be "common" message digest
     *                      and the value will be an array of strings containing
     *                      the sources sharing the digest. Unique items will _not_
     *                      be specified in the result.
     *                      {key: digest, value: source[]}
     * @throws {ReferenceError} - thrown if this instance is no longer registered.
     */
    FindDuplicates() {
        // Get the registered object
        const fshasher = _internalFSHashObjs.get(this);

        // Ensure this object is registered.
        if (fshasher) {
            // eslint-disable-next-line new-cap
            return fshasher.FindDuplicates();
        }
        else {
            // Not retistered.
            throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
        }
    }
}
