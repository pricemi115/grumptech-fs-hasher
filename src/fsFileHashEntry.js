/* ==========================================================================
   File:               fsFileHashEntry.js
   Description:	       Module handling directory file system hashing results.
   Copyright:          Mar 2020
   ========================================================================== */
'use strict';

// External dependencies and imports.
// eslint-disable-next-line no-unused-vars
const _debug = require('debug')('fs-hasher_hashFile');

// Internal dependencies
import { FSTypeMismatch }                                 from './fsHashErrors.js';
import { FileSystemHashEntryBase, FILE_SYSTEM_TYPES }     from './fsHashEntryBase.js';
import { HashRequest, FileHasherSerializer}               from './hashHelper.js';

/* ==========================================================================
   Class:              FileHashEntry
   Description:	       Handles hashing of files.
   Copyright:          Mar 2020
   ========================================================================== */
export class FileHashEntry extends FileSystemHashEntryBase {
  /* ========================================================================
     Description: Constructor for an instance of a hash entry.

     @return {object} - An instance of the FileHashEntry class
     ======================================================================== */
    constructor() {

    // Initialize the base class.
    super();

  }

  /* ========================================================================
     Description: Read-OnlyProperty accessor to read the file system type
                  for this item.

     @return {FILE_SYSTEM_TYPES} - Always FILE_SYSTEM_TYPES.FILE
     ======================================================================== */
  get Type() {
    return ( FILE_SYSTEM_TYPES.FILE );
  }

  /* ========================================================================
     Description:   Build a heirarchy of file system entries based upon the
                    source

     @param {string | string[]} [source] - Path for the file system object.
     @param {number}            [depth]  - Depth of this object in the tree.

     @return {Promise} - A promise that when resolved will indicate if the
                         file system heirarchy was built or not.
                         true if built. false otherwise.

     @throws {FSTypeMismatch} - File System Type Mismatch.
     ======================================================================== */
  Build(source, depth) {
    return (new Promise(resolve => {

      (async (src, dep) => {
        // Validte that source is actually a direcotry !!
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
          throw(error);
        }
      })(source, depth);
    }));
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
      (async() => {
        const reportResult = await super.Report();

        // Clear busy & pass along the result
        this._Busy = false;
        resolve(reportResult);
      })();
    }));
  }

  /* ========================================================================
     Description:    Computes hashing results for this file. Also, optionally,
                     updates the hash of the directory containing this file.

     @param {string} [algorithm]          - Hashing algorithm to use.
                                            Defaults to 'sha256'.

     @return {Promise} - A promise that when resolved will provide the source and
                         digest of this item as an object
                         {source, digest}, where both source and digest are strings.
     ======================================================================== */
  Compute(algorithm = 'sha256') {

    // Validate arguments.
    if ((!algorithm) || (typeof(algorithm) !== 'string')) {
      throw new FSTypeMismatch('string', typeof(algorithm), 'fsFileHashEntry.js');
    }

    return (new Promise(resolve => {

      if (this.Source && (typeof(this.Source) === "string") && (this.Source.length > 0) &&
          !this.IsBusy) {
        this._Busy = true;
        this._Digest = undefined;

        (async (alg) => {
          // Create a hash request
          const request = new HashRequest({source:this.Source, algorithm:alg});
          // Register for events of interest
          request.once('hash_complete', (result) => {
            // Clear busy.
            this._Busy = false;
            // Set the digest
            this._Digest = result.digest;
            // Report
            resolve({source:this.Source, digest:this.Digest});
          });

          // Submit the hash request to the serializer.
          FileHasherSerializer.SubmitHashRequest(request);
        })(algorithm);
      }
      else {
        // Report
        resolve({source:this.Source, digest:undefined});
      }
    }));
  }

  /* ========================================================================
     Internal/Private helpers
     ======================================================================== */
}
