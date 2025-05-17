#!/usr/bin/env node

import { createReadStream, existsSync } from 'fs';
import { spawn } from 'child_process';
import { hostname } from 'os';
import readline from 'readline';
import crypto from 'crypto';

const { sshDest } = await import( `./${ hostname().replace( '.local', '' ) }.backupConfig.mjs` );


function spawnAsync( string ){
	let r = '';
	const [ cmd, ...args ] = string.match( /(".*?"|'.*?'|\S+)/g ).map( e => e.replace( /['"](.*?)['"]/, "$1" ) );
	const child = spawn( cmd, args );
	child.stderr.on( 'data', chunk => { r += chunk; } );
	return {
		stdout: child.stdout,
		stdin: child.stdin,
		exit: new Promise( res => {
			child.on( 'close', code => {
				res( { code, stderr: r } );
			} );
		} )
	};
}

const spin = [  '-', '\\', '|', '/' ];
let spinCnt = 0;

function spinner(){
	process.stdout.write( `\b\b${ spin[ spinCnt ] } ` );
	spinCnt = ++spinCnt % spin.length;
}

function getChecksum( path ) {
	return new Promise( function ( resolve, reject ) {
		const hash = crypto.createHash( 'md5' ); // sha1, sha256
		const input = createReadStream( path );
		input.on( 'error', reject );
		input.on( 'data', function ( chunk ) { hash.update( chunk ); } );
		input.on( 'close', function () { resolve( hash.digest( 'hex' ) ); } );
	} );
}

const { stdout, exit } = await spawnAsync( `ssh ${ sshDest } createHashes.mjs` );
const rl = readline.createInterface( { input: stdout, terminal: false, crlfDelay: Infinity } );
let numFiles = 0, start = Date.now();
for await ( const l of rl ) {
	let { path, hash } = JSON.parse( l );
	numFiles++;
	path = path.slice( 1 );
	if( existsSync( path ) ){
		const localHash = await getChecksum( path );
		if( localHash != hash ){
			console.error( `hash mismatch: ${ path }` );
		}
	} else {
		console.error( `no file: ${ path }` );
	}
	//spinner();
	readline.clearLine( process.stdout, 0 );
	readline.cursorTo( process.stdout, 0 );
	process.stdout.write( `Verified ${ numFiles } files in ${ Math.round( ( Date.now() - start ) / 1000 ) } seconds` );
}
