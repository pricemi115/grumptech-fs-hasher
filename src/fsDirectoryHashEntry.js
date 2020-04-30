/* ==========================================================================
   File:               fsDirectoryHashEntry.js
   Description:	       Module handling directory file system hashing results.
   Copyright:          Mar 2020
   ========================================================================== */
'use strict';

// External dependencies and imports.
const _debug = require('debug')('fs-hasher_hashDir');
import * as modPath                       from 'path';
import { promises as _filesystemPromise } from 'fs';
import * as modCrypto                     from 'crypto';

// Internal dependencies
import { FSTypeMismatch, FSHashError }                from './fsHashErrors.js';
import { FileSystemHashEntryBase, FILE_SYSTEM_TYPES } from './fsHashEntryBase.js';
import { FileHashEntry }                              from './fsFileHashEntry.js';

/* ==========================================================================
   Class:              DirectoryHashEntry
   Description:	       Handles hashing of directories.
   Copyright:          Mar 2020

   ========================================================================== */
export class DirectoryHashEntry extends FileSystemHashEntryBase {
  /* ========================================================================
     Description: Constructor for an instance of a hash entry.

     @return {object} - An instance of the DirectoryHashEntry class
     ======================================================================== */
  constructor() {

    // Initialize the base class.
    super();

    // Initialize members
    this._childItems  = [];

  }

  /* ========================================================================
     Description: Read-Only Property for determining if this Directory file
                  system object is busy.

     @return {boolean} - true if busy
     ======================================================================== */
  get IsBusy() {
    let busy = super.IsBusy;

    // Iterate over the children. If any are busy, we are busy.
    for (const indexChild in this._childItems) {
      busy = busy || this._childItems[indexChild].IsBusy;
    }

    return ( busy );
  }

  /* ========================================================================
     Description: Read-OnlyProperty accessor to read the file system type
                  for this item.

     @return {FILE_SYSTEM_TYPES} - Always FILE_SYSTEM_TYPES.DIRECTORY
     ======================================================================== */
  get Type() {
    return ( FILE_SYSTEM_TYPES.DIRECTORY );
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
    // If this is being invoked from an extended class, defer to our parent.
    if (this.Type !== FILE_SYSTEM_TYPES.DIRECTORY) {
      // defer
      return super.Build(source, depth);
    }
    else {
      return (new Promise(resolve => {

        // Initialize data members
        this._childItems  = [];

        (async (src, dep) => {
          // Validte that source is actually a direcotry !!
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
                    case FILE_SYSTEM_TYPES.BATCH:
                    // Break intentionally missing
                    case FILE_SYSTEM_TYPES.INVALID:
                    // Break intentionally missing
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
            catch(err) {
               super._Busy = false;
              resolve(false);
            }
          }
          else {
            // Mismatch between the expected and observed file types.
            const error = new FSTypeMismatch(FILE_SYSTEM_TYPES.DIRECTORY, fsType, 'fsDirectoryHashEntry.js');
            throw(error);
          }
        })(source, depth);
      }));
    }
  }

  /* ========================================================================
     Description:    Computes hashing results for this file. Also, optionally,
                     updates the hash of the directory containing this file.

     @param {string}   [algorithm]        - Hashing algorithm to use.
                                            Defaults to 'sha256'.

     @return {Promise} - A promise that when resolved will provide the source and
                         digest of this item as an object
                         {source, digest}, where both source and digest are strings
     ======================================================================== */
  Compute(algorithm = 'sha256') {

    // Validate arguments.
    if ((!algorithm) || (typeof(algorithm) !== 'string')) {
      throw new FSTypeMismatch('string', typeof(algorithm), 'fsDirectoryHashEntry.js DirectoryHashEntry::Compute');
    }

    return (new Promise(resolve => {

      if (this.Source && (typeof(this.Source) === "string") && (this.Source.length > 0) &&
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
              const thePromise = child.Compute(alg);
              childComputePromises.push(thePromise);
            }

            // Wait for the computations to complete
            const results = await Promise.all(childComputePromises);

            // Compute my hash.
            // -----------------------------------------
            // Create the worker hash.
            const myHash = modCrypto.createHash(alg);
            // Default to undefined in case we have no children.
            this._Digest = undefined;
            for (const result of results) {
              // Update my working hash
              if (result.digest) {
                myHash.update(result.digest);
              }
              // if this is the first result, then just copy the hash digest to mine.
              if (!this.Digest) {
                this._Digest = result.digest;
              }
              // Otherwise, set my digest to the running digest.
              else if (result.digest) {
                this._Digest = myHash.copy().digest('hex').toUpperCase();
              }
            }

            // Clear busy.
            this._Busy = false;

            resolve({source:this.Source, digest:this.Digest});
          }
          catch(err) {
            this._Busy = false;
            resolve({source:this.Source, digest:null});
            throw new FSHashError(this.Source, alg, err.toString(), 'fsDirectoryHashEntry.js DirectoryHashEntry::Compute');
          }
        })(algorithm);
      }
      else {
        resolve({source:this.Source, digest:null});
      }
    }));
  }

  /* ========================================================================
     Description:    Build a report of the file system heirarchy with the results
                     of the hashing.

     @return {Promise} - A promise that when resolved will provide an array of
                         objects of the form:
                         [ {
                            type   {string} - '(D)'-Directory or ''(F)'-File
                            source {string} - Path of the File System object.
                            depth  {number} - Depth of the item in the heirarchy.
                            digest {string} - Hash digest of the item. If has not
                                              been computed, will default to undefined.
                           } ]
                         If the heirarchy has not been built or the source is busy
                         will resolve to null.
     ======================================================================== */
  Report() {
    return (new Promise(resolve => {
      (async() => {
        let reportResults = [];
        // Start with the report for this item.
        const myReport = await super.Report();
        reportResults.push(myReport);

        // Did this object's Report resolve properly?
        if (myReport) {
          const childReportPromises = [];
          // Note: Use the sorted list to ensure the proper traversal of the tree.
          const children = this._Children;
          // Create a 'combined' list of the children, where the directories lead the files.
          const allChildren = children.directories.concat(children.files);
          // Order matters, use 'for..of'
          for (const child of allChildren) {
            // Make a source for the candidate child object.
            const thePromise = await child.Report();
            childReportPromises.push(thePromise);
          }

          // Wait for the computations to complete
          const results = await Promise.all(childReportPromises);

          for (const report of results) {
            if (report) {
              if (Array.isArray(report)) {
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
  /* ========================================================================
     Description: Internal helper to provide a sorted list of child objects.
                  It is *desirable*, especially for the computation of directory
                  hashes, that the children be sorted such that sub-directories
                  come before files.

     @return {object} - Object containing sorted arrays of Directories and Files.
                        {.directories: Array, .files: Array}

    @throws {FSTypeMismatch} - Thrown when unchandled child is encountered.
    ======================================================================== */
  get _Children() {
    const dirChildren  = [];
    const fileChildren = [];

    for (const childItem in this._childItems) {
      if (this._childItems[childItem] &&
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
              case FILE_SYSTEM_TYPES.OTHER:
              // break intentionally missing
              default:
              {
                // Not a valid child.
                throw new FSTypeMismatch([FILE_SYSTEM_TYPES.DIRECTORY, FILE_SYSTEM_TYPES.FILE], FILE_SYSTEM_TYPES.INVALID, "fsDirectoryHashEntry.js");
              }
              break;
            }
      }
      else {
        throw new FSTypeMismatch([FILE_SYSTEM_TYPES.DIRECTORY, FILE_SYSTEM_TYPES.FILE], FILE_SYSTEM_TYPES.INVALID, "fsDirectoryHashEntry.js");
      }
    }

    // For consistent results. Sort the children alpha-numerically.
    dirChildren.sort();
    fileChildren.sort();

    // Return the sorted arrays.
    return ({directories:dirChildren, files:fileChildren});
  }
}
