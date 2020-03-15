/* ==========================================================================
   File:               fsHashErrors.js
   Description:	       Module for all FS Hasher errors.
   Copyright:          Mar 2020
   ========================================================================== */
'use strict';


// External dependencies and imports.
const _debug = require('debug')('fs-hasher_errors');

/* ==========================================================================
   Class:              FSTypeMismatch
   Description:	       Object to use that reports errors relating to file
                       system type mismatches.
   Copyright:          Mar 2020

   ========================================================================== */
export class FSTypeMismatch extends TypeError {
  /* ========================================================================
     Description: Constructor for an instance of a FSTypeMismatch error.

     @param {number or Array} [expectedType or Array of expected types] - The File System Type enumerated value(s) that was expected.
     @param {number} [observedType] - The File System Type enumerated value that was observed.
     @param {string} [filename]     - (Optional) The name of the file raising the error.

     @return {object} - An instance of the FSTypeMismatch class
     ======================================================================== */
  constructor(expectedType, observedType, filename) {

    // Initialize the base class.
    super(`File System Type Mismatch. Expected:${expectedType} Observed:${observedType}`,
          filename);

    // Set the members.
    this._expectedType = expectedType;
    this._observedType = observedType;
  }

  /* ========================================================================
     Description: Read-Only Property for the expected File System Type

     @return {number} - Enumerated value of the expected File System Type
     ======================================================================== */
  get ExpectedType() {
    return ( this._expectedType );
  }

  /* ========================================================================
     Description: Read-Only Property for the observed File System Type

     @return {number} - Enumerated value of the observed File System Type
     ======================================================================== */
  get ObservedType() {
    return ( this._observedType );
  }
}

/* ==========================================================================
   Class:              FSAbstract
   Description:	       Error when attempting to instanciate an abstract
                       (non-instancable) class or invoke an abstract function.
   Copyright:          Mar 2020

   ========================================================================== */
export class FSAbstract extends TypeError {
  /* ========================================================================
     Description: Constructor for an instance of a FSAbstract error.

     @param {string} [name] - (Optional) The name of the class being instanciated
                                         or function being called.

     @return {object} - An instance of the FSAbstract class
     ======================================================================== */
  constructor(name = "Not Specified") {
    // Initialize the base class.
    super(`Attempting to instanciate an abstract class or call an abstract function: '${name}'`);

    // Set the members.
    this._name = name;
  }

  /* ========================================================================
     Description: Read-Only Property for the name of the abstract class or function

     @return {string} - name of the class being instanciated or function being invoked.
     ======================================================================== */
  get Name() {
    return ( this._name );
  }
}

/* ==========================================================================
   Class:              FSNotCreatable
   Description:	       Error when attempting to instanciate a non-creatable class.
   Copyright:          Mar 2020

   ========================================================================== */
export class FSNotCreatable extends TypeError {
  /* ========================================================================
     Description: Constructor for an instance of a FSAbstract error.

     @param {string} [name] - (Optional) The name of the class being instanciated
                                         or function being called.
                              Default: "Not Specified"

     @return {object} - An instance of the FSNotCreatable class
     ======================================================================== */
  constructor(name = "Not Specified") {
    // Initialize the base class.
    super(`Attempting to instanciate an non-creatable class: '${name}'`);

    // Set the members.
    this._name = name;
  }

  /* ========================================================================
     Description: Read-Only Property for the name of the abstract class or function

     @return {string} - name of the class being instanciated or function being invoked.
     ======================================================================== */
  get Name() {
    return ( this._name );
  }
}

/* ==========================================================================
   Class:              FSHashError
   Description:	       Error when attempting to generate a hash
   Copyright:          Mar 2020

   ========================================================================== */
export class FSHashError extends TypeError {
  /* ========================================================================
     Description: Constructor for an instance of a hash entry.

     @param {string} [source]     - (Optional) The name of the source being hashed.
     @param {string} [algotithm]  - (Optional) The algorithm used for hashing.
     @param {string} [err_detail] - (Optional) Error detail.
     @param {string} [filename]   - (Optional) File generating the error.

     @return {object} - An instance of the FSHashError class
     ======================================================================== */
  constructor(source=null, algorithm=null, err_detail=null, filename=null) {
    // Initialize the base class.
    let msg = `Error encountered when computing the hash.`;

    // Append source.
    if ((source) && (typeof(source) === 'string') ) {
      msg = msg.concat(` Source:'${source}'`);
    }
    // Append algorithm.
    if ((algorithm) && (typeof(algorithm) === 'string') ) {
      msg = msg.concat(` Algorithm:'${algorithm}'`);
    }
    // Append error detail.
    if ((err_detail) && (typeof(err_detail) === 'string') ) {
      // Append source.
      msg = msg.concat(` Error Detail:'${err_detail}'`);
    }
    super(msg, filename);

    // Set the members.
    this._source      = source;
    this._algorithm   = algorithm;
    this._err_detail  = err_detail;
    this._filename    = filename;
  }

  /* ========================================================================
     Description: Read-Only Property for the source.

     @return {string} - source used when hashing error was encountered.
     ======================================================================== */
  get Source() {
    return ( this._source );
  }

  /* ========================================================================
     Description: Read-Only Property for the algorithm.

     @return {string} - algorithm used when hashing error was encountered.
     ======================================================================== */
  get Algorithm() {
    return ( this._algorithm );
  }

  /* ========================================================================
     Description: Read-Only Property for the error detail.

     @return {string} - specific detailed error when hashing error was encountered.
     ======================================================================== */
  get ErrorDetail() {
    return ( this._err_detail );
  }

  /* ========================================================================
     Description: Read-Only Property for the filename.

     @return {string} - name of the file when raising this error.
     ======================================================================== */
  get ErrorDetail() {
    return ( this._filename );
  }
}
