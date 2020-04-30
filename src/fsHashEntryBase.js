/* ==========================================================================
   File:               fsHashEntryBase.js
   Description:	       Module serving as the base class for file system
                       hashing results.
   Copyright:          Mar 2020
   ========================================================================== */
'use strict';

// External dependencies and imports.
const _debug = require('debug')('fs-hasher_hashBase');
import * as modFileSystem                  from 'fs';
import { promises as _fileSystemPromises } from 'fs';

// Internal dependencies
import { FSAbstract } from './fsHashErrors.js';

/* Enumeration for hashing algorithms */
export const FILE_SYSTEM_TYPES = {
  INVALID   : 0,
  FILE      : 1,
  DIRECTORY : 2,
  BATCH     : 3,
  OTHER     : 4,
};

/* ==========================================================================
   Class:              FileSystemHashEntryBase
   Description:	       Serves as the base class for file system entries to compure
                       file system hash results. This base class also serves
                       when the file system object is a readable file.
   Copyright:          Mar 2020

   ========================================================================== */
export class FileSystemHashEntryBase {
  /* ========================================================================
     Description: Constructor for an instance of a hash entry.

     @return {object} - An instance of the class

     @throws {FSAbstract} - thrown when attempting to create the
                            non-instancable/abstract class.
     ======================================================================== */
  constructor() {

    // Ensure we are not attempting to instanciate the base class.
    if (this.constructor === FileSystemHashEntryBase)
    {
      // Prevent creation of the base object.
      const error = new FSAbstract("FileSystemHashEntryBase");
      throw(error);
    }

    // Initialize members
    this._source  = undefined;
    this._digest  = undefined;
    this._depth   = 0;
    this._busy    = false;
  }

  /* ========================================================================
     Description: Read-Only Property for determining if this FileSystemHashEntry
                  object is busy.

     @return {boolean} - true if busy
     ======================================================================== */
  get IsBusy() {
    return ( this._busy );
  }

  /* ========================================================================
     Description: Read-Only Property indicating the heirarchy depth for This
                  entry.

     @return {number} - heirarchy depth, where 0 indicates the root.
     ======================================================================== */
  get Depth() {
    return ( this._depth );
  }

  /* ========================================================================
     Description: Read-OnlyProperty accessor to read the file system source
                  for this item.

     @return {string} - The file system path for the source.
     ======================================================================== */
  get Source() {
    return ( this._source );
  }

  /* ========================================================================
     Description: Read-Only property accessor to read the digest
                  for this item.

     @return {string | undefined} - The hash digest for this item.
     ======================================================================== */
  get Digest() {
    return ( this._digest );
  }

  /* ========================================================================
     Description: Read-OnlyProperty accessor to read the file system type
                  for this item.

     @return {FILE_SYSTEM_TYPES} - The file system type for this item.

     @throws {FSAbstract} - Always thrown if invoked on the base class!

     @remarks - Abstract property.
     ======================================================================== */
  get Type() {
    // Abstract function.
    const error = new FSAbstract("FileSystemHashEntryBase::Type");
    throw(error);
  }

  /* ========================================================================
     Description: Build a heirarchy of file system entries based upon the
                  source

     @param {string | string[]} [source] - Path for the file system object.
     @param {number}            [depth]  - Depth of this object in the tree.

     @return {Promise} - A promise that when resolved from the base class will
                         indicate the File System Type of the source specified.

     @throws RangeError - If the depth is negative or not an integer.
     @throws TypeError  - If the depth not a number. Specifically an integer.

     @remarks - If this object is busy, will resolve to an Invalid File Syste Type.
     ======================================================================== */
  Build(source, depth) {
    if ((!typeof(depth) ==='number') || (!Number.isInteger(depth))) {
      throw new TypeError(`Depth must be an integer`);
    }
    if (depth < 0) {
      throw new RangeError(`Hash entry depth must be a positive integer. Depth:${depth}`);
    }

    return (new Promise(resolve => {

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

  /* ========================================================================
     Description:    Computes digest for this file. Also, optionally,
                     updates the digest of the directory containing this file.

     @param {string} [algorithm] - Hashing algorithm to use.
     @param {<Hash>} [parentHash]- Hash object provided by the parent.

     @return {Promise} - A promise that when resolved will provide the digests
                         of this item and the parent as an object
                         {digest, parentDigest}.
                         If the parentHash object is not provided, it will resolve
                         as null.
                         If the file could not be hashed, then this will
                         resolve with null.

     @throws {FSAbstract} - Always thrown if invoked on the base class!

     @remarks - Abstract method.
     ======================================================================== */
  Compute(algorithm, parentHash)
  {
    // Abstract function.
    const error = new FSAbstract("FileSystemHashEntryBase::Compute");
    throw(error);
  }

  /* ========================================================================
     Description:    Report of the file system heirarchy with the results
                     of the hashing.

     @return {Promise} - A promise that when resolved will provide an object
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
     ======================================================================== */
  Report() {
    return (new Promise(resolve => {

      if (this.Source && (typeof(this.Source) === "string") && (this.Source.length > 0) &&
          !this.IsBusy) {
            this._busy = true;

            const report = {type:this.Type, source:this.Source, depth:this.Depth, digest:this.Digest};
            resolve(report);
      }
      else {
        resolve(null);
      }
    }));
  }

  /* ========================================================================
     Internal/Private helpers
     ======================================================================== */

  /* ========================================================================
     Description: INTERNAL Property accessor to write the busy status.

     @param {number} [busy] - Flag indicating if this file system hash entry
                              object is busy.

    @remarks: This accessor is intended to only be used internally during the
              build, compute, and report processes.
    ======================================================================== */
  set _Busy(busy) {
    this._busy = busy;
  }

  /* ========================================================================
     Description: INTERNAL Property accessor to write the digest.

     @param {string | falsy} [digest] - Digest of the item.

    @remarks: This accessor is intended to only be used internally during the
              compute process.
    ======================================================================== */
  set _Digest(digest) {
    if (digest && typeof(digest) !== 'string') {
      throw new FSTypeMismatch(['string', 'falsy'], typeof(digest), "fsHashEntryBase.js");
    }

    this._digest = digest;
  }

  /* ========================================================================
     Description: Helper to determine the file system type ot the specified string.

     @param {string} [source] - Path of the source to be evaluated for accessibility
                                and file type.
                                Assumed to be a valid file System object,
                                either a Fiile or Directory.

     @return {Promise} - A promise that when resolved will indicate the File Type of the
                         source {INVALID, FILE, DIRECTORY, OTHER}
    ======================================================================== */
  static _getFileSystemType(source) {

     return (new Promise(resolve => {
       if ( source != null ) {
         if (typeof(source) === "string") {
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
             catch (err)
             {
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
