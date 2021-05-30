# GrumpTech-FS-Hasher

A JavaScript node module for for producing message digests of files and directories. The message digest of a directory is computed as the hash of the message digests of all of the contents of the directory.

## Change Log
The change history can be viewed [here](./CHANGELOG.md)

## Security Policy
Please refer to our [security policy](./SECURITY.md) for information on which versions are receiving security updates and how to report security vulnerabilities.

## Installation
> npm install grumptech-fs-hasher


## Basic Usage
Loading the module in NodeJS
>const fsHasher = require('grumptech-fs-hasher');

Testing the module in NodeJS
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;*Example usage is shown in the file: ./test/testscript.js*
>npm run test-rel

The module exports two objects:
1. **HASH_ALGORITHMS**: An enumeration of supported hashing algorithm.
2. **FSHasher**: Object to perform the hashing and reporting.

#### FSHasher API
The FSHasher object provides the interface below

> **Version**:
<br>Read-only property for the version of the hasher module.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return {string}

> **IsBusy**:
<br>Read-only property indicating that the object is busy performing an operation.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return {boolean}

> **Algorithm**:
<br>Read-only property of the current hashing algorithm. Default: '_sha256_'
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return {string}

> **Source**:
<br>Read-only property for the source(s) to perform the hashing.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return {string | string[]}:

> **Build**:
<br>Constructs a hierarchy of files and directories to be hashed.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@parm {string | string[]} [source]
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return  {Promise(boolean)} - A promise that when resolved will indicate if the file system heirarchy was built or not. true if built. false otherwise.

> **Compute**:
<br>Generate a message digest of the source (and all child items).
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@param {string} - A string representing the hashing algorithm to use.  HASH_ALGORITHMS is an enum of common algorithms.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return  {Promise(string)} - A promise that when resolved will provide a string representing the overall hash of the root source. If the hierarchy has not been built or the root source is busy, the promise will resolve to and empty string

> **Report**:
<br>Build a report of the file system hierarchy with the results of the hashing.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return  {Promise(string)} - A promise that when resolved will provide a string containing a CSV delimited report. If the hierarchy has not been built or the root source is busy, the promise will resolve to an empty string.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CSV Format:
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Field #1: Type   - '(D)'-Directory, '(F)'-File, '(B)'-Batch
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Field #2: Source - Path of the File System object. Will be prepended with spaces corresponding to the depth of the result item.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Field #3: Digest - Message digest of the item. If it has not been computed, it will default to undefined.

> **FindDuplicates**:
<br>Finds duplicate file system objects.
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@return  {Promise(Map{key:digest, value:source[]))} - A promise that when resolved will provide a map/dictionary. The key of the dictionary will be "common" message digest and the value will be an array of strings containing the sources sharing the digest. Unique items will _not_ be specified in the result.

## License
Refer to [LICENSE.md](./LICENSE.md) for information regarding licensincg of this source code.