/* ==========================================================================
   File:        main.js
   Description: API entry point for GrumpTech-fs-hasher
   Copyright:   Mar 2020
   ========================================================================== */
'use strict';

// External dependencies and imports.
const _debug = require('debug')('fs-hasher_main');
import { version as VERSION } from '../package.json';

// Internal dependencies
import { FSTypeMismatch }                             from './fsHashErrors.js';
import { FileSystemHashEntryBase, FILE_SYSTEM_TYPES } from './fsHashEntryBase.js';
import { FileHashEntry }                              from './fsFileHashEntry.js';
import { DirectoryHashEntry }                         from './fsDirectoryHashEntry.js';
import { BatchHashEntry }                             from './fsBatchHashEntry.js';

/* Enumeration for hashing algorithms */
export const HASH_ALGORITHMS = {
  MD5     : 'md5',
  SHA224  : 'sha224',
  SHA256  : 'sha256',
  SHA384  : 'sha384',
  SHA512  : 'sha512'
};

const _DEFAULT_ALGORITHM = HASH_ALGORITHMS.SHA256;

// Map of FSHasher worker instances keyed on the API instance that created it.
let _internalFSHashObjs = new Map();

/* ==========================================================================
   Class:              FSHasherInternal
   Description:	       Generator of message digests of file system objects.
   Copyright:          Mar 2020

   ========================================================================== */
class FSHasherInternal {
  /* ========================================================================
     Description: Constructor for an instance of FSHasherInternal.
                  This is the internal worker object hidden from external modules.

     @return {Object} - An instance of the FSHasherInternal class
     ======================================================================== */
  constructor() {

    _debug(`GrumpTech FS Hasher version: v${VERSION}`);

    // Set the internal defaults
    this._algorithm   = HASH_ALGORITHMS.SHA256;
    this._rootSource  = undefined;

  }

  /* ========================================================================
     Description: Read-Only Property for the product version.

     @return {string} - Product version.
     ======================================================================== */
  get Version() {
    return ( VERSION );
  }

  /* ========================================================================
     Description: Read-Only Property for determining if GrumpTechHash object is busy.

     @return {boolean} - true if busy
     ======================================================================== */
  get IsBusy() {
    let busy = false;
    if (this._rootSource) {
      busy = this._rootSource.IsBusy;
    }
    return ( busy );
  }

  /* ========================================================================
     Description: Property accessor to read the algorithm to be used for hashing

     @return {HASH_ALGORITHMS} - Hashsing algorithm to be used.
     ======================================================================== */
  get Algorithm() {
    return ( this._algorithm );
  }

  /* ========================================================================
     Description: Read-Only Property accessor to read the Root Source of the
                  source to be hashed.

     @return {string | string[]} -  The file system path for the root source.
     ======================================================================== */
  get Source() {
    let src = '';
    if (this._rootSource) {
      src = this._rootSource.Source;
    }
    return ( src );
  }

  /* ========================================================================
     Description:    Build a heirarchy of file system entries based upon the
                     root source

     @param {string | string[]} [source] - Path(s) for the file system object.

     @return {Promise} - A promise that when resolved will indicate if the
                         file system heirarchy was built or not.
                         true if built. false otherwise.

     @throws {TypeError} = thrown if the aeguent does not conform to expectationa.
     ======================================================================== */
  Build(source) {
    if (source &&
        (typeof(source) !== 'string') &&
        (!Array.isArray(source)))
    {
      throw new TypeError(`Build() must take a string or an array of strings.`);
    }

    return (new Promise(resolve => {

      // Clear the root source.
      this._rootSource = undefined;

      (async (src) => {
        const fsType = await FileSystemHashEntryBase._getFileSystemType(src);
        switch (fsType) {
          case FILE_SYSTEM_TYPES.DIRECTORY:
          {
            this._rootSource = new DirectoryHashEntry();
          }
          break;

          case FILE_SYSTEM_TYPES.FILE:
          {
            this._rootSource = new FileHashEntry();
          }
          break;

          case FILE_SYSTEM_TYPES.BATCH:
          {
            // The Batch source can only exist at the root.
            this._rootSource = new BatchHashEntry();
          }
          break;

          case FILE_SYSTEM_TYPES.OTHER:
          // Break intentionally missing
          case FILE_SYSTEM_TYPES.INVALID:
          // Break intentionally missing
          default:
          {
            // Nothing to do.
          }
          break;
        }

        // Build the tree.
        let success = false;
        if (this._rootSource) {
          success = await this._rootSource.Build(src, 0);
        }

        resolve(success);
      })(source);
    }));
  }

  /* ========================================================================
     Description:    Generate a message digest of the root source.

     @param {string} - A string representing the hashing algorithm to use.

     @return {Promise} - A promise that when resolved will provide a string
                         representing the overall hash of the root source.
                         If the heirarchy has not been built or the root source is busy,
                         the promise will resolve to and empty string.
     ======================================================================== */
  Compute(algorithm = _DEFAULT_ALGORITHM) {

    // Cache the algorithm t
    return (new Promise(resolve => {

      if (this._rootSource &&
          !this._rootSource.IsBusy) {
            this._Algorithm = algorithm;
            (async () => {
              const result = await this._rootSource.Compute(this.Algorithm);

              resolve(result.digest);
            })();
      }
      else {
        _debug(`Compute: Root source not valid or is busy.`)
        resolve("");
      }
    }));
  }

  /* ========================================================================
     Description:    Build a report of the file system heirarchy with the results
                     of the hashing.

     @return {Promise} - A promise that when resolved will provide a string
                         containing a CSV delimited report. If the heirarchy has
                         not been built or the root source is busy,
                         the promise will resolve to an empty string.
                         CSV Format:
                         Field #1: Type   - '(D)'-Directory, '(F)'-File, '(B)'-Batch
                         Field #2: Source - Path of the File System object.
                                            Will be prepended with spaces corresponding
                                            to the depth of the result item.
                         Field #3: Digest - Message digest of the item.
                                            If it has not been computed,
                                            it will default to undefined.
     ======================================================================== */
  Report() {
    return (new Promise(resolve => {

      if (this._rootSource &&
          !this._rootSource.IsBusy) {
            (async () => {
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
        _debug(`Build: Root source not valid or is busy`)
        resolve("");
      }
    }));
  }

  /* ========================================================================
     Description:    Finds duplicate file system objects.

     @return {Promise} - A promise that when resolved will provide a map/dictionary.
                         The key of the dictionary will be "common" message digest
                         and the value will be an array of strings containing
                         the sources sharing the digest. Unique items will _not_
                         be specified in the result.
                         {key: digest, value: source[]}
     ======================================================================== */
  FindDuplicates() {
    return (new Promise(resolve => {

      if (this._rootSource &&
          !this._rootSource.IsBusy) {
            (async () => {
              // Get the report from the root
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
                    throw new Error("Missing or wrong value !!")
                  }
                }
                else {
                  // This is a new item. So simply register this digest & source.
                  internalMap.set(item.digest, new Array(item.source));
                }
              }

              // Generate the map to be returned that contains only repeated items.
              const duplicatesMap = new Map();
              internalMap.forEach((value, key, map) => {
                if (value && Array.isArray(value) && (value.length > 1)) {
                  // Duplicate found.
                  duplicatesMap.set(key, value);
                }
              });

              resolve(duplicatesMap);
            })();
      }
      else {
        _debug(`Build: Root source not valid or is busy`)
        resolve("");
      }
    }));
  }

  /* ========================================================================
     Internal/Private helpers
     ======================================================================== */
  /* ========================================================================
     Description: Internal property accessor to write the algorithm to be used for hashing

     @param {string} [algorithm] - sent as a string, but assumed to be a HASH_ALGORITHMS
                                   value.

     @remarks - Defaults to HASH_ALGORITHMS.SHA256.
     ======================================================================== */
  set _Algorithm(algorithm) {

    // Set the algorithm as specified.
    if ( (algorithm != null) && (typeof(algorithm) === "string") ) {
      switch (algorithm) {
        case HASH_ALGORITHMS.MD5:
        case HASH_ALGORITHMS.SHA224:
        case HASH_ALGORITHMS.SHA256:
        case HASH_ALGORITHMS.SHA384:
        case HASH_ALGORITHMS.SHA512:
        {
          this._algorithm = algorithm;
        }
        break;

        default:
        {
          _debug(`Unknown algorithm '${algorithm}' specified. Use at your own risk.`);
          this._algorithm = algorithm;
        }
      }
    }
    else {
      // Use the default
      this._algorithm = HASH_ALGORITHMS.SHA256;
    }
  }

  /* ========================================================================
     Description: Internal helper to translate the File System Type for reporting.

     @param {FILE_SYSTEM_TYPES} [type] - File system type to translate

     @return {string} - string representing the file system type.

     @remarks - Defaults to HASH_ALGORITHMS.SHA256.
     ======================================================================== */
  _translateFSType(type) {

     let repFileType = "(Unknown)";
     switch (type) {
       case FILE_SYSTEM_TYPES.DIRECTORY:
       {
         repFileType = "(D)";
       }
       break;

       case FILE_SYSTEM_TYPES.FILE:
       {
         repFileType = "(F)";
       }
       break;

       case FILE_SYSTEM_TYPES.BATCH:
       {
         repFileType = "(B)";
       }
       break;

       case FILE_SYSTEM_TYPES.OTHER:
       {
         repFileType = "(O)";
       }
       break;

       case FILE_SYSTEM_TYPES.INVALID:
       {
         repFileType = "(I)";
       }
       break;

       default:
       {
         throw new FSTypeMismatch([FILE_SYSTEM_TYPES.DIRECTORY, FILE_SYSTEM_TYPES.FILE, FILE_SYSTEM_TYPES.BATCH], type, "main.js");
       }
       break;
     }

     return repFileType;
  }
}

/* ==========================================================================
   Class:              FSHasher
   Description:	       API Wrapper for the internal FSHasher class
   Copyright:          Mar 2020

   ========================================================================== */
export class FSHasher {
  /* ========================================================================
     Description: Constructor for an instance of FSHasher.

     @return {Object} - An instance of the FSHasher class
     ======================================================================== */
  constructor() {
    // Create an instance of FS Hasher and register it in the internal map.
    _internalFSHashObjs.set(this, new FSHasherInternal());
  }

  /* ========================================================================
     Description: Destructor for an instance of FSHasher.
     ======================================================================== */
  destroy() {
    // Remove ourself from the internal map.
    if (_internalFSHashObjs.has(this)) {
      _internalFSHashObjs.delete(this);
    }
  }

  /* ========================================================================
     Description: API Wrapper for the Version Property

     @return {string} - Product version.
     ======================================================================== */
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

  /* ========================================================================
     Description: API Wrapper for the IsBusy Property

     @return {boolean} - true if busy
     ======================================================================== */
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

  /* ========================================================================
     Description: API Wrapper for the Algorithm Property

     @return {HASH_ALGORITHMS} - Hashsing algorithm to be used.
     ======================================================================== */
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

  /* ========================================================================
     Description: API Wrapper for the Source Property

     @return {string | string[]} -  The file system path for the root source.
     ======================================================================== */
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

  /* ========================================================================
     Description:    API Wrapper for the Build Method

     @param {string | string[]} [source] - Path(s) for the file system object.

     @return {Promise} - A promise that when resolved will indicate if the
                         file system heirarchy was built or not.
                         true if built. false otherwise.
     ======================================================================== */
  Build(source) {
    // Get the registered object
    const fshasher = _internalFSHashObjs.get(this);

    // Ensure this object is registered.
    if (fshasher) {
      return fshasher.Build(source);
    }
    else {
      // Not retistered.
      throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
    }
  }

  /* ========================================================================
     Description:    API Wrapper for the Compute Method

     @param {string} - A string representing the hashing algorithm to use.

     @return {Promise} - A promise that when resolved will provide a string
                         representing the overall hash of the root source.
                          If the heirarchy has not been built or the root source is busy,
                         the promise will resolve to and empty string.
     ======================================================================== */
  Compute(algorithm) {
    // Get the registered object
    const fshasher = _internalFSHashObjs.get(this);

    // Ensure this object is registered.
    if (fshasher) {
      return fshasher.Compute(algorithm);
    }
    else {
      // Not retistered.
      throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
    }
  }

  /* ========================================================================
     Description:    API Wrapper for the Report Method

     @return {Promise} - A promise that when resolved will provide a string
                         containing a CSV delimited report. If the heirarchy has
                         not been built or the root source is busy,
                         the promise will resolve to an empty string.
                         CSV Format:
                         Field #1: Type   - '(D)'-Directory, '(F)'-File, '(B)'-Batch
                         Field #2: Source - Path of the File System object.
                                            Will be prepended with spaces corresponding
                                            to the depth of the result item.
                         Field #3: Digest - Message digest of the item.
                                            If it has not been computed,
                                            it will default to undefined.
     ======================================================================== */
  Report() {
    // Get the registered object
    const fshasher = _internalFSHashObjs.get(this);

    // Ensure this object is registered.
    if (fshasher) {
      return fshasher.Report();
    }
    else {
      // Not retistered.
      throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
    }
  }

  /* ========================================================================
     Description:    API Wrapper for the FindDuplicates Method

     @return {Promise} - A promise that when resolved will provide a map/dictionary.
                         The key of the dictionary will be "common" message digest
                         and the value will be an array of strings containing
                         the sources sharing the digest. Unique items will _not_
                         be specified in the result.
                         {key: digest, value: source[]}
     ======================================================================== */
  FindDuplicates() {
    // Get the registered object
    const fshasher = _internalFSHashObjs.get(this);

    // Ensure this object is registered.
    if (fshasher) {
      return fshasher.FindDuplicates();
    }
    else {
      // Not retistered.
      throw new ReferenceError(`This instance of 'FSHasher' is no longer registered.`);
    }
  }
}
