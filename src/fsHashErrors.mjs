/**
 * @description Module for all FS Hasher errors.
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSHashErrorsModule
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import _debugModule from 'debug';
import _is from 'is-it-check';

/**
 * @private
 * @description Debugging function pointer for runtime related diagnostics.
 */
// eslint-disable-next-line no-unused-vars
const _debug = _debugModule('fs-hasher_errors');

/**
 * @description Reports errors relating to file system type mismatches.
 * @augments TypeError
 */
export class FSTypeMismatch extends TypeError {
    /**
     * @description Constructor
     * @param {number | number[]} expectedType - The File System Type enumerated value(s) that was expected.
     * @param {number} observedType - The File System Type enumerated value that was observed.
     * @param {string} [filename] - The name of the file raising the error.
     */
    constructor(expectedType, observedType, filename) {
        // Initialize the base class.
        super(`File System Type Mismatch. Expected:${expectedType} Observed:${observedType}`, filename);

        // Set the members.
        this._expectedType = expectedType;
        this._observedType = observedType;
    }

    /**
     * @description Read-Only Property for the expected File System Type
     * @returns {number} - Enumerated value of the expected File System Type
     */
    get ExpectedType() {
        return ( this._expectedType );
    }

    /**
     * @description Read-Only Property for the observed File System Type
     * @returns {number} - Enumerated value of the observed File System Type
     */
    get ObservedType() {
        return ( this._observedType );
    }
}

/**
 * @description Reports errors relating to instantiation of an abstract (non-instancable) class or invocation an abstract function.
 * @augments TypeError
 */
export class FSAbstract extends TypeError {
    /**
     * @description Constructor
     * @param {string} [name="Not Specified"] -  The name of the class being instanciated or function being invoked.
     */
    constructor(name = 'Not Specified') {
        // Initialize the base class.
        super(`Attempting to instanciate an abstract class or call an abstract function: '${name}'`);

        // Set the members.
        this._name = name;
    }

    /**
     * @description Read-Only Property for the name of the abstract class or function
     * @returns {string} - Name of the class being instanciated or function being invoked.
     */
    get Name() {
        return ( this._name );
    }
}

/**
 * @description Reports errors relating to instantiation of a non-creatable class.
 * @augments TypeError
 */
export class FSNotCreatable extends TypeError {
    /**
     * @description Constructor
     * @param {string} [name="Not Specified"] -  The name of the class being instanciated.
     */
    constructor(name = 'Not Specified') {
        // Initialize the base class.
        super(`Attempting to instanciate an non-creatable class: '${name}'`);

        // Set the members.
        this._name = name;
    }

    /**
     * @description Read-Only Property for the name of the non-creatable class
     * @returns {string} - Name of the class being instanciated.
     */
    get Name() {
        return ( this._name );
    }
}

/**
 * @description Reports errors when attempting to generate a hash.
 * @augments TypeError
 */
export class FSHashError extends TypeError {
    /**
     * @description Constructor
     * @param {string} [source=null] - The name of the source being hashed.
     * @param {string} [algorithm=null] - The algorithm used for hashing.
     * @param {string} [errDetail=null] - Error detail.
     * @param {string} [filename=null] - File generating the error.
     */
    constructor(source=null, algorithm=null, errDetail=null, filename=null) {
        // Initialize the base class.
        let msg = `Error encountered when computing the hash.`;

        // Append source.
        if (_is.string(source)) {
            msg = msg.concat(` Source:'${source}'`);
        }
        // Append algorithm.
        if (_is.string(algorithm)) {
            msg = msg.concat(` Algorithm:'${algorithm}'`);
        }
        // Append error detail.
        if (_is.string(errDetail)) {
        // Append source.
            msg = msg.concat(` Error Detail:'${errDetail}'`);
        }
        super(msg, filename);

        // Set the members.
        this._source      = source;
        this._algorithm   = algorithm;
        this._err_detail  = errDetail;
        this._filename    = filename;
    }

    /**
     * @description Read-Only Property for the source.
     * @returns {string} - source used when hashing error was encountered.
     */
    get Source() {
        return ( this._source );
    }

    /**
     * @description Read-Only Property for the algorithm.
     * @returns {string} - algorithm used when hashing error was encountered.
     */
    get Algorithm() {
        return ( this._algorithm );
    }

    /**
     * @description Read-Only Property for the error detail.
     * @returns {string} - specific detailed error when hashing error was encountered.
     */
    get ErrorDetail() {
        return ( this._err_detail );
    }

    /**
     * @description Read-Only Property for the filename.
     * @returns {string} - name of the file when raising this error.
     */
    get Filename() {
        return ( this._filename );
    }
}
