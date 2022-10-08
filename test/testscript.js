if ((!process.argv) || (process.argv.length < 2) || (typeof(process.argv[2]) !== 'string')) {
  console.error('Expected caller to specify the input module as the first user argument!');
  process.exit(1);
}
else {
  console.log(`Testing module: ${process.argv[2]}`);
}

import { FSHasher } from '../dist/grumptech-fs-hasher.js';
import * as _filesystem from 'fs';
import {readFileSync as _readFileSync } from 'node:fs';
import {fileURLToPath as _fileURLToPath} from 'node:url';
import {EOL as _EOL} from 'node:os';
import {join as _join, dirname as _dirname} from 'node:path';

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

(async () => {
  let fsHasher = new FSHasher();

  const src1    = __dirname + '/sample_data/folder-a/folder-b/bacon_ipsum.txt';
  const src2    = __dirname + '/sample_data/folder-a/folder-b-copy/bacon_ipsum.txt';
  const src3    = __dirname + '/sample_data/folder-c/';
  const src     = [src1, src2, src3];
  const outdir  = __dirname + '/output/';

  console.log(`Initiating build: ${src}`);
  const buildStart = Date.now();
  const build = await fsHasher.Build(src);
  const buildDelta = getDeltaTime(buildStart);
  console.log(`Build result of file system "${fsHasher.Source}" is ${build}.\nElapsed time: ${buildDelta.hour}h ${buildDelta.minute}m ${(buildDelta.second + (buildDelta.millisec/1000.0)).toFixed(3)}s`);

  console.log(`\n\nInitiating compute.`);
  const computeStart = Date.now();
  const compute = await fsHasher.Compute();
  const computeDelta  = getDeltaTime(computeStart);
  console.log(`Compute result of file system "${compute}"\nElapsed time: ${computeDelta.hour}h ${computeDelta.minute}m ${(computeDelta.second + (computeDelta.millisec/1000.0)).toFixed(3)}s`);

  console.log(`\n\nInitiating report`);
  const report = await fsHasher.Report();
  // eslint-disable-next-line no-unused-vars
  _filesystem.writeFile(outdir + 'fsHashOutput.csv', report, (_err) => {
  });
  console.log(`Report complete`);

  console.log(`\n\nInitiating duplicate scan`);
  const duplicates = await fsHasher.FindDuplicates();
  if (duplicates && (duplicates.size > 0)) {
    // Generate a CSV file of the duplicates.
    const writeStream = _filesystem.createWriteStream(outdir + 'fsHashDups.csv');
    duplicates.forEach((value, key) => {
      if (value && Array.isArray(value) && (value.length>1)) {
        writeStream.write(`${value.length};${key};${value[0]}\n`);
        for (let index=1; index < value.length; index++) {
          writeStream.write(`;;${value[index]}\n`);
        }
      }
    });
    writeStream.end();
  }
  else {
    console.log(`All items are unique.`);
  }
  console.log(`Duplicate scan complete`);

  // Cleanup and release the underlying references.
  fsHasher.destroy();

  // Generate an error.
  // Accessing the FSHash object after invoking the destroy() method
  // will result in a ReferenceError exception.
  console.log(`\n\nIntentionally cause a programatic error by accessing the fsHasher after calling .destory().`);
  console.log(`${fsHasher.Source}`);
})();

/* ========================================================================
   Description:    Helper function to compute the delta time from a
                   reference timestamp

   @param {number}    [startTime]  - Time stamp from a prior Date.now() reference.

   @return {object}             - Computed delta time.
   @return {number}  [.hour]    - Delta hours
   @return {number}  [.minute]  - Delta minutes
   @return {number}  [.second]  - Delta seconds
   @return {number}  [.millisec]- Delta milliseconds
   ======================================================================== */
function getDeltaTime(startTime) {
  const endTime = Date.now();

  const deltaHrs  = Math.floor((endTime-startTime)/3600000.0);
  const deltaMin  = Math.floor((endTime-startTime)/60000.0)   - (deltaHrs*60.0);
  const deltaSec  = Math.floor((endTime-startTime)/1000.0)    - ((deltaHrs*3600.0)    + (deltaMin*60.0));
  const deltaMSec = Math.floor((endTime-startTime))           - ((deltaHrs*3600000.0) + (deltaMin*60000.0) + (deltaSec*1000.0));

  return {hour:deltaHrs, minute:deltaMin, second:deltaSec, millisec:deltaMSec};
}
