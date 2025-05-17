#!/usr/bin/env node

import { createReadStream, existsSync } from 'fs';
import { exec, spawn } from 'child_process';
import readline from 'readline';
import crypto from 'crypto';
import { join } from 'path';

function execps( cmd ){
	return new Promise( res => {
		exec( cmd, ( err, stdout, stderr ) => {
			res( { code: err != null ? err.code : 0, stdout, stderr } );
		} );
	} );
}

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

function getChecksum( path ) {
	return new Promise( function ( resolve, reject ) {
		const hash = crypto.createHash( 'md5' ); // sha1, sha256
		const input = createReadStream( path );
		input.on( 'error', ( e ) => {
			reject( e );
		} );
		input.on( 'data', function ( chunk ) { hash.update( chunk ); } );
		input.on( 'close', () => {
			 resolve( hash.digest( 'hex' ) );
		} );
	} );
}

const sshHostname = ( await execps( `avahi-resolve-address ${ process.env.SSH_CLIENT.split( ' ' )[0] }` ) ).stdout
	.split( '\t' )[ 1 ].split( '\n' )[0].split( '.' )[0];
const backupDir = `/media/toshiba1t/backups/${ sshHostname }/latest/`;
if( !existsSync( backupDir ) ){
	console.error( `no backups for ${ sshHostname }` );
	process.exit( 1 );
}
const { stdout, exit } = await spawnAsync( `sh -c "cd ${ backupDir }; find . -type f"` );
const rl = readline.createInterface( { input: stdout, terminal: false, crlfDelay: Infinity } );

for await ( const path of rl ) {
	const filePath = join( backupDir, path );
	if( existsSync( filePath ) ){
		const hash = await getChecksum( filePath );
		console.log( JSON.stringify( { path, hash } ) );
	}
}
