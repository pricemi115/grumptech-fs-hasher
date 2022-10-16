/**
 * @description Module responsible for performing hashing of files.
 * @copyright 2020-2022
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module FSHashHelper
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires fs
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#file-system}
 * @requires crypto
 * @see {@link hhttps://nodejs.org/dist/latest-v16.x/docs/api/crypto.html#crypto}
 * @requires EventEmitter
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/events.html#class-eventemitter}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import _debugModule from 'debug';
import {EventEmitter}   from 'events';
import * as modFileSystem from 'fs';
import * as modCrypto     from 'crypto';

// Internal dependencies
import {FSNotCreatable} from './fsHashErrors.mjs';

/**
 * @description Debugging function pointer for runtime related diagnostics.
 */
const _debug = _debugModule('fs-hasher_hashHelper');

/**
 * @description Enumeration of status codes for hashing operations.
 * @private
 * @readonly
 * @enum {number}
 * @property {number} STATUS_OK- Status Ok
 * @property {number} STATUS_ERR_INVALID_ALGORITHM - Error: Invalid algorithm
 * @property {number} STATUS_ERR_ACCESS_DENIED - Error: Cannot access file system item
 * @property {number} STATUS_TOO_MANY_FILES_OPEN - Error: Too many files open
 * @property {number} STATUS_ERR_OTHER - Error: Unknown
 */
export const HASH_STATUS = {
    /* eslint-disable key-spacing */
    STATUS_OK                     : 0,
    STATUS_ERR_INVALID_ALGORITHM  : 1,
    STATUS_ERR_ACCESS_DENIED      : 2,
    STATUS_TOO_MANY_FILES_OPEN    : 3,
    STATUS_ERR_OTHER              : 4,
    /* eslint-enable key-spacing */
};

/**
 * @description Delay time, in milliseconds, used for queuing processing hash requests
 * @private
 */
const _FILE_HASH_PROCESSING_DELAY = 10/* milliseconds */;

/* eslint-disable jsdoc/valid-types */
/**
 * @description Enumeration of published events.
 * @readonly
 * @enum {string}
 */
export const HASH_HELPER_EVENTS = {
    /* eslint-disable key-spacing */
    /** @member {string} - Identification for the event published when the request is dequeued. */
    EVENT_DEQUEUED : 'hash_deququed',
    /** @member {string} - Identification for the event published when the request is pending. */
    EVENT_PENDING  : 'hash_pending',
    /** @member {string} - Identification for the event published when the request is complete. */
    EVENT_COMPLETE  : 'hash_complete',
    /** @member {string} - Identification for the event published when the rthere are no more requests to process. */
    EVENT_SELF_DESTRUCT : 'self-destruct',
    /* eslint-enable key-spacing */
};
/* eslint-enable jsdoc/valid-types */

/* eslint-disable jsdoc/valid-types */
/**
 * @description Enumeration of published events for the internal hash worker.
 * @readonly
 * @enum {string}
 */
export const HASH_HELPER_INTERNAL_EVENTS = {
    /* eslint-disable key-spacing */
    /** @member {string} - Identification for the event published when the internal request is complete */
    EVENT_DONE : 'done',
    /* eslint-enable key-spacing */
};
/* eslint-enable jsdoc/valid-types */

/**
 * @description Hash request dequeued notification
 * @event module:FSHashHelper#event:dequeued
 * @type {number} dequeCount - number of times the request has been dequeued.
 */
/**
 * @description Hash request pending notification
 * @event module:FSHashHelper#event:pending
 */
/**
 * @description Hash request dequeued notification
 * @event module:FSHashHelper#event:complete
 * @type {object}
 * @param {number} e.status_code - code indicating request error status. 0 inficates success.
 * @param {string} e.digest - String representing the message digest
 */
/**
 * @description Allows clients to submit requests to hash a file.
 * @augments EventEmitter
 * @fires module:FSHashHelper#event:dequeued
 * @fires module:FSHashHelper#event:pending
 * @fires module:FSHashHelper#event:complete
 * @private
 */
export class HashRequest extends EventEmitter {
    /**
     * @description Constructor
     * @param {object} args - Arguments to create the request
     * @param {string} args.source - Path of the source file to be hashed.
     * @param {string} args.algorithm - Hashing algorithm to use.
     * @throws {TypeError} - Error thrown when the arguments to not conform to requirements
     * @throws {RangeError} - Error thrown when the arguments to not conform to requirements
     */
    constructor(args) {
        // General arguments validation.
        if ((args === undefined) || (typeof(args) !== 'object')) {
        // Error.
            throw new TypeError(`Hash request requires an 'args' parameter that is an object.`);
        }
        // Source validation.
        if ((args.source === undefined) ||
            (typeof(args.source) !== 'string') ||
            (args.source.length <= 0)) {
            throw new RangeError(`args.source must be a non-zero length string.`);
        }
        // Algorithm validation.
        if ((args.algorithm === undefined) ||
            (typeof(args.algorithm) !== 'string') ||
            (args.algorithm <= 0)) {
            throw new RangeError(`args.algorithm must be a non-zero length string.`);
        }

        // Initialize the base class.
        super();

        // Initialize members.
        this._source    = args.source;
        this._algorithm = args.algorithm;
        this._pending   = false;

        this._dequeueCount = 0;
    }

    /**
     * @description Read-Only Property accessor to read the pending flag for this item.
     * @returns {boolean} - true if processing of this item is pending.
     */
    get IsPending() {
        return ( this._pending );
    }

    /**
     * @description Read-Only Property accessor to read the source for this item.
     * @returns {string} - The file system path for the source.
     */
    get Source() {
        return ( this._source );
    }

    /**
     * @description Read-Only Property accessor to read the algorithm to be used for hashing.
     * @returns {string} - Hashsing algorithm to be used.
     */
    get Algorithm() {
        return ( this._algorithm );
    }
}

/**
 * @description Hash request dequeued notification
 * @event module:FSHashHelper#event:done
 * @type {InternalHashWorker} item - Reference to the object raising the event.
 */
/**
 * @description Object to be used by the singleton hash serializer for managing the hashing of a specific request.
 * @fires module:FSHashHelper#event:done
 * @private
 */
class InternalHashWorker extends EventEmitter {
    /**
     * @description - Constructor
     * @param {object} args - Arguments to create the request
     * @param {HashRequest} args.request - Request object
     * @throws {TypeError} - Error thrown when the arguments to not conform to requirements
     */
    constructor(args) {
        if ((args === undefined) || (typeof(args) != 'object') || !(args.request instanceof HashRequest)) {
            throw new TypeError(`Internal hash worker requires an 'args' parameter that is a HashRequest.`);
        }

        super();

        // Cache the request for notification back to the original caller.
        // and mark the request as "pending"
        this._request           = args.request;
        this._request._pending  = false;
        // Create and initialize a new crypto object used for hashing.
        // Note: if the algorithm is unsupported this will result in throwing an exception.
        this._myHash            = null;
        // Initialze our stream reader.
        this._myStreamReader    = null;

        // Stream Event Callbacks
        this._streamClosedCB  = this._streamClosed.bind(this);
        this._streamDataCB    = this._streamData.bind(this);
        this._streamEndCB     = this._streamEnd.bind(this);
        this._streamErrorCB   = this._streamError.bind(this);
    }

    /**
     * @description Destructor. Used to unregister for stream notifications and release references.
     * @returns {void}
     */
    destroy() {
        // Unregister for notifications.
        if (this._myStreamReader) {
            this._myStreamReader.off('data',    this._streamDataCB);
            this._myStreamReader.off('close',   this._streamClosedCB);
            this._myStreamReader.off('end',     this._streamEndCB);
            this._myStreamReader.off('error',   this._streamErrorCB);

            this._myStreamReader = null;
        }

        this._myHash = null;
        this._request = null;
    }

    /**
     * @description Prepares a hash worker for hashing. Specifically,
     *              (1) ensuring that the request 'Algorithm' is a valid hashing
     *                  algorithm.
     *              (2) that a streamReader is able to be opened for the source.
     *                  If there are insufficient resources for opening the stream,
     *                  the processing the request will be deferred until resources
     *                  free up.
     * @returns {Promise} - A promise that when resolved will provide the hash status HASH_STATUS.
     */
    Prepare() {
        return (new Promise((resolve) => {
            (async () => {
                try {
                    // Create and initialize a new crypto object used for hashing.
                    // Note: if the algorithm is unsupported this will result in throwing an exception.
                    this._myHash = modCrypto.createHash(this._request.Algorithm);
                }
                catch (err) {
                    // Non recoverable error encountered.
                    resolve(HASH_STATUS.STATUS_ERR_INVALID_ALGORITHM);
                }
                finally {
                    if (this._myHash) {
                        try {
                            // Use the default options when falling readFile().
                            // Will use encoding=null & flag='r'
                            this._myStreamReader = modFileSystem.createReadStream(this._request.Source, {encoding: null, flag: 'r', emitClose: true});
                            // eslint-disable-next-line no-unused-vars
                            this._myStreamReader.once('open', (_fd) => {
                                // Able to open the stream.
                                resolve(HASH_STATUS.STATUS_OK);
                            });
                            this._myStreamReader.once('error', (err) => {
                                let status = HASH_STATUS.STATUS_ERR_OTHER;
                                if (Object.prototype.hasOwnProperty.call(err, 'code')) {
                                    if (err.code === 'EMFILE') {
                                        // This is a recoverable error, once resorces free up
                                        status = HASH_STATUS.STATUS_TOO_MANY_FILES_OPEN;
                                    }
                                    else if (err.code === 'EACCES') {
                                        // This is a non-recoverable error.
                                        status = HASH_STATUS.STATUS_ERR_ACCESS_DENIED;
                                    }
                                }
                                resolve(status);
                            });
                        }
                        catch (err) {
                            // Non recoverable error encountered.
                            resolve(HASH_STATUS.STATUS_ERR_OTHER);
                        }
                    }
                }
            })();
        }));
    }

    /**
     * @description Initiates hashing of a requested file.
     *              Simply registers for notifications of the stream reader.
     *              Note: The last event to be registered is 'data'. This is because
     *                    as soon as this event is registered, the stream reader will start
     *                    reading the file and providing the data in chunks.
     * @returns {void}
     */
    Start() {
        // Register for 'stream reader' event notifications.
        // Regster for the 'data' notification last. This will cause the
        // stream reader to start reading data.
        if (this._myStreamReader) {
            this._myStreamReader.on('close',  this._streamClosedCB);
            this._myStreamReader.on('end',    this._streamEndCB);
            this._myStreamReader.on('error',  this._streamErrorCB);
            // Let the data flow.
            this._myStreamReader.on('data',   this._streamDataCB);
        }
    }

    /**
     * @description Stream reader notification handler for 'close'
     * @returns {void}
     */
    _streamClosed() {
        this._pending = false;
        this.emit(HASH_HELPER_INTERNAL_EVENTS.EVENT_DONE, {item: this});
    }

    /**
     * @description Stream reader notification handler for 'data'
     * @param {Buffer | string | *} chunk - Data chunk read into memory.
     * @returns {void}
     * @throws {ReferenceError} - thrown if the hash request is invalid
     */
    _streamData(chunk) {
        if (this._myHash) {
            this._myHash.update(chunk);
        }
        else {
            this._pending = false;
            throw new ReferenceError('_myHash is invalid');
        }
    }

    /**
     * @description Stream reader notification handler for 'end'
     * @returns {void}
     * @throws {ReferenceError} - thrown if the hash request is invalid
     */
    _streamEnd() {
        if (this._myHash) {
            this._pending = false;
            // Get the digest.
            const digest = this._myHash.digest('hex').toUpperCase();

            // Notify clients.
            this._request.emit(HASH_HELPER_EVENTS.EVENT_COMPLETE, {status_code: HASH_STATUS.STATUS_OK, digest: digest});
        }
        else {
            this._pending = false;
            // Notify clients.
            this._request.emit(HASH_HELPER_EVENTS.EVENT_COMPLETE, {status_code: HASH_STATUS.STATUS_ERR_OTHER, digest: undefined});

            throw new ReferenceError('_myHash is invalid');
        }
    }

    /**
     * @description Stream reader notification handler for 'error'
     * @param {Error} err - Error encountered while stream is active.
     *                      Note: all errors after the stream has veen prepared are considered terminal.
     * @returns {void}
     */
    _streamError(err) {
        // Any stream error encountered once the stream is open is a legitimate error.
        // Unhancled error.
        this._pending = false;
        // Notify clients.
        this._request.emit(HASH_HELPER_EVENTS.EVENT_COMPLETE, {status_code: HASH_STATUS.STATUS_ERR_OTHER, digest: undefined});

        // Throw the error so this can be investigated.
        // This exception could be removed or excused for specific cases once they
        // become known and understood.
        throw err;
    }
}

/**
 * @description Hash request dequeued notification
 * @event module:FSHashHelper#event:dequeued
 * @type {number} dequeCount - number of times the request has been dequeued.
 */
/**
 * @description Hash request pending notification
 * @event module:FSHashHelper#event:pending
 */
/**
 * @description Hash request dequeued notification
 * @event module:FSHashHelper#event:complete
 * @type {object}
 * @param {number} e.status_code - code indicating request error status. 0 inficates success.
 * @param {string} e.digest - String representing the message digest
 */
/**
 * @description Singleton to serialize all hash requests
 * @augments EventEmitter
 * @fires module:FSHashHelper#event:dequeued
 * @fires module:FSHashHelper#event:pending
 * @fires module:FSHashHelper#event:complete
 * @fires module:FSHashHelper#event:self_destruct
 * @private
 */
class InternalFileHasherSerializer extends EventEmitter {
    /**
     * @description Constructor
     */
    constructor() {
        // Initialize the base class.
        super();

        // List of requests that have yet to be processed.
        this._requestList = [];
        // List of requests that are underway but have not yet completed.
        this._pendingList = [];
        // Flag indicating if the asynchronous processRequest() function is mid-executuion.
        this._running     = false;

        this._processRequestCB = this.processRequests.bind(this);
        this._workerDoneCB     = this._workerDone.bind(this);
    }

    /**
     * @description Desctuctor
     * @returns {void}
     */
    destroy() {
        _debug(`Destroying the singleton instance of the File Hasher Serializer.`);
    }

    /**
     * @description Worker function that attempts to initiate processing of a
     *              single Hash Request. This function is called repeatedly
     *              until all requests have been serviced.
     * @returns {void}
     * @throws {Error}
     */
    processRequests() {
        // Prevent re-entrancy while the function is executing.
        // If this
        if (!this._running) {
            (async () => {
                // Set the running flag. If there is nothing to do, this will be cleared.
                this._running = true;

                if (this._requestList.length > 0) {
                    // Get the next request from the list, but leave it on the list for now.
                    const nextRequest = this._requestList[0];
                    nextRequest._dequeueCount++;
                    // Notify clients that this item has been dequeued.
                    nextRequest.emit(HASH_HELPER_EVENTS.EVENT_DEQUEUED, nextRequest._dequeueCount);

                    // Create a candidate worker hasher for the next request on the list.
                    // BUT, leave this request on the list until it is known to be ok.
                    const candidateWorker = new InternalHashWorker({request: nextRequest});
                    // eslint-disable-next-line new-cap
                    const prepareResult = await candidateWorker.Prepare();

                    // If the candidate was successful or if retry is not allowable.
                    if ((prepareResult === HASH_STATUS.STATUS_OK) ||
                        (prepareResult !== HASH_STATUS.STATUS_TOO_MANY_FILES_OPEN)) {
                        // Dequeue the request and notify clients.
                        const dequeuedRequest = this._requestList.shift();
                        // Sanity - Validate that the candidate and dequeued requests are identical
                        if (dequeuedRequest !== candidateWorker._request) {
                            throw new Error('Unidentified hashing request.');
                        }

                        // Manage successful or terminal requests.
                        if (prepareResult === HASH_STATUS.STATUS_OK) {
                            // Notify client(s) that the request has been dequeued.
                            dequeuedRequest.emit(HASH_HELPER_EVENTS.EVENT_PENDING);

                            // Place the candiate on the pending list.
                            this._pendingList.push(candidateWorker);

                            // Kick off the hashing routine.
                            candidateWorker.once(HASH_HELPER_INTERNAL_EVENTS.EVENT_DONE, this._workerDoneCB);
                            // eslint-disable-next-line new-cap
                            candidateWorker.Start();
                        }
                        else {
                        // Let the client(s) of the request know the request failed.
                            dequeuedRequest.emit(HASH_HELPER_EVENTS.EVENT_COMPLETE, ({status_code: prepareResult, digest: undefined}));
                        }
                    }

                    // Queue up another processing request.
                    if (this._requestList.length > 0) {
                        setTimeout(this._processRequestCB, _FILE_HASH_PROCESSING_DELAY);
                    }
                }

                // Clear the running flag.
                this._running = false;
            })();
        }
    }

    /**
     * @description Read-Only Property accessor determine if the serializer is active.
     * @returns {boolean} - true if of there are requests that are proccessing or queued.
     */
    get IsActive() {
        const active = ((InternalFileHasherSerializer._instance._requestList.length > 0) ||
                        (InternalFileHasherSerializer._instance._pendingList.length > 0));

        return active;
    }

    /**
     * @description InternalHashWorker notification handler for HASH_HELPER_INTERNAL_EVENTS.EVENT_DONE
     * @param {object} args - Arguments to clean up when the worker has completed.
     * @param {InternalHashWorker} args.item - Reference to the worker that has completed processing.
     * @returns {void}
     */
    _workerDone(args) {
        if ((args !== undefined) && (typeof(args) === 'object') &&
            (args.item instanceof InternalHashWorker)) {
            // Clean up
            const worker = args.item;
            worker.destroy();
            // Remove from the pending list
            this._pendingList = this._pendingList.filter((item) => {
                return (item !== worker);
            });

            // Queue up another processing request, if needed.
            if (this._requestList.length > 0) {
                setTimeout(this._processRequestCB, _FILE_HASH_PROCESSING_DELAY);
            }
            // If both the queued list and the pending list are empty, there is no need for us.
            else if (this._pendingList.length <= 0) {
                // Issue the self-destruct sequence
                this.emit(HASH_HELPER_EVENTS.EVENT_SELF_DESTRUCT);
            }
        }
    }
}

/**
 * @description Static reference to the 'internal' singleton.
 *              Created by FileHasherSerializer.SubmitHashRequest(), as needed.
 *              Destroyed by the function _destroySerializer().
 * @private
 */
InternalFileHasherSerializer._instance = null;

/**
 * @description InternalFileHasherSerializer notification handler for HASH_HELPER_EVENTS.EVENT_SELF_DESTRUCT
 *              The HASH_HELPER_EVENTS.EVENT_SELF_DESTRUCT event is emitted when the singleton is
 *              done processing all requests.
 * @returns {void}
 * @private
 */
function _destroySerializer() {
    if ((InternalFileHasherSerializer._instance) &&
        (!InternalFileHasherSerializer._instance.IsActive)) {
        // Cleanup.
        InternalFileHasherSerializer._instance.destroy();
        InternalFileHasherSerializer._instance = null;
    }
}

/**
 * @description Provides static functions allowing clients to submit
 *              requests to hash a file. The request is serialized
 *              in the singleton InternalFileHasherSerializer.instance.
 */
export class FileHasherSerializer {
    /**
     * @description (Abstract) This class simply exports static functions. It is not intended to be instanced (constructed).
     * @throws {FSNotCreatable} - Always. Class does not support instanciation.
     */
    constructor() {
        // API to access the singleton serializer.
        // This class should *never* be constructed
        throw new FSNotCreatable('FileHasherSerializer');
    }

    /**
     * @description Accessor to submit a request for hashing a file.
     * @param {HashRequest} request - request item being submitted
     * @throws {TypeError}  - Exception thrown when an invalid argument is provided.
     * @throws {RangeError} - Exception thrown when the request object does not conform to expectations.
     * @returns {void}
     */
    static SubmitHashRequest(request) {
        // Validate the argument(s).
        if (!(request instanceof HashRequest)) {
            throw new TypeError(`request needs to be an instance of <HashRequest>`);
        }
        // Source validation.
        if ((request.Source === undefined) ||
            (typeof(request.Source) !== 'string') ||
            (request.Source.length <= 0)) {
            throw new RangeError(`request.Source must be a non-zero length string.`);
        }
        // Algorithm validation.
        if ((request.Algorithm === undefined) ||
            (typeof(request.Algorithm) !== 'string') ||
            (request.Algorithm.length <= 0)) {
            throw new RangeError(`request.Algorithm must be a non-zero length string.`);
        }

        // Check to see if the singleton instance exists.
        if (!InternalFileHasherSerializer._instance) {
        // Create the singleton.
            InternalFileHasherSerializer._instance = new InternalFileHasherSerializer();
            InternalFileHasherSerializer._instance.once(HASH_HELPER_EVENTS.EVENT_SELF_DESTRUCT, _destroySerializer);
        }

        // Append the request to the 'to-do' list.
        InternalFileHasherSerializer._instance._requestList.push(request);

        // Attempt to process this request. If the hash serializer is busy, this will
        // be a no-op and requeue when the serializer is no longer busy.
        InternalFileHasherSerializer._instance.processRequests();
    }

    /**
     * @description Accessor to recind a request for hashing a file that has not yet started processing.
     * @param {HashRequest} request - request item being recinded
     * @throws {TypeError}  - Exception thrown when an invalid argument is provided.
     * @throws {RangeError} - Exception thrown when the request object does not conform to expectations.
     * @returns {void}
     */
    static RecindHashRequest(request) {
        let success = false;

        // Validate the argument(s).
        if (!(request instanceof HashRequest)) {
            throw new TypeError(`request needs to be an instance of <HashRequest>`);
        }
        // Source validation.
        if ((request.Source === undefined) ||
            (typeof(request.Source) !== 'string') ||
            (request.Source.length <= 0)) {
            throw new RangeError(`request.Source must be a non-zero length string.`);
        }
        // Algorithm validation.
        if ((request.Algorithm === undefined) ||
            (typeof(request.Algorithm) !== 'string') ||
            (request.Algorithm.length <= 0)) {
            throw new RangeError(`request.Algorithm must be a non-zero length string.`);
        }

        // Check to see if the instance exists and is not actively being processed.
        if (InternalFileHasherSerializer._instance) {
            const targetItem = InternalFileHasherSerializer._instance._requestList.find( (item) => {
                return ((item == request) && (!item.IsPending));
            });

            success = (request === targetItem);

            // Cleanup, if the hash serializer is no longer active
            if (!InternalFileHasherSerializer._instance.IsActive) {
                // There is nothing more to do. Kill the Singleton
                _destroySerializer();
            }
        }

        return success;
    }
}
