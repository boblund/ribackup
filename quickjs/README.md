# Notes on ribackup.mjs with Quickjs
Quickjs and NodeJS are largely the same from a JavaScript perspective but platform APIs differ substantially. The ribackup.mjs file imports all of its dependendies from ribImports.mjs to hide these differences. ribImports.mjs detects if it is running on NodeJS or not (and presumes QuickJS) and uses different API implementations accordingly.

The overall philosophy for QuickJS support is:
- Do not use Quickjs ```std``` or ```os``` built-in modules as these prevent dynamic import which is essential for transparent NodeJS emulation (at least for ribackup).
- Implement a NodeJS api using JavScript if possible (given the above constraint).
- Implement all other apis required for ribackup in C via process.c, that is statically linked to the ribackup executable.

## Pipe
This a global class for creating instances of a pipe.
- ```let pipe = new Pipe( <string>cmd, <string>mode )```: opens a pipe to shell cmd in r or w (read or write) mode.
- ```let arrayBuffer = pipe.read()```: returns arrayBuffer with data read from the pipe or undefined if no data.
- ```pipe.write( <ArrayBuffer>buffer )```: writes the contents of buffer to the pipe.
- ```let code = pipe.close()```: closes the pipe and returns the exit code from the cmd.

## execps
This is a promisefied version of NodeJS exec. The QuickJS implementation uses a Pipe class defined in process.c. This class is a property of the global object in QuickJS. There are some limitations. The C pipe does not expose stderr. Stderr is emulated by redirecting stderr to stdout and intepretting the last read of stdout as stderr in the case pipe.close() returns a non-zero error code; this may not always be the case but it seems to work.

## asyncSpawn
This is a async version of NodeJS spawn. The QuickJS implementation is essentially the same as execeps except it exposes stdout that can be read by the client, as oppesed to execps which returns the entire stdout when the pipe read completes. **NOTE** ribackup.mjs only spawns rsync and therefore only reads the response; stdin to a spawned command is not implemented. It could be by specifying a write mode argument, or replacing the C pipe implementation with a proper fork/exec.

## Date.prototype.toLocaleString
This implements support for the 'sv-SE' locale needed by ribackup. Anyother, or no, locale uses the QuickJS default.

## hostname
This is implemented in ribImports.mjs as a Pipe instace to the system hostname command.

## join
This is implemented in ribImports.mjs as a simple polyfill that suffices for simple use-cases but may not be complete.

## dirname
This is implemented in process.c as a global called '''dirname''';

## process
A global process object is defined with the properties:
- ```exit( int )```: defined in process.c
- ```stdout```: empty object to be used as the argument to the ```pipe``` method of the stdout object returned by spawnAsync. This emulates a pipe from the stdout returned by NodeJS spawn to the process's stdout.
- ```versions.quickjs```: set to true.
- ```process.argv[]```: where QuickJS scriptArgs is mapped to argv starting at index 1.

